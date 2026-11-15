import { posix } from "node:path";
import * as NodeSink from "@effect/platform-node-shared/NodeSink";
import * as NodeStream from "@effect/platform-node-shared/NodeStream";
import { createGunzip } from "node:zlib";
import { MemoryFileSystem } from "@effect-vfs/memory";
import type { OkfSourceInput } from "@repo/domain/Okf";
import {
  Config,
  Data,
  Effect,
  FileSystem,
  Option,
  Schema,
  Stream,
} from "effect";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import { extract } from "tar-stream";

export class GitHubTreeError extends Data.TaggedError("GitHubTreeError")<{
  readonly reason: string;
  readonly cause?: unknown;
}> {
  override get message() {
    return this.reason;
  }
}

const decodeChunk = Schema.decodeUnknownEffect(Schema.Uint8Array);
const Commit = Schema.Struct({
  sha: Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/)),
});

const importArchive = Effect.fn("GitHubTree.importArchive")(function* (
  response: HttpClientResponse.HttpClientResponse,
  subpath: string,
  fs: FileSystem.FileSystem,
) {
  const archive = extract();
  const archiveError = (cause: unknown) =>
    new GitHubTreeError({ reason: "Cannot read GitHub archive", cause });
  const links: Array<{ path: string; target: string }> = [];

  const feed = response.stream.pipe(
    NodeStream.pipeThroughDuplex({
      evaluate: createGunzip,
      onError: archiveError,
    }),
    Stream.run(
      NodeSink.fromWritable({ evaluate: () => archive, onError: archiveError }),
    ),
  );
  const writeEntries = Stream.fromAsyncIterable(archive, archiveError).pipe(
    Stream.runForEach(
      Effect.fnUntraced(function* (entry) {
        const { name, type, linkname } = entry.header;
        const path = name.split("/").slice(1).join("/").replace(/\/$/, "");
        if (path !== subpath && !path.startsWith(subpath + "/")) {
          entry.resume();
          return;
        }
        if (
          path.split("/").some((part) => !part || part === "." || part === "..")
        ) {
          return yield* new GitHubTreeError({
            reason: "Invalid GitHub archive path",
          });
        }
        const target = "/bundle" + path.slice(subpath.length);
        if (type === "file") {
          yield* fs.makeDirectory(posix.dirname(target), { recursive: true });
          yield* Stream.run(
            Stream.fromAsyncIterable(entry, archiveError).pipe(
              Stream.mapEffect((chunk) => decodeChunk(chunk)),
            ),
            fs.sink(target),
          );
        } else {
          entry.resume();
          if (type === "directory")
            yield* fs.makeDirectory(target, { recursive: true });
          if (type === "symlink" && linkname)
            links.push({ path: target, target: linkname });
        }
      }),
    ),
  );
  yield* Effect.all([feed, writeEntries], {
    concurrency: "unbounded",
    discard: true,
  });
  // Installing links last prevents writes through an archive symlink.
  for (const link of links) yield* fs.symlink(link.target, link.path);
});

export const resolveGitHubTree = Effect.fn("GitHubTree.resolve")(
  function* (
    source: Extract<OkfSourceInput, { _tag: "Git" }>,
    http: HttpClient.HttpClient,
  ) {
    const token = yield* Config.Redacted("GH_TOKEN").pipe(
      Config.orElse(() => Config.Redacted("GITHUB_TOKEN")),
      Config.option,
    );
    const repo = source.repoUrl.replace(/\.git$/, "");
    const api = repo.replace(
      "https://github.com/",
      "https://api.github.com/repos/",
    );
    const client = HttpClient.withScope(http).pipe(
      HttpClient.mapRequest((request) =>
        Option.isSome(token)
          ? HttpClientRequest.bearerToken(request, token.value)
          : request,
      ),
    );
    const parts = yield* Schema.decodeEffect(
      Schema.Array(Schema.StringFromUriComponent),
    )([source.ref, ...source.subpath.split("/")]);
    const random = yield* SecureRandom.SecureRandom;
    // Try the longest ref first because a branch or tag name can contain slashes.
    for (let split = parts.length - 1; split > 0; split--) {
      const ref = parts.slice(0, split).join("/");
      // A fresh lookup URL avoids stale responses immediately after a branch update.
      const commit = yield* Effect.scoped(
        Effect.gen(function* () {
          const response = yield* client.get(
            api + "/commits/" + encodeURIComponent(ref),
            {
              urlParams: { request: yield* random.uuidV4() },
            },
          );
          if (response.status === 404 || response.status === 422)
            return Option.none<string>();
          yield* HttpClientResponse.filterStatusOk(response);
          const { sha } =
            yield* HttpClientResponse.schemaBodyJson(Commit)(response);
          return Option.some(sha);
        }),
      );
      if (Option.isNone(commit)) continue;

      const subpath = parts.slice(split).join("/");
      const fileSystem = yield* MemoryFileSystem.make;
      yield* Effect.scoped(
        Effect.gen(function* () {
          const response = yield* client
            .get(api + "/tarball/" + commit.value)
            .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk));
          yield* importArchive(response, subpath, fileSystem);
        }),
      );
      const displayRoot =
        repo +
        "/tree/" +
        commit.value +
        "/" +
        subpath.split("/").map(encodeURIComponent).join("/");
      return {
        bundlePath: "/bundle",
        displayRoot,
        fileSystem,
        commit: commit.value,
      };
    }
    return yield* new GitHubTreeError({
      reason: `No matching GitHub ref for ${source.input}`,
    });
  },
  Effect.provide(Digest.layerWebCrypto),
  Effect.provide(SecureRandom.layerWebCrypto),
);
