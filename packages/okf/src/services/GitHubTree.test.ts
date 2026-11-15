import { buffer } from "node:stream/consumers";
import { gzipSync } from "node:zlib";
import { NodeServices } from "@effect/platform-node";
import { Deferred, Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { pack } from "tar-stream";
import { expect, it } from "vitest";
import { OkfService } from "./OkfService";

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
      const okf = yield* OkfService;
      for (const commit of [first, second]) {
        head = commit;
        const { bundle, graph } = yield* okf.make(url);
        expect([...graph.nodeIndex.keys()]).toEqual([commit]);
        expect(bundle.root).toBe(
          "https://github.com/example/notes/tree/" + commit + "/guides",
        );
      }
    }).pipe(
      Effect.provide(OkfService.layer),
      Effect.provide(NodeServices.layer),
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
        const okf = yield* OkfService;
        return yield* Effect.flip(
          okf.make(
            "https://github.com/example/notes/tree/feature/plants/guides",
          ),
        );
      }).pipe(
        Effect.provide(OkfService.layer),
        Effect.provide(NodeServices.layer),
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
      const okf = yield* OkfService;
      return yield* Effect.flip(
        okf.make("https://github.com/example/notes/tree/main/guides"),
      );
    }).pipe(
      Effect.provide(OkfService.layer),
      Effect.provide(NodeServices.layer),
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
      const okf = yield* OkfService;
      const fiber = yield* Effect.forkChild(
        okf.make("https://github.com/example/notes/tree/main/guides"),
      );
      yield* Deferred.await(started);
      yield* Fiber.interrupt(fiber);
    }).pipe(
      Effect.provide(OkfService.layer),
      Effect.provide(NodeServices.layer),
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
