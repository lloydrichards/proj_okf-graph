import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Graph, Layer } from "effect";
import { MarkdownService } from "./MarkdownService";
import { BundleInvalid, BundleNotFound, OkfService } from "./OkfService";

const TestLayer = Layer.mergeAll(OkfService.layer, MarkdownService.layer).pipe(
  Layer.provideMerge(NodeServices.layer),
);

describe("OkfService", () => {
  it.effect(
    "should report BundleNotFound when the local bundle is missing",
    () =>
      Effect.gen(function* () {
        const okf = yield* OkfService;
        const error = yield* Effect.flip(
          okf.validate("/tmp/okf-bundle-that-does-not-exist"),
        );

        expect(error).toBeInstanceOf(BundleNotFound);
        expect(error).toMatchObject({
          _tag: "BundleNotFound",
          path: "/tmp/okf-bundle-that-does-not-exist",
        });
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "should reject a bundle when root index frontmatter has unsupported keys",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const okf = yield* OkfService;
        const dir = yield* fs.makeTempDirectoryScoped({
          prefix: "okf-invalid-",
        });

        yield* fs.writeFileString(
          `${dir}/index.md`,
          `---\ntitle: Invalid\n---\n\n# Index\n`,
        );
        yield* fs.writeFileString(
          `${dir}/concept.md`,
          `---\ntype: Note\n---\n\nHello\n`,
        );

        const error = yield* Effect.flip(okf.validate(dir));

        expect(error).toBeInstanceOf(BundleInvalid);
        if (error._tag !== "BundleInvalid") {
          throw new Error(`Expected BundleInvalid, got ${error._tag}`);
        }
        expect(error.issues).toHaveLength(1);
        expect(error.issues[0]?.file).toBe("index.md");
        expect(error.issues[0]?.reason).toContain('at ["title"]');
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("should report a warning when a concept link is broken", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const okf = yield* OkfService;
      const dir = yield* fs.makeTempDirectoryScoped({
        prefix: "okf-broken-link-",
      });

      yield* fs.writeFileString(
        `${dir}/concept.md`,
        `---\ntype: Note\n---\n\nSee [missing](/missing.md).\n`,
      );

      const result = yield* okf.validate(dir);

      // Per OKF §5.3: "Consumers MUST tolerate broken links"
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([
        {
          id: "concept->missing",
          source: "graph",
          reason: "Broken internal link from concept to missing",
          severity: "warning",
        },
      ]);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("should report a warning when an index link is broken", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const okf = yield* OkfService;
      const dir = yield* fs.makeTempDirectoryScoped({
        prefix: "okf-index-link-",
      });

      yield* fs.writeFileString(
        `${dir}/index.md`,
        "See [missing](/missing.md).\n",
      );

      const result = yield* okf.validate(dir);

      expect(result.issues).toContainEqual({
        id: "index.md->missing",
        source: "index",
        reason: "Broken internal link from index.md to missing",
        severity: "warning",
      });
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "should accept directory and explicit index links when the target index exists",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const okf = yield* OkfService;
        const dir = yield* fs.makeTempDirectoryScoped({
          prefix: "okf-index-navigation-",
        });

        yield* fs.makeDirectory(`${dir}/section`);
        yield* fs.writeFileString(
          `${dir}/index.md`,
          "See [directory](./section/) and [index](./section/index.md).\n",
        );
        yield* fs.writeFileString(`${dir}/section/index.md`, "# Section\n");

        const result = yield* okf.validate(dir);

        expect(result.issues).toHaveLength(0);
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "should report a warning when an index directory link has no target",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const okf = yield* OkfService;
        const dir = yield* fs.makeTempDirectoryScoped({
          prefix: "okf-missing-index-directory-",
        });

        yield* fs.writeFileString(
          `${dir}/index.md`,
          "See [missing](./missing/).\n",
        );

        const result = yield* okf.validate(dir);

        expect(result.issues).toContainEqual({
          id: "index.md->missing/",
          source: "index",
          reason: "Broken internal link from index.md to missing/",
          severity: "warning",
        });
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "should accept absolute non-HTTP URIs when validating a bundle",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const okf = yield* OkfService;
        const dir = yield* fs.makeTempDirectoryScoped({ prefix: "okf-uri-" });

        yield* fs.writeFileString(
          `${dir}/concept.md`,
          `---\ntype: Note\nresource: urn:isbn:9780140328721\n---\n\n[Email](mailto:plants@example.com).\n`,
        );

        const result = yield* okf.validate(dir);

        expect(result.issues).toHaveLength(0);
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("should resolve an internal link when it includes a fragment", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const okf = yield* OkfService;
      const dir = yield* fs.makeTempDirectoryScoped({
        prefix: "okf-fragment-link-",
      });

      yield* fs.writeFileString(
        `${dir}/parent.md`,
        `---\ntype: Note\n---\n\n## Details\n`,
      );
      yield* fs.writeFileString(
        `${dir}/child.md`,
        `---\ntype: Note\n---\n\nSee [details](/parent.md#details).\n`,
      );

      const result = yield* okf.validate(dir);

      expect(result.issues).toHaveLength(0);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "should warn without invalidating a bundle when a timestamp is impossible",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const okf = yield* OkfService;
        const dir = yield* fs.makeTempDirectoryScoped({
          prefix: "okf-invalid-timestamp-",
        });

        yield* fs.writeFileString(
          `${dir}/concept.md`,
          `---\ntype: Note\ntimestamp: 2026-99-99T25:61:61Z\n---\n\nHello\n`,
        );

        const result = yield* okf.validate(dir);

        expect(result.valid).toBe(true);
        expect(result.issues).toContainEqual({
          id: "concept",
          source: "concept",
          reason:
            'Invalid timestamp datetime "2026-99-99T25:61:61Z" — expected ISO 8601 with an explicit UTC offset',
          severity: "warning",
        });
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("should use a Markdown link title as a graph edge relation", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const okf = yield* OkfService;
      const dir = yield* fs.makeTempDirectoryScoped({
        prefix: "okf-edge-relation-",
      });

      yield* fs.writeFileString(
        `${dir}/parent.md`,
        `---\ntype: Note\ntitle: Parent\n---\n\nParent concept.\n`,
      );
      yield* fs.writeFileString(
        `${dir}/child.md`,
        `---\ntype: Note\ntitle: Child\n---\n\nI am a [link](/parent.md "child of") that can be parsed.\n`,
      );

      const result = yield* okf.make(dir);
      const edges = Array.from(Graph.edges(result.graph.graph));

      expect(edges).toHaveLength(1);
      expect(edges[0]?.[1].data).toEqual({
        kind: "concept-link",
        sourceId: "child",
        targetId: "parent",
        label: "link",
        relation: "child of",
      });
    }).pipe(Effect.provide(TestLayer)),
  );
});
