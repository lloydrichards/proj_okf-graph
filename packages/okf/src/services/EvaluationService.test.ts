import { describe, expect, it } from "@effect/vitest";
import { EvaluationReport } from "@repo/domain/Evaluation";
import { type Bundle, graphFromBundle } from "@repo/domain/Okf";
import { Effect, Layer, Schema } from "effect";
import { BundleNotFound, EvaluationService, OkfService } from "@repo/okf";

const bundle: Bundle = {
  root: "/test",
  concepts: [
    {
      id: "alpha",
      path: "alpha.md",
      frontmatter: { type: "Note", title: "Alpha" },
      metadata: {
        verified: [],
        sources: [],
        status: "stable",
        trustTier: "unverified",
        parameters: [],
      },
      metadataIssues: [],
      body: "Alpha body",
      document: { blocks: [] },
      links: [],
    },
  ],
  indexFiles: [],
  logFiles: [],
};

const graph = graphFromBundle(bundle);

type OkfServiceShape = Effect.Success<typeof OkfService.make>;
type OkfMakeResult = Effect.Success<ReturnType<OkfServiceShape["make"]>>;

const makeEvaluationLayer = (make: OkfServiceShape["make"]) =>
  EvaluationService.layer.pipe(
    Layer.provide(Layer.mock(OkfService, { make })),
    Layer.satisfiesServicesType<never>(),
  );

describe("EvaluationService", () => {
  it.effect(
    "should return a schema-valid report when the bundle resolves",
    () => {
      const evaluationLayer = makeEvaluationLayer(
        Effect.fn("OkfService.make.test")(() =>
          Effect.succeed({ bundle, graph } as OkfMakeResult),
        ),
      );

      return Effect.gen(function* () {
        const service = yield* EvaluationService;
        const report = yield* service.evaluate("./knowledge");

        expect(() => Schema.decodeSync(EvaluationReport)(report)).not.toThrow();
        expect(report.bundle.metrics).toMatchObject({ conceptCount: 1 });
        expect(report.connectivity.metrics).toMatchObject({
          outboundLinkCoverage: 0,
          isolatedRate: 1,
        });
      }).pipe(Effect.provide(evaluationLayer));
    },
  );

  it.effect.each([
    {
      source: "generated.at",
      frontmatter: { type: "Note" },
      metadata: {
        generated: { by: "agent/1.0", at: "2026-08-01T00:00:00Z" },
      },
    },
    {
      source: "legacy timestamp",
      frontmatter: { type: "Note", timestamp: "2026-08-01T00:00:00Z" },
      metadata: {},
    },
  ])("counts timestamp coverage from $source", ({ frontmatter, metadata }) => {
    const datedBundle: Bundle = {
      ...bundle,
      concepts: bundle.concepts.map((concept) => ({
        ...concept,
        frontmatter,
        metadata: { ...concept.metadata, ...metadata },
      })),
    };
    const evaluationLayer = makeEvaluationLayer(() =>
      Effect.succeed({
        bundle: datedBundle,
        graph: graphFromBundle(datedBundle),
      } as OkfMakeResult),
    );

    return Effect.gen(function* () {
      const service = yield* EvaluationService;
      const report = yield* service.evaluate("./knowledge");

      expect(report.bundle.metrics.metadataCoverage.timestamp).toBe(1);
    }).pipe(Effect.provide(evaluationLayer));
  });

  it.effect(
    "should preserve the source failure when bundle resolution fails",
    () => {
      const error = new BundleNotFound({ path: "missing" });
      const evaluationLayer = makeEvaluationLayer(() => Effect.fail(error));

      return Effect.gen(function* () {
        const service = yield* EvaluationService;
        const failure = yield* Effect.flip(service.evaluate("missing"));

        expect(failure).toBe(error);
      }).pipe(Effect.provide(evaluationLayer));
    },
  );
});
