import type { EvaluationReport } from "@repo/domain/Evaluation";
import { EvaluationReport as EvaluationReportSchema } from "@repo/domain/Evaluation";
import { Context, Effect, Layer } from "effect";
import { evaluateBundle } from "../evaluation/BundleEvaluation";
import { evaluateConnectivity } from "../evaluation/ConnectivityEvaluation";
import { makeEvaluationTopology } from "../evaluation/EvaluationTopology";
import { evaluateNavigation } from "../evaluation/NavigationEvaluation";
import { evaluateStructure } from "../evaluation/StructuralEvaluation";
import { OkfService } from "./OkfService";

type OkfServiceShape = Effect.Success<typeof OkfService.make>;
type EvaluationError = Effect.Error<ReturnType<OkfServiceShape["make"]>>;

export type EvaluationServiceShape = {
  readonly evaluate: (
    source: string,
  ) => Effect.Effect<EvaluationReport, EvaluationError>;
};

export class EvaluationService extends Context.Service<
  EvaluationService,
  EvaluationServiceShape
>()("@repo/EvaluationService") {
  static readonly make = Effect.gen(function* () {
    const okf = yield* OkfService;

    const evaluate = Effect.fn("EvaluationService.evaluate")(function* (
      source: string,
    ) {
      const { bundle, graph } = yield* okf.make(source);
      const topology = makeEvaluationTopology(bundle, graph);

      return EvaluationReportSchema.make({
        bundle: evaluateBundle(bundle),
        connectivity: evaluateConnectivity(topology),
        structure: evaluateStructure(topology),
        navigation: evaluateNavigation(topology),
      });
    });

    return { evaluate } satisfies EvaluationServiceShape;
  });

  static readonly Live = Layer.effect(this, this.make).pipe(
    Layer.satisfiesServicesType<OkfService>(),
  );
}
