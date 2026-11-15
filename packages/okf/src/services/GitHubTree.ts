import { randomUUID } from "node:crypto";
import { posix } from "node:path";
import { buffer } from "node:stream/consumers";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { MemoryFileSystem } from "@effect-vfs/memory";
import type { OkfSourceInput } from "@repo/domain/Okf";
import { Config, Data, Effect, Option, Redacted } from "effect";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import { extract } from "tar-stream";

export class GitHubTreeError extends Data.TaggedError("GitHubTreeError")<{
  readonly reason: string;
}> {
  override get message() {
    return this.reason;
  }
}

type ArchiveEntry =
  | { type: "directory"; path: string }
  | { type: "file"; path: string; bytes: Uint8Array }
  | { type: "symlink"; path: string; target: string };

async function readDirectory(
  response: Response,
  subpath: string,
  signal: AbortSignal,
) {
  if (!response.body)
    throw new Error("GitHub returned an empty archive response");
  const entries: ArchiveEntry[] = [];
  const archive = extract();
  await Promise.all([
    pipeline(response.body, createGunzip(), archive, { signal }),
    (async () => {
      for await (const entry of archive) {
        const { name, type, linkname } = entry.header;
        const path = name.split("/").slice(1).join("/").replace(/\/$/, "");
        if (path !== subpath && !path.startsWith(subpath + "/")) {
          entry.resume();
          continue;
        }
        if (
          path.split("/").some((part) => !part || part === "." || part === "..")
        ) {
          throw new Error("Invalid GitHub archive path");
        }
        const target = "/bundle" + path.slice(subpath.length);
        if (type === "file") {
          entries.push({ type, path: target, bytes: await buffer(entry) });
        } else {
          entry.resume();
          if (type === "directory") entries.push({ type, path: target });
          if (type === "symlink" && linkname)
            entries.push({ type, path: target, target: linkname });
        }
      }
    })(),
  ]);
  return entries;
}

export const resolveGitHubTree = Effect.fn("resolveGitHubTree")(function* (
  source: Extract<OkfSourceInput, { _tag: "Git" }>,
) {
  const token = yield* Config.Redacted("GH_TOKEN").pipe(
    Config.orElse(() => Config.Redacted("GITHUB_TOKEN")),
    Config.option,
  );
  const { commit, subpath, entries } = yield* Effect.tryPromise({
    try: async (signal) => {
      const repoPath = new URL(source.repoUrl).pathname.replace(/\.git$/, "");
      const api = "https://api.github.com/repos" + repoPath;
      const request = (path: string) =>
        fetch(api + path, {
          signal,
          headers: Option.isSome(token)
            ? { Authorization: "Bearer " + Redacted.value(token.value) }
            : {},
        });
      const parts = [source.ref, ...source.subpath.split("/")].map(
        decodeURIComponent,
      );
      // GitHub tree URLs have no separator between a slash-containing ref and the bundle path.
      for (let split = parts.length - 1; split > 0; split--) {
        const ref = parts.slice(0, split).join("/");
        const subpath = parts.slice(split).join("/");
        // Intermediaries can serve the previous branch head immediately after a push.
        const resolved = await request(
          "/commits/" + encodeURIComponent(ref) + "?request=" + randomUUID(),
        );
        if (resolved.status === 404 || resolved.status === 422) {
          await resolved.body?.cancel();
          continue;
        }
        if (!resolved.ok)
          throw new Error(
            `GitHub commit lookup returned HTTP ${resolved.status}`,
          );
        const object: unknown = await resolved.json();
        const commit =
          object && typeof object === "object" && "sha" in object
            ? object.sha
            : undefined;
        if (typeof commit !== "string" || !/^[0-9a-f]{40}$/.test(commit))
          throw new Error("Invalid GitHub commit SHA");
        const archive = await request("/tarball/" + commit);
        if (!archive.ok)
          throw new Error(`GitHub archive returned HTTP ${archive.status}`);
        return {
          commit,
          subpath,
          entries: await readDirectory(archive, subpath, signal),
        };
      }
      throw new Error(`No matching GitHub ref for ${source.input}`);
    },
    catch: (cause) => new GitHubTreeError({ reason: String(cause) }),
  });

  const fileSystem = yield* MemoryFileSystem.make.pipe(
    Effect.provide(Digest.layerWebCrypto),
    Effect.provide(SecureRandom.layerWebCrypto),
  );
  for (const entry of entries) {
    if (entry.type === "directory")
      yield* fileSystem.makeDirectory(entry.path, { recursive: true });
    if (entry.type === "file") {
      yield* fileSystem.makeDirectory(posix.dirname(entry.path), {
        recursive: true,
      });
      yield* fileSystem.writeFile(entry.path, entry.bytes);
    }
  }
  // Install links after all writes so archive links are never followed during import.
  for (const entry of entries) {
    if (entry.type === "symlink")
      yield* fileSystem.symlink(entry.target, entry.path);
  }
  const displayRoot =
    source.repoUrl.replace(/\.git$/, "") +
    "/tree/" +
    commit +
    "/" +
    subpath.split("/").map(encodeURIComponent).join("/");
  return { bundlePath: "/bundle", displayRoot, fileSystem, commit };
});
