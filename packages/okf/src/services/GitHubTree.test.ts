import { buffer } from "node:stream/consumers";
import { gzipSync } from "node:zlib";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { pack } from "tar-stream";
import { afterEach, expect, it, vi } from "vitest";
import { OkfService } from "./OkfService";

afterEach(() => vi.unstubAllGlobals());

it("loads each new head of a slash-containing GitHub branch into its own bundle", async () => {
  const url = "https://github.com/example/notes/tree/feature/plants/guides";
  const first = "1".repeat(40);
  const second = "2".repeat(40);
  let head = first;
  const snapshots: string[] = [];
  vi.stubGlobal("fetch", async (input: string) => {
    const { pathname, searchParams } = new URL(input);
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
  });
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
    ),
  );
  expect(snapshots).toEqual([first, second]);
});
