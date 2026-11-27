/**
 * Analyze where a random walk on an Effect graph can go within a fixed budget.
 *
 * @module
 */

import { Effect, Graph, Option, Schema } from "effect";

/** Selects the start, stopping targets, and maximum number of traversed edges. */
export type FirstHitQuery = {
  readonly source: Graph.NodeIndex;
  readonly targets: ReadonlyArray<Graph.NodeIndex>;
  readonly maxSteps: number;
};

/** Probabilities of reaching a target, stopping at a dead end, or still moving. */
export type FirstHitResult = {
  /** First-hit probability by step and target. Steps and targets with no hit are omitted. */
  readonly hitsByStep: ReadonlyMap<
    number,
    ReadonlyMap<Graph.NodeIndex, number>
  >;
  /** Probability of reaching a non-target node without outgoing edges by the horizon. */
  readonly deadEndProbability: number;
  /** Probability of reaching the horizon without hitting a target or dead end. */
  readonly remainingProbability: number;
};

/** The step budget is outside the accepted range. */
export class InvalidWalkHorizon extends Schema.TaggedError<
  InvalidWalkHorizon,
  { readonly brand: unique symbol }
>()("InvalidWalkHorizon", { maxSteps: Schema.Number }) {}

/** The query names a source or target that does not exist in the graph. */
export class UnknownWalkNode extends Schema.TaggedError<
  UnknownWalkNode,
  { readonly brand: unique symbol }
>()("UnknownWalkNode", {
  role: Schema.Literals(["source", "target"]),
  node: Schema.Number,
}) {}

const WalkHorizon = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const isWalkHorizon = Schema.is(WalkHorizon);

/**
 * Calculates when a random walk first reaches each target within a step budget.
 *
 * **Details**
 *
 * The walk starts at the source at step zero. At each step it chooses uniformly
 * among the current node's outgoing edges. Parallel edges are separate choices,
 * self-loops take one step, and edge payloads do not affect the walk. Hitting a
 * target stops that part of the walk. Reaching any other node with no outgoing
 * edges counts as a dead-end stop, including at step zero or the horizon.
 *
 * Targets are treated as a set. With no targets, the result reports only
 * dead-end and remaining probability. The three outcomes sum to one within
 * floating-point precision. The horizon must be a non-negative safe integer.
 * Runtime can grow with the horizon even without hits, and the result retains
 * a map for each step with hits. Choose a horizon that fits the query budget.
 *
 * **Example**
 *
 * ```ts
 * import * as RandomWalk from "@repo/graph-goodies/RandomWalk";
 * import { Effect, Graph } from "effect";
 *
 * const graph = Graph.directed<string, undefined>((graph) => {
 *   const start = Graph.addNode(graph, "Start");
 *   const goal = Graph.addNode(graph, "Goal");
 *   Graph.addEdge(graph, start, start, undefined);
 *   Graph.addEdge(graph, start, goal, undefined);
 * });
 *
 * const result = await Effect.runPromise(
 *   RandomWalk.firstHitWithin(graph, { source: 0, targets: [1], maxSteps: 2 }),
 * );
 * // The goal is first hit with probability 0.5 at step 1 and 0.25 at step 2.
 * // The remaining 0.25 is still at Start.
 * ```
 */
export const firstHitWithin = Effect.fnUntraced(function* <N, E>(
  graph: Graph.DirectedGraph<N, E>,
  query: FirstHitQuery,
): Effect.fn.Return<FirstHitResult, InvalidWalkHorizon | UnknownWalkNode> {
  const { source, maxSteps } = query;
  if (!isWalkHorizon(maxSteps)) {
    return yield* new InvalidWalkHorizon({ maxSteps });
  }
  if (!Graph.hasNode(graph, source)) {
    return yield* new UnknownWalkNode({ role: "source", node: source });
  }
  const targets = new Set(query.targets);
  for (const target of targets) {
    if (!Graph.hasNode(graph, target)) {
      return yield* new UnknownWalkNode({ role: "target", node: target });
    }
  }

  const hitsByStep = new Map<number, ReadonlyMap<Graph.NodeIndex, number>>();
  const adjacency = new Map<
    Graph.NodeIndex,
    {
      readonly degree: number;
      readonly multiplicities: ReadonlyMap<Graph.NodeIndex, number>;
    }
  >();
  let frontier = new Map([[source, 1]]);
  let deadEndProbability = 0;
  let remainingProbability = 0;
  for (let step = 0; frontier.size > 0; step++) {
    const hits = new Map<Graph.NodeIndex, number>();
    const next = new Map<Graph.NodeIndex, number>();
    for (const [node, probability] of frontier) {
      if (targets.has(node)) {
        hits.set(node, probability);
        continue;
      }

      let outgoing = adjacency.get(node);
      if (outgoing === undefined) {
        const edges = Graph.outgoingEdges(graph, node);
        const multiplicities = new Map<Graph.NodeIndex, number>();
        for (const edge of edges) {
          const { target } = Option.getOrThrow(Graph.getEdge(graph, edge));
          multiplicities.set(target, (multiplicities.get(target) ?? 0) + 1);
        }
        outgoing = { degree: edges.length, multiplicities };
        adjacency.set(node, outgoing);
      }
      if (outgoing.degree === 0) {
        deadEndProbability += probability;
      } else if (step === maxSteps) {
        remainingProbability += probability;
      } else {
        for (const [target, multiplicity] of outgoing.multiplicities) {
          const share = probability * (multiplicity / outgoing.degree);
          if (share === 0) continue;
          next.set(target, (next.get(target) ?? 0) + share);
        }
      }
    }

    if (hits.size > 0) hitsByStep.set(step, hits);
    if (step === maxSteps) break;

    frontier = next;
    if (frontier.size > 0) yield* Effect.yieldNow;
  }

  return { hitsByStep, deadEndProbability, remainingProbability };
});
