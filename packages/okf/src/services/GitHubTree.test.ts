import { GitHubTree, GitHubTreeDefault } from "@repo/okf";
import { buffer } from "node:stream/consumers";
import { gzipSync } from "node:zlib";
import { Deferred, Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { pack } from "tar-stream";
import { expect, it } from "@effect/vitest";

it("loads each new head of a slash-containing GitHub branch into its own bundle", async () => {
  const url = "https://github.com/example/notes/tree/feature/plants/guides";
  const first = "1".repeat(40);
  const second = "2".repeat(40);
  let head = first;
  const snapshots: string[] = [];
  const fetchSnapshot: typeof fetch = async (input) => {
    const { pathname, searchParams } = new URL(
      input instanceof Request ? input.url : input,
    );
    if (pathname === "/repos/example/notes/commits/feature%2Fplants") {
      expect(searchParams.has("request")).toBe(true);
      return Response.json({ sha: head });
    }
    expect(pathname).toBe("/repos/example/notes/tarball/" + head);
    snapshots.push(head);
    const archive = pack();
    archive.entry({ name: "repo/guides/", type: "directory" });
    archive.entry({ name: "repo/guides/index.md" }, "# Plants\n");
    archive.entry(
      { name: `repo/guides/${head}.md` },
      "---\ntype: Note\n---\n\n# Plant\n",
    );
    archive.entry({ name: "repo/other/ignored.md" }, "outside bundle");
    archive.finalize();
    return new Response(new Uint8Array(gzipSync(await buffer(archive))));
  };
  await Effect.runPromise(
    Effect.gen(function* () {
      const tree = yield* GitHubTree;
      const before = yield* tree.open(new URL(url));
      head = second;
      const after = yield* tree.open(new URL(url));
      for (const [snapshot, expected] of [
        [before, first],
        [after, second],
      ] as const) {
        expect(snapshot.commit).toBe(expected);
        expect(snapshot.displayRoot).toBe(
          "https://github.com/example/notes/tree/" + expected + "/guides",
        );
        expect(
          (yield* snapshot.fileSystem.readDirectory(
            snapshot.bundlePath,
          )).toSorted(),
        ).toEqual([expected + ".md", "index.md"]);
        expect(
          yield* snapshot.fileSystem.readFileString(
            snapshot.bundlePath + "/" + expected + ".md",
          ),
        ).toContain("# Plant");
      }
    }).pipe(
      Effect.provide(GitHubTreeDefault),
      Effect.provideService(FetchHttpClient.Fetch, fetchSnapshot),
    ),
  );
  expect(snapshots).toEqual([first, second]);
});

it.each([
  { status: 403, body: "rate limited", tag: "HttpClientError" },
  { status: 200, body: '{"sha":"invalid"}', tag: "SchemaError" },
])(
  "surfaces $tag without trying a shorter ref",
  async ({ status, body, tag }) => {
    const requests: string[] = [];
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tree = yield* GitHubTree;
        return yield* Effect.flip(
          tree.open(
            new URL(
              "https://github.com/example/notes/tree/feature/plants/guides",
            ),
          ),
        );
      }).pipe(
        Effect.provide(GitHubTreeDefault),
        Effect.provideService(FetchHttpClient.Fetch, async (input) => {
          requests.push(String(input));
          return new Response(body, { status });
        }),
      ),
    );
    expect(result._tag).toBe(tag);
    expect(requests).toHaveLength(1);
  },
);

it("fails a corrupt gzip archive through the archive error channel", async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const tree = yield* GitHubTree;
      return yield* Effect.flip(
        tree.open(new URL("https://github.com/example/notes/tree/main/guides")),
      );
    }).pipe(
      Effect.provide(GitHubTreeDefault),
      Effect.provideService(FetchHttpClient.Fetch, async (input) =>
        String(input).includes("/commits/")
          ? Response.json({ sha: "1".repeat(40) })
          : new Response("not gzip"),
      ),
    ),
  );
  expect(result).toMatchObject({
    _tag: "GitHubTreeError",
    reason: "Cannot read GitHub archive",
  });
});

it("releases the HTTP request when an archive download is interrupted", async () => {
  const started = Deferred.makeUnsafe<void>();
  let signal: AbortSignal | null | undefined;
  await Effect.runPromise(
    Effect.gen(function* () {
      const tree = yield* GitHubTree;
      const fiber = yield* Effect.forkChild(
        tree.open(new URL("https://github.com/example/notes/tree/main/guides")),
      );
      yield* Deferred.await(started);
      yield* Fiber.interrupt(fiber);
    }).pipe(
      Effect.provide(GitHubTreeDefault),
      Effect.provideService(FetchHttpClient.Fetch, async (input, init) => {
        if (String(input).includes("/commits/"))
          return Response.json({ sha: "1".repeat(40) });
        signal = init?.signal;
        return new Response(
          new ReadableStream({
            pull() {
              Deferred.doneUnsafe(started, Effect.void);
            },
          }),
        );
      }),
    ),
  );
  expect(signal?.aborted).toBe(true);
});

it("reports a missing bundle directory when the archive contains only other paths", async () => {
  const archive = pack();
  archive.entry({ name: "repo/elsewhere/index.md" }, "# Elsewhere");
  archive.finalize();
  const bytes = new Uint8Array(gzipSync(await buffer(archive)));
  const url = new URL("https://github.com/example/notes/tree/main/guides");
  const error = await Effect.runPromise(
    Effect.gen(function* () {
      const tree = yield* GitHubTree;
      return yield* Effect.flip(tree.open(url));
    }).pipe(
      Effect.provide(GitHubTreeDefault),
      Effect.provideService(FetchHttpClient.Fetch, async (input) =>
        String(input).includes("/commits/")
          ? Response.json({ sha: "1".repeat(40) })
          : new Response(bytes),
      ),
    ),
  );
  expect(error).toMatchObject({ _tag: "BundleNotFound", path: url.href });
});
