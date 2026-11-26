/**
 * Analyzes which nodes and edges keep routes open in a graph.
 *
 * @module
 */

import { Effect, Graph, Schema } from "effect";

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
