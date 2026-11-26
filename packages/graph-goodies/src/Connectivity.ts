/**
 * Analyzes which nodes and edges keep routes open in a graph.
 *
 * @module
 */

import { Effect, Graph, Order, Schema } from "effect";

/** A connectivity query names a start node that is absent from the graph. */
export class UnknownStartNode extends Schema.TaggedError<
  UnknownStartNode,
  { readonly brand: unique symbol }
>()("UnknownStartNode", { start: Schema.Number }) {}

/**
 * Returns the nodes that every directed path from `start` to each reachable
 * node must visit.
 *
 * **Details**
 *
 * The map includes the start node, whose only dominator is itself. Every other
 * reachable node also dominates itself. Unreachable nodes have no map entry.
 * Parallel edges and self-loops do not change which nodes dominate a target.
 * A missing start fails with {@link UnknownStartNode}.
 *
 * The calculation intersects predecessor sets until they stop shrinking. It
 * can use quadratic space in the number of reachable nodes when many nodes
 * dominate each other, as in a long chain.
 *
 * **Example**
 *
 * ```ts
 * import * as Connectivity from "@repo/graph-goodies/Connectivity";
 * import { Effect, Graph } from "effect";
 *
 * const graph = Graph.directed<string, undefined>();
 * const mutable = Graph.beginMutation(graph);
 * const start = Graph.addNode(mutable, "Start");
 * const bridge = Graph.addNode(mutable, "Bridge");
 * const end = Graph.addNode(mutable, "End");
 * Graph.addEdge(mutable, start, bridge, undefined);
 * Graph.addEdge(mutable, bridge, end, undefined);
 *
 * const result = Effect.runSync(
 *   Connectivity.dominators(Graph.endMutation(mutable), start),
 * );
 * // result.get(end) contains start, bridge, and end.
 * ```
 */
export const dominators = Effect.fnUntraced(function* <N, E>(
  graph: Graph.DirectedGraph<N, E>,
  start: Graph.NodeIndex,
): Effect.fn.Return<
  ReadonlyMap<Graph.NodeIndex, ReadonlySet<Graph.NodeIndex>>,
  UnknownStartNode
> {
  if (!Graph.hasNode(graph, start)) {
    return yield* new UnknownStartNode({ start });
  }

  const reachable = new Set(
    Graph.indices(Graph.bfs(graph, { start: [start] })),
  );
  const result = new Map(
    Array.from(reachable, (node) => [
      node,
      node === start ? new Set([start]) : reachable,
    ]),
  );
  const remaining = Array.from(reachable)
    .filter((node) => node !== start)
    .map((node) => ({
      node,
      predecessors: Graph.predecessors(graph, node).filter((parent) =>
        reachable.has(parent),
      ),
    }));

  let changed: boolean;
  do {
    changed = false;
    for (const { node, predecessors } of remaining) {
      const previous = result.get(node)!;
      const next = new Set(
        Array.from(previous).filter(
          (candidate) =>
            candidate === node ||
            predecessors.every((parent) => result.get(parent)!.has(candidate)),
        ),
      );
      if (next.size < previous.size) {
        result.set(node, next);
        changed = true;
      }
    }
  } while (changed);

  return result;
});

/** A minimum edge cut needs two distinct nodes that exist in the graph. */
export class InvalidEdgeCutEndpoints extends Schema.TaggedError<
  InvalidEdgeCutEndpoints,
  { readonly brand: unique symbol }
>()("InvalidEdgeCutEndpoints", {
  source: Schema.Number,
  target: Schema.Number,
  reason: Schema.Literals(["unknownSource", "unknownTarget", "sameNode"]),
}) {}

type FlowEdge = {
  readonly id: Graph.EdgeIndex;
  readonly source: Graph.NodeIndex;
  readonly target: Graph.NodeIndex;
  flow: number;
};

type ResidualStep = {
  readonly edge: FlowEdge;
  readonly from: Graph.NodeIndex;
  readonly to: Graph.NodeIndex;
  readonly direction: 1 | -1;
};

const residualSearch = (
  outgoing: ReadonlyMap<Graph.NodeIndex, ReadonlyArray<ResidualStep>>,
  source: Graph.NodeIndex,
  lowerBound: number,
): Map<Graph.NodeIndex, ResidualStep | undefined> => {
  const parents = new Map<Graph.NodeIndex, ResidualStep | undefined>([
    [source, undefined],
  ]);
  const queue = [source];
  for (const node of queue) {
    for (const step of outgoing.get(node) ?? []) {
      if (parents.has(step.to)) continue;
      const nextFlow = step.edge.flow + step.direction;
      if (nextFlow < lowerBound || nextFlow > 1) continue;

      parents.set(step.to, step);
      queue.push(step.to);
    }
  }

  return parents;
};

/**
 * Returns the original edge indices in a smallest set whose removal blocks
 * travel from source to target.
 *
 * **Details**
 *
 * Each edge costs one removal. Parallel edges count separately, and self-loops
 * and edge payloads have no effect. Directed edges can only be followed in
 * the stored source-to-target direction. Undirected edges may be followed either way.
 * An already unreachable target returns an empty set.
 *
 * If several cuts have the same size, this returns the one whose source side
 * contains the fewest nodes.
 * Its edge indices are returned in ascending order. Unknown or identical
 * endpoints fail with {@link InvalidEdgeCutEndpoints}.
 *
 * **Example**
 *
 * ```ts
 * import * as Connectivity from "@repo/graph-goodies/Connectivity";
 * import { Effect, Graph } from "effect";
 *
 * const graph = Graph.directed<string, undefined>((graph) => {
 *   const start = Graph.addNode(graph, "Start");
 *   const left = Graph.addNode(graph, "Left");
 *   const right = Graph.addNode(graph, "Right");
 *   const end = Graph.addNode(graph, "End");
 *   Graph.addEdge(graph, start, left, undefined);
 *   Graph.addEdge(graph, left, end, undefined);
 *   Graph.addEdge(graph, start, right, undefined);
 *   Graph.addEdge(graph, right, end, undefined);
 * });
 *
 * const dominators = Effect.runSync(Connectivity.dominators(graph, 0));
 * // dominators.get(3) is Set { 0, 3 }. Neither intermediate node is required.
 * const cut = await Effect.runPromise(
 *   Connectivity.minimumEdgeCut(graph, { source: 0, target: 3 }),
 * );
 * // cut is Set { 0, 2 }. Removing one link from each route blocks access.
 * ```
 */
export const minimumEdgeCut = Effect.fnUntraced(function* <
  N,
  E,
  K extends Graph.Kind,
>(
  graph: Graph.Graph<N, E, K>,
  endpoints: {
    readonly source: Graph.NodeIndex;
    readonly target: Graph.NodeIndex;
  },
): Effect.fn.Return<ReadonlySet<Graph.EdgeIndex>, InvalidEdgeCutEndpoints> {
  const { source, target } = endpoints;
  if (!Graph.hasNode(graph, source)) {
    return yield* new InvalidEdgeCutEndpoints({
      source,
      target,
      reason: "unknownSource",
    });
  }
  if (!Graph.hasNode(graph, target)) {
    return yield* new InvalidEdgeCutEndpoints({
      source,
      target,
      reason: "unknownTarget",
    });
  }
  if (source === target) {
    return yield* new InvalidEdgeCutEndpoints({
      source,
      target,
      reason: "sameNode",
    });
  }

  const outgoing = new Map(
    Array.from(Graph.nodes(graph), ([node]) => [
      node,
      new Array<ResidualStep>(),
    ]),
  );
  const edges: FlowEdge[] = [];
  for (const [id, link] of Graph.edges(graph)) {
    if (link.source === link.target) continue;

    const edge: FlowEdge = {
      id,
      source: link.source,
      target: link.target,
      flow: 0,
    };
    edges.push(edge);
    outgoing
      .get(edge.source)!
      .push({ edge, from: edge.source, to: edge.target, direction: 1 });
    outgoing
      .get(edge.target)!
      .push({ edge, from: edge.target, to: edge.source, direction: -1 });
  }

  // A reverse step cancels earlier flow. Undirected edges also allow one
  // unit of net flow against their stored orientation.
  const lowerBound = graph.type === "directed" ? 0 : -1;
  let parents = residualSearch(outgoing, source, lowerBound);
  while (parents.has(target)) {
    let step = parents.get(target);
    while (step !== undefined) {
      step.edge.flow += step.direction;
      step = parents.get(step.from);
    }

    yield* Effect.yieldNow;
    parents = residualSearch(outgoing, source, lowerBound);
  }

  const cut = edges
    .filter((edge) => {
      const fromSourceSide = parents.has(edge.source);
      const toSourceSide = parents.has(edge.target);
      return graph.type === "directed"
        ? fromSourceSide && !toSourceSide
        : fromSourceSide !== toSourceSide;
    })
    .map((edge) => edge.id);

  return new Set(cut.sort(Order.Number));
});
