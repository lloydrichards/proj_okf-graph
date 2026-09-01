import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { isStaleAt } from "@repo/domain/Okf";
import { dirname } from "node:path";
import { DateTime, Effect, FileSystem, Graph, Layer } from "effect";
import { MarkdownService } from "../services/MarkdownService";
import { BundleInvalid, OkfService } from "../services/OkfService";

const TestLayer = Layer.mergeAll(OkfService.layer, MarkdownService.layer).pipe(
  Layer.provideMerge(NodeServices.layer),
);

const makeBundle = Effect.fn("makeOkfV02ConformanceBundle")(function* (
  files: Readonly<Record<string, string>>,
) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "okf-v02-" });

  for (const [path, content] of Object.entries(files)) {
    const parent = dirname(`${root}/${path}`);
    if (parent !== root) {
      yield* fs.makeDirectory(parent, { recursive: true });
    }
    yield* fs.writeFileString(`${root}/${path}`, content);
  }

  return root;
});

const concept = (frontmatter: string, body = "Concept body.\n") =>
  `---\n${frontmatter}\n---\n\n${body}`;

describe("OKF v0.2 conformance", () => {
  describe("§3, §4, and §11 — concept documents", () => {
    it.effect("should accept a concept when only type is present", () =>
      Effect.gen(function* () {
        const root = yield* makeBundle({
          "concept.md": concept("type: Producer Defined Type"),
        });
        const okf = yield* OkfService;

        const result = yield* okf.validate(root);

        expect(result.valid).toBe(true);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("should reject a concept when frontmatter is missing", () =>
      Effect.gen(function* () {
        const root = yield* makeBundle({ "concept.md": "# Concept\n" });
        const okf = yield* OkfService;

        const error = yield* Effect.flip(okf.validate(root));

        expect(error).toBeInstanceOf(BundleInvalid);
        expect(error).toMatchObject({
          issues: [{ file: "concept.md", reason: "No frontmatter found" }],
        });
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "should reject a concept when YAML frontmatter is malformed",
      () =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "concept.md": "---\ntype: [unterminated\n---\n",
          });
          const okf = yield* OkfService;

          const error = yield* Effect.flip(okf.validate(root));

          expect(error).toBeInstanceOf(BundleInvalid);
          expect(error).toMatchObject({ issues: [{ file: "concept.md" }] });
        }).pipe(Effect.provide(TestLayer)),
    );

    it.effect.each([
      { condition: "missing", frontmatter: "title: No type" },
      { condition: "empty", frontmatter: 'type: ""' },
    ])("should reject a concept when type is $condition", ({ frontmatter }) =>
      Effect.gen(function* () {
        const root = yield* makeBundle({
          "concept.md": concept(frontmatter),
        });
        const okf = yield* OkfService;

        const error = yield* Effect.flip(okf.validate(root));

        expect(error).toBeInstanceOf(BundleInvalid);
        expect(error).toMatchObject({ issues: [{ file: "concept.md" }] });
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "should preserve producer fields when optional metadata is missing",
      () =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "concept.md": concept(
              "type: Note\nproducer_extension:\n  confidence: high",
            ),
          });
          const okf = yield* OkfService;

          const { bundle } = yield* okf.make(root);
          expect(bundle.concepts[0]?.frontmatter).toMatchObject({
            producer_extension: { confidence: "high" },
          });
        }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("should preserve metadata when every v0.2 field is present", () =>
      Effect.gen(function* () {
        const root = yield* makeBundle({
          "computation.md": concept(
            [
              "type: Attested Computation",
              "status: stable",
              "stale_after: 2026-12-31T00:00:00Z",
              "generated: { by: agent/1.0, at: 2026-08-01T00:00:00Z }",
              "verified: { by: human:reviewer, at: 2026-08-02T00:00:00Z }",
              "sources:",
              "  - id: policy",
              "    resource: references/policy.md",
              "usage_window: { from: 2026-07-01T00:00:00Z, to: 2026-08-01T00:00:00Z }",
              "runtime: bigquery",
              "parameters:",
              "  - { name: year, type: integer, required: true }",
              "executor:",
              "  resource: references/run.md",
              "  receipt: [job_id, executed_sql, result]",
              "attester: { resource: references/attest.py }",
            ].join("\n"),
            "# Computation\n\n```sql\nSELECT 1\n```\n",
          ),
        });
        const okf = yield* OkfService;

        const { bundle } = yield* okf.make(root);
        const metadata = bundle.concepts[0]?.metadata;

        expect(metadata).toMatchObject({
          status: "stable",
          generated: { by: "agent/1.0", at: "2026-08-01T00:00:00Z" },
          trustTier: "human-reviewed",
          runtime: "bigquery",
          attester: { resource: "references/attest.py" },
        });
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("§6 and §11 — links", () => {
    it.effect.each([
      { kind: "bundle-relative", target: "/target.md" },
      { kind: "relative", target: "../target.md" },
    ])("should resolve a concept link when it is $kind", ({ target }) =>
      Effect.gen(function* () {
        const root = yield* makeBundle({
          "target.md": concept("type: Note"),
          "nested/source.md": concept(
            "type: Note",
            `See [target](${target}).\n`,
          ),
        });
        const okf = yield* OkfService;

        const { graph } = yield* okf.make(root);
        const edges = Array.from(Graph.edges(graph.graph));

        expect(edges).toHaveLength(1);
        expect(edges[0]?.[1].data).toMatchObject({
          sourceId: "nested/source",
          targetId: "target",
        });
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "should warn without invalidating when a concept link is broken",
      () =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "concept.md": concept(
              "type: Note",
              "See [future concept](/future.md).\n",
            ),
          });
          const okf = yield* OkfService;

          const result = yield* okf.validate(root);

          expect(result.valid).toBe(true);
          expect(result.issues).toContainEqual(
            expect.objectContaining({ source: "graph", severity: "warning" }),
          );
        }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("should omit bundle edges when a link is external", () =>
      Effect.gen(function* () {
        const root = yield* makeBundle({
          "concept.md": concept(
            "type: Note",
            "Read the [spec](https://example.com/spec).\n",
          ),
        });
        const okf = yield* OkfService;

        const { graph } = yield* okf.make(root);

        expect(Array.from(Graph.edges(graph.graph))).toHaveLength(0);
        expect(graph.unresolvedLinks).toHaveLength(0);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "should create a provenance edge when a source references a concept",
      () =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "references/policy.md": concept("type: Policy"),
            "metrics/revenue.md": concept(
              [
                "type: Metric",
                "sources:",
                "  - id: revenue-policy",
                "    title: Revenue policy",
                "    resource: ../references/policy.md",
              ].join("\n"),
            ),
          });
          const okf = yield* OkfService;

          const { graph } = yield* okf.make(root);
          const edges = Array.from(Graph.edges(graph.graph));

          expect(edges).toHaveLength(1);
          expect(edges[0]?.[1].data).toEqual({
            kind: "citation",
            sourceId: "metrics/revenue",
            targetId: "references/policy",
            label: "Revenue policy",
            relation: "source",
          });
        }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "should omit provenance edges when a source escapes the bundle",
      () =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "target.md": concept("type: Policy"),
            "nested/source.md": concept(
              "type: Metric\nsources: [{ resource: ../../target.md }]",
            ),
          });
          const okf = yield* OkfService;

          const { graph } = yield* okf.make(root);

          expect(Array.from(Graph.edges(graph.graph))).toHaveLength(0);
        }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("§8, §9, and §12 — reserved files and versioning", () => {
    it.effect("should expose version 0.2 when the root index declares it", () =>
      Effect.gen(function* () {
        const root = yield* makeBundle({
          "index.md": '---\nokf_version: "0.2"\n---\n\n# Index\n',
          "concept.md": concept("type: Note"),
        });
        const okf = yield* OkfService;

        const { bundle } = yield* okf.make(root);

        expect(bundle.version).toBe("0.2");
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "should load best-effort when the declared version is unknown",
      () =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "index.md": '---\nokf_version: "0.99"\n---\n\n# Index\n',
            "concept.md": concept("type: Note"),
          });
          const okf = yield* OkfService;

          const result = yield* okf.validate(root);

          expect(result.valid).toBe(true);
        }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("should reject frontmatter when an index is nested", () =>
      Effect.gen(function* () {
        const root = yield* makeBundle({
          "nested/index.md": '---\nokf_version: "0.2"\n---\n\n# Nested\n',
        });
        const okf = yield* OkfService;

        const error = yield* Effect.flip(okf.validate(root));

        expect(error).toBeInstanceOf(BundleInvalid);
        expect(error).toMatchObject({ issues: [{ file: "nested/index.md" }] });
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("should accept a bundle when no index file exists", () =>
      Effect.gen(function* () {
        const root = yield* makeBundle({
          "concept.md": concept("type: Note"),
        });
        const okf = yield* OkfService;

        const result = yield* okf.validate(root);

        expect(result.valid).toBe(true);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("should accept log frontmatter when entries use ISO dates", () =>
      Effect.gen(function* () {
        const root = yield* makeBundle({
          "log.md": [
            "---",
            "type: Log",
            "title: Bundle history",
            "---",
            "",
            "# Log",
            "",
            "## 2026-09-01",
            "- **Update**: Added a concept.",
          ].join("\n"),
        });
        const okf = yield* OkfService;

        const result = yield* okf.validate(root);

        expect(result.valid).toBe(true);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect.each(["Recent", "2026-99-99"])(
      "should reject log.md when a level-two heading is $heading",
      (heading) =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "log.md": `# Log\n\n## ${heading}\n- Updated.\n`,
          });
          const okf = yield* OkfService;

          const error = yield* Effect.flip(okf.validate(root));

          expect(error).toBeInstanceOf(BundleInvalid);
          expect(error).toMatchObject({ issues: [{ file: "log.md" }] });
        }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("v0.2 consumer behavior", () => {
    it.effect(
      "should normalize verified to one item when encoded as a bare mapping (§11)",
      () =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "concept.md": concept(
              "type: Note\nverified: { by: human:reviewer, at: 2026-08-02T00:00:00Z }",
            ),
          });
          const okf = yield* OkfService;

          const { bundle } = yield* okf.make(root);
          const loadedConcept = bundle.concepts[0];

          expect(loadedConcept?.metadata.verified).toEqual([
            { by: "human:reviewer", at: "2026-08-02T00:00:00Z" },
          ]);
          expect(loadedConcept?.metadata.trustTier).toBe("human-reviewed");
        }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "should derive trust and staleness when lifecycle metadata is present",
      () =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "concept.md": concept(
              [
                "type: Note",
                "status: deprecated",
                "stale_after: 2026-09-01T00:00:00Z",
                "verified: { by: process:nightly, at: 2026-08-02T00:00:00Z }",
              ].join("\n"),
            ),
          });
          const okf = yield* OkfService;

          const { bundle } = yield* okf.make(root);
          const metadata = bundle.concepts[0]?.metadata;

          expect(metadata).toMatchObject({
            status: "deprecated",
            trustTier: "machine-confirmed",
          });
          expect(
            metadata === undefined
              ? false
              : isStaleAt(
                  metadata,
                  DateTime.makeUnsafe("2026-09-01T00:00:00Z"),
                ),
          ).toBe(true);
        }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "should avoid warnings when resource is a relative path (§6.2)",
      () =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "concept.md": concept("type: Note\nresource: references/source.md"),
          });
          const okf = yield* OkfService;

          const result = yield* okf.validate(root);

          expect(result.issues).toHaveLength(0);
        }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "should warn without invalidating when optional metadata is malformed",
      () =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "concept.md": concept(
              [
                "type: Note",
                "status: archived",
                "generated: unexpected scalar",
                "sources: { resource: source.md }",
              ].join("\n"),
            ),
          });
          const okf = yield* OkfService;

          const result = yield* okf.validate(root);

          expect(result.valid).toBe(true);
          expect(result.issues).toContainEqual(
            expect.objectContaining({
              reason: expect.stringContaining("Invalid OKF v0.2 metadata"),
              severity: "warning",
            }),
          );
        }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "should preserve valid metadata when another family is malformed",
      () =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "policy.md": concept("type: Policy"),
            "computation.md": concept(
              [
                "type: Attested Computation",
                "status: archived",
                "runtime: bigquery",
                "verified: { by: human:reviewer, at: 2026-08-02T00:00:00Z }",
                "sources: [{ resource: policy.md }]",
              ].join("\n"),
            ),
          });
          const okf = yield* OkfService;

          const { bundle, graph } = yield* okf.make(root);
          const metadata = bundle.concepts.find(
            ({ id }) => id === "computation",
          )?.metadata;
          const result = yield* okf.validate(root);

          expect(metadata).toMatchObject({
            runtime: "bigquery",
            trustTier: "human-reviewed",
            sources: [{ resource: "policy.md" }],
          });
          expect(Array.from(Graph.edges(graph.graph))).toHaveLength(1);
          expect(result.issues).toContainEqual(
            expect.objectContaining({
              reason: expect.stringContaining("Invalid OKF v0.2 metadata"),
            }),
          );
          expect(result.issues).not.toContainEqual(
            expect.objectContaining({
              reason: "Attested Computation requires a non-empty runtime",
            }),
          );
        }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("should warn when an Attested Computation has no runtime", () =>
      Effect.gen(function* () {
        const root = yield* makeBundle({
          "computation.md": concept(
            "type: Attested Computation",
            "# Computation\n\n```sql\nSELECT 1\n```\n",
          ),
        });
        const okf = yield* OkfService;

        const result = yield* okf.validate(root);

        expect(result.valid).toBe(true);
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            reason: "Attested Computation requires a non-empty runtime",
            severity: "warning",
          }),
        );
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect.each([
      {
        field: "generated.at",
        frontmatter:
          "type: Note\ngenerated: { by: agent/1.0, at: 2026-08-01T00:00:00 }",
      },
      {
        field: "verified[0].at",
        frontmatter:
          "type: Note\nverified: { by: process:nightly, at: 2026-08-01T00:00:00 }",
      },
      {
        field: "stale_after",
        frontmatter: "type: Note\nstale_after: 2026-08-01T00:00:00",
      },
      {
        field: "sources[0].last_modified",
        frontmatter:
          "type: Note\nsources: [{ resource: source.md, last_modified: 2026-08-01T00:00:00 }]",
      },
      {
        field: "usage_window.from",
        frontmatter:
          "type: Note\nusage_window: { from: 2026-08-01T00:00:00, to: 2026-09-01T00:00:00Z }",
      },
      {
        field: "usage_window.to",
        frontmatter:
          "type: Note\nusage_window: { from: 2026-08-01T00:00:00Z, to: 2026-09-01T00:00:00 }",
      },
      {
        field: "sources[0].usage_window.from",
        frontmatter:
          "type: Note\nsources: [{ resource: source.md, usage_window: { from: 2026-08-01T00:00:00, to: 2026-09-01T00:00:00Z } }]",
      },
      {
        field: "sources[0].usage_window.to",
        frontmatter:
          "type: Note\nsources: [{ resource: source.md, usage_window: { from: 2026-08-01T00:00:00Z, to: 2026-09-01T00:00:00 } }]",
      },
    ])(
      "should warn when $field has no explicit UTC offset (§5)",
      ({ frontmatter }) =>
        Effect.gen(function* () {
          const root = yield* makeBundle({
            "concept.md": concept(frontmatter),
          });
          const okf = yield* OkfService;

          const result = yield* okf.validate(root);

          expect(result.issues).toContainEqual(
            expect.objectContaining({
              id: "concept",
              source: "concept",
              reason: expect.stringContaining(
                "expected an ISO 8601 datetime with an explicit UTC offset",
              ),
              severity: "warning",
            }),
          );
        }).pipe(Effect.provide(TestLayer)),
    );
  });
});
