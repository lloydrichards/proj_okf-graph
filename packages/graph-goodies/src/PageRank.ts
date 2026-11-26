/**
 * Ranks Effect Graph nodes by the long-run visit frequency of a random walk.
 *
 * @module
 */

import { Effect, Graph, Schema } from "effect";

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
  readonly scores: ReadonlyMap<Graph.NodeIndex, number>;
  readonly iterations: number;
  readonly residual: number;
  readonly converged: boolean;
};

/** A PageRank option is outside its accepted range or references a missing node. */
export class InvalidPageRankOptions extends Schema.TaggedError<
  InvalidPageRankOptions,
  { readonly brand: unique symbol }
>()("InvalidPageRankOptions", {
  option: Schema.Literals(["alpha", "tolerance", "maxIterations", "restart"]),
  message: Schema.String,
}) {}

/**
 * Runs PageRank on a directed or undirected Effect graph. Each edge contributes
 * one possible step, including parallel edges and self-loops. Undirected edges
 * allow travel both ways, with a self-loop counted once. Edge payloads are ignored.
 *
 * At a dead end the walk restarts from the same distribution used for random
 * restarts. Supply finite non-negative weights with at least one positive
 * weight to personalize that distribution. Scores are keyed by graph node
 * index. An empty graph returns an empty result with zero iterations when
 * restart weights are omitted.
 *
 * The final residual is the sum of absolute score changes in the last step.
 * If the iteration limit is reached before the residual meets the tolerance,
 * the scores still describe the final iterate and `converged` is false.
 */
export const pageRank = Effect.fnUntraced(function* <
  N,
  E,
  K extends Graph.Kind,
>(
  graph: Graph.Graph<N, E, K>,
  options: PageRankOptions = {},
): Effect.fn.Return<PageRankResult, InvalidPageRankOptions> {
  const {
    alpha = 0.85,
    tolerance = 1e-6,
    maxIterations = 100,
    restart,
  } = options;
  if (!Number.isFinite(alpha) || alpha < 0 || alpha >= 1) {
    return yield* new InvalidPageRankOptions({
      option: "alpha",
      message: "Alpha must be at least 0 and less than 1.",
    });
  }
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    return yield* new InvalidPageRankOptions({
      option: "tolerance",
      message: "Tolerance must be positive and finite.",
    });
  }
  if (!Number.isSafeInteger(maxIterations) || maxIterations < 1) {
    return yield* new InvalidPageRankOptions({
      option: "maxIterations",
      message: "Maximum iterations must be a positive safe integer.",
    });
  }

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
      if (slot === undefined || !Number.isFinite(weight) || weight < 0) {
        return yield* new InvalidPageRankOptions({
          option: "restart",
          message: `Restart weight for node ${id} must be finite, non-negative, and refer to a graph node.`,
        });
      }
      weights[slot] = weight;
      largest = Math.max(largest, weight);
    }
    if (largest === 0) {
      return yield* new InvalidPageRankOptions({
        option: "restart",
        message: "At least one restart weight must be positive.",
      });
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
  } while (residual > tolerance && iterations < maxIterations);

  return {
    scores: new Map(nodes.map((id, slot) => [id, current[slot]!])),
    iterations,
    residual,
    converged: residual <= tolerance,
  };
});
