/**
 * Finds candidate edges and the intermediate nodes that support them.
 *
 * @module
 */

import { Effect, Graph, Order, Schema } from "effect";

/** A proposed target with the intermediate nodes that connect it to the source. */
export type TwoHopCandidate = {
  readonly target: Graph.NodeIndex;
  /** Unique intermediate node indices, in ascending order. */
  readonly intermediates: ReadonlyArray<Graph.NodeIndex>;
};

/** Raised when the source index passed to {@link twoHopCandidates} is absent. */
export class UnknownLinkPredictionSource extends Schema.TaggedError<
  UnknownLinkPredictionSource,
  { readonly brand: unique symbol }
>()("UnknownLinkPredictionSource", { source: Schema.Number }) {}

const candidatesBySupport = Order.combine(
  Order.flip(
    Order.mapInput(
      Order.Number,
      (candidate: TwoHopCandidate) => candidate.intermediates.length,
    ),
  ),
  Order.mapInput(
    Order.Number,
    (candidate: TwoHopCandidate) => candidate.target,
  ),
);

/**
 * Finds missing outgoing edges supported by directed two-step routes from
 * the source.
 *
 * **Details**
 *
 * A candidate is a target reached through an intermediate node. Targets
 * already linked from the source and the source itself are excluded.
 * Parallel edges count as one connection between the same nodes. Candidates
 * are ordered by decreasing number of distinct intermediates, then by
 * ascending target index. A known source with no candidates returns an empty
 * array.
 *
 * **Example**
 *
 * ```ts
 * import * as LinkPrediction from "@repo/graph-goodies/LinkPrediction";
 * import { Effect, Graph } from "effect";
 *
 * const graph = Graph.directed<string, undefined>((graph) => {
 *   const start = Graph.addNode(graph, "Start");
 *   const guide = Graph.addNode(graph, "Guide");
 *   const reference = Graph.addNode(graph, "Reference");
 *   Graph.addEdge(graph, start, guide, undefined);
 *   Graph.addEdge(graph, guide, reference, undefined);
 * });
 *
 * const candidates = Effect.runSync(LinkPrediction.twoHopCandidates(graph, 0));
 * // [{ target: 2, intermediates: [1] }]
 * ```
 */
export const twoHopCandidates = Effect.fnUntraced(function* <N, E>(
  graph: Graph.DirectedGraph<N, E>,
  source: Graph.NodeIndex,
): Effect.fn.Return<
  ReadonlyArray<TwoHopCandidate>,
  UnknownLinkPredictionSource
> {
  if (!Graph.hasNode(graph, source)) {
    return yield* new UnknownLinkPredictionSource({ source });
  }

  const direct = new Set(Graph.successors(graph, source));
  const witnesses = new Map<Graph.NodeIndex, Array<Graph.NodeIndex>>();
  for (const intermediate of direct) {
    for (const target of Graph.successors(graph, intermediate)) {
      if (target === source || direct.has(target)) continue;

      const existing = witnesses.get(target);
      if (existing === undefined) {
        witnesses.set(target, [intermediate]);
      } else {
        existing.push(intermediate);
      }
    }
  }

  return Array.from(witnesses, ([target, intermediates]) => ({
    target,
    intermediates: intermediates.sort(Order.Number),
  })).sort(candidatesBySupport);
});
