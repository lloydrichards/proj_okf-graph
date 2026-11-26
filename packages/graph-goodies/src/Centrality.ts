/**
 * Measure how individual nodes contribute to the structure of an Effect graph.
 *
 * PageRank estimates how often a random walk visits each node in an Effect graph.
 * Use uniform restarts to rank the whole graph or supply weights to center
 * the walk on selected nodes.
 *
 * @module
 */

import { Effect, Graph, Schema, SchemaIssue } from "effect";

/** Controls the random walk and its convergence. */
export type PageRankOptions = {
  /** Probability of following a link. Defaults to 0.85. */
  readonly alpha?: number;
  /** Maximum sum of absolute score changes for convergence. Defaults to 1e-6. */
  readonly tolerance?: number;
  /** Limit on power iterations. Defaults to 100. */
  readonly maxIterations?: number;
  /** Relative restart weights. Omitted nodes get zero weight. Defaults to uniform. */
  readonly restart?: ReadonlyMap<Graph.NodeIndex, number>;
};

/** Reports the estimated visit probabilities and the final iteration status. */
export type PageRankResult = {
  /** Estimated visit probability by node index. The scores sum to one within floating-point precision for a non-empty graph. */
  readonly scores: ReadonlyMap<Graph.NodeIndex, number>;
  /** Number of power iterations performed. */
  readonly iterations: number;
  /** Sum of absolute score changes in the final iteration, or zero for an empty graph. */
  readonly residual: number;
  /** Whether the final residual is at or below the tolerance. */
  readonly converged: boolean;
};

const Options = Schema.Struct({
  alpha: Schema.Finite.check(
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThan(1),
  ).pipe(Schema.withDecodingDefault(Effect.succeed(0.85))),
  tolerance: Schema.Finite.check(Schema.isGreaterThan(0)).pipe(
    Schema.withDecodingDefault(Effect.succeed(1e-6)),
  ),
  maxIterations: Schema.Int.check(Schema.isGreaterThan(0)).pipe(
    Schema.withDecodingDefault(Effect.succeed(100)),
  ),
  restart: Schema.optional(
    Schema.ReadonlyMap(
      Schema.Number,
      Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
    ).check(
      Schema.makeFilter((weights) =>
        Array.from(weights.values()).some((weight) => weight > 0)
          ? undefined
          : "At least one restart weight must be positive.",
      ),
    ),
  ),
});

const OptionName = Schema.Literals([
  "alpha",
  "tolerance",
  "maxIterations",
  "restart",
]);
const isOptionName = Schema.is(OptionName);
const formatOptionIssue = SchemaIssue.makeFormatterStandardSchemaV1();

/** Raised by {@link pageRank} when an option is invalid. The `option` field identifies the rejected setting, or is `"options"` for an invalid options object. */
export class InvalidPageRankOptions extends Schema.TaggedError<
  InvalidPageRankOptions,
  { readonly brand: unique symbol }
>()("InvalidPageRankOptions", {
  option: Schema.Union([OptionName, Schema.Literal("options")]),
  message: Schema.String,
}) {}

/**
 * Estimates the long-run visit probability of each node in a directed or
 * undirected graph.
 *
 * **Details**
 *
 * Each edge contributes one possible step. Parallel edges count separately.
 * Undirected edges allow travel both ways, with a self-loop counted once.
 * The walk ignores edge payloads.
 *
 * The walk uses the same restart distribution at dead ends and for random
 * restarts. Supply finite, non-negative weights for existing nodes, with at
 * least one positive weight, to personalize that distribution. An empty graph
 * returns an empty ranking when you omit restart weights. Invalid options fail
 * with {@link InvalidPageRankOptions}.
 *
 * If the iteration limit is reached before convergence, the result contains
 * the last estimate with `converged` set to `false`. The effect yields
 * between iterations so other fibers can run and interrupt it.
 *
 * **Example**
 *
 * ```ts
 * import * as Centrality from "@repo/graph-goodies/Centrality";
 * import { Effect, Graph } from "effect";
 *
 * const graph = Graph.directed<string, undefined>((graph) => {
 *   const start = Graph.addNode(graph, "Start");
 *   const guide = Graph.addNode(graph, "Guide");
 *   Graph.addEdge(graph, start, guide, undefined);
 * });
 *
 * const result = Effect.runSync(Centrality.pageRank(graph, { alpha: 0.5 }));
 * // Scores are approximately 0.4 for Start and 0.6 for Guide.
 * ```
 */
export const pageRank = Effect.fnUntraced(function* <
  N,
  E,
  K extends Graph.Kind,
>(
  graph: Graph.Graph<N, E, K>,
  options: PageRankOptions = {},
): Effect.fn.Return<PageRankResult, InvalidPageRankOptions> {
  const { alpha, tolerance, maxIterations, restart } =
    yield* Schema.decodeUnknownEffect(Options)(options).pipe(
      Effect.mapError((error) => {
        const key = formatOptionIssue(error.issue).issues[0]?.path?.[0];

        return new InvalidPageRankOptions({
          option: isOptionName(key) ? key : "options",
          message: error.message,
        });
      }),
    );

  const nodes = Array.from(Graph.nodes(graph), ([id]) => id);
  const slots = new Map(nodes.map((id, slot) => [id, slot]));
  const weights = new Float64Array(nodes.length);
  if (restart === undefined) {
    if (nodes.length === 0) {
      return { scores: new Map(), iterations: 0, residual: 0, converged: true };
    }
    weights.fill(1 / nodes.length);
  } else {
    let largest = 0;
    for (const [id, weight] of restart) {
      const slot = slots.get(id);
      if (slot === undefined) {
        return yield* new InvalidPageRankOptions({
          option: "restart",
          message: `Restart weight for node ${id} must refer to a graph node.`,
        });
      }
      weights[slot] = weight;
      largest = Math.max(largest, weight);
    }
    // Scale before summing so large finite weights cannot overflow.
    const total = weights.reduce((sum, weight) => sum + weight / largest, 0);
    for (const slot of weights.keys()) {
      weights[slot] = weights[slot]! / largest / total;
    }
  }

  const outgoing = nodes.map((): number[] => []);
  for (const [, edge] of Graph.edges(graph)) {
    const source = slots.get(edge.source)!;
    const target = slots.get(edge.target)!;
    outgoing[source]!.push(target);
    if (graph.type === "undirected" && source !== target) {
      outgoing[target]!.push(source);
    }
  }

  let current = weights.slice();
  let residual = 0;
  let iterations = 0;
  do {
    let dangling = 0;
    for (const [slot, targets] of outgoing.entries()) {
      if (targets.length === 0) dangling += current[slot]!;
    }

    const next = weights.map(
      (weight) => (1 - alpha + alpha * dangling) * weight,
    );
    for (const [slot, targets] of outgoing.entries()) {
      if (targets.length === 0) continue;
      const share = (alpha * current[slot]!) / targets.length;
      for (const target of targets) next[target] = next[target]! + share;
    }

    residual = next.reduce(
      (sum, score, slot) => sum + Math.abs(score - current[slot]!),
      0,
    );
    current = next;
    iterations++;
    if (residual > tolerance && iterations < maxIterations) {
      yield* Effect.yieldNow;
    }
  } while (residual > tolerance && iterations < maxIterations);

  return {
    scores: new Map(nodes.map((id, slot) => [id, current[slot]!])),
    iterations,
    residual,
    converged: residual <= tolerance,
  };
});
