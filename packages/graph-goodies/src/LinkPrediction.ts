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

/** A two-hop candidate with its degree-discounted support score. */
export type RankedTwoHopCandidate = TwoHopCandidate & {
  /** Sum of inverse out-degrees across the distinct intermediate nodes. */
  readonly score: number;
};

/** Raised when a two-hop query names a source absent from the graph. */
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

const collectTwoHopEvidence = <N, E>(
  graph: Graph.DirectedGraph<N, E>,
  source: Graph.NodeIndex,
) => {
  const direct = new Set(Graph.successors(graph, source));
  const witnesses = new Map<Graph.NodeIndex, Array<Graph.NodeIndex>>();
  const degrees = new Map<Graph.NodeIndex, number>();
  for (const intermediate of direct) {
    const targets = Graph.successors(graph, intermediate);
    degrees.set(intermediate, targets.length);
    for (const target of targets) {
      if (target === source || direct.has(target)) continue;

      const existing = witnesses.get(target);
      if (existing === undefined) {
        witnesses.set(target, [intermediate]);
      } else {
        existing.push(intermediate);
      }
    }
  }

  const candidates = Array.from(witnesses, ([target, intermediates]) => ({
    target,
    intermediates: intermediates.sort(Order.Number),
  }));

  return { candidates, degrees };
};

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

  return collectTwoHopEvidence(graph, source).candidates.sort(
    candidatesBySupport,
  );
});

const candidatesByScore = Order.combine(
  Order.flip(
    Order.mapInput(
      Order.Number,
      (candidate: RankedTwoHopCandidate) => candidate.score,
    ),
  ),
  Order.mapInput(
    Order.Number,
    (candidate: RankedTwoHopCandidate) => candidate.target,
  ),
);

/**
 * Ranks missing outgoing edges by giving more weight to focused intermediates.
 *
 * **Details**
 *
 * Uses the same candidates and witnesses as {@link twoHopCandidates}. Each
 * witness contributes one divided by its number of distinct successors,
 * including successors that are ineligible as candidates. Parallel links
 * count once towards that degree. Contributions are summed in ascending degree order. Results sort by decreasing score, then
 * ascending target index for equal scores.
 */
export const rankTwoHopCandidates = Effect.fnUntraced(function* <N, E>(
  graph: Graph.DirectedGraph<N, E>,
  source: Graph.NodeIndex,
): Effect.fn.Return<
  ReadonlyArray<RankedTwoHopCandidate>,
  UnknownLinkPredictionSource
> {
  if (!Graph.hasNode(graph, source)) {
    return yield* new UnknownLinkPredictionSource({ source });
  }

  const { candidates, degrees } = collectTwoHopEvidence(graph, source);
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: candidate.intermediates
        .map((intermediate) => degrees.get(intermediate)!)
        .sort(Order.Number)
        .reduce((score, degree) => score + 1 / degree, 0),
    }))
    .sort(candidatesByScore);
});
