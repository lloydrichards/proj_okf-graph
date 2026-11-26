/**
 * Analyzes graph-wide structure, including which links are needed to preserve
 * reachability in a directed acyclic graph.
 *
 * @module
 */

import { Effect, Graph, Schema } from "effect";

/** Raised when a cycle prevents computing a DAG transitive reduction. */
export class CyclicGraphError extends Schema.TaggedError<
  CyclicGraphError,
  { readonly brand: unique symbol }
>()("CyclicGraphError", {}) {}

/**
 * Returns the original edge indices needed to preserve reachability in a
 * directed acyclic graph.
 *
 * **Details**
 *
 * All original nodes, including isolated nodes, remain part of the reduction.
 * Keep an edge if its target cannot be reached by starting with a different
 * neighbor. When a connection survives, keep its lowest edge index among
 * parallel edges.
 * The input graph stays intact. Edge payloads do not affect reachability.
 *
 * **Example**
 *
 * ```ts
 * import * as Structure from "@repo/graph-goodies/Structure";
 * import { Effect, Graph } from "effect";
 *
 * const graph = Graph.directed<string, undefined>((graph) => {
 *   const start = Graph.addNode(graph, "Start");
 *   const guide = Graph.addNode(graph, "Guide");
 *   const reference = Graph.addNode(graph, "Reference");
 *   Graph.addEdge(graph, start, guide, undefined);
 *   Graph.addEdge(graph, guide, reference, undefined);
 *   Graph.addEdge(graph, start, reference, undefined);
 * });
 *
 * const retained = await Effect.runPromise(Structure.transitiveReduction(graph));
 * // retained contains the first two edge indices.
 * ```
 */
export const transitiveReduction = Effect.fnUntraced(function* <N, E>(
  graph: Graph.DirectedGraph<N, E>,
): Effect.fn.Return<ReadonlySet<Graph.EdgeIndex>, CyclicGraphError> {
  if (!Graph.isAcyclic(graph)) {
    return yield* new CyclicGraphError();
  }

  const outgoing = new Map<
    Graph.NodeIndex,
    Map<Graph.NodeIndex, Graph.EdgeIndex>
  >();
  for (const [id, { source, target }] of Graph.edges(graph)) {
    const neighbors = outgoing.get(source);
    if (neighbors === undefined) {
      outgoing.set(source, new Map([[target, id]]));
      continue;
    }

    const previous = neighbors.get(target);
    if (previous === undefined || id < previous) neighbors.set(target, id);
  }

  const retained = new Set<Graph.EdgeIndex>();
  for (const neighbors of outgoing.values()) {
    if (neighbors.size === 1) {
      for (const edge of neighbors.values()) retained.add(edge);
      continue;
    }

    const seen = new Set<Graph.NodeIndex>();
    const queue = Array.from(neighbors.keys()).flatMap((node) =>
      Array.from(outgoing.get(node)?.keys() ?? []),
    );

    // Starting two steps away leaves direct neighbors visible only if an
    // alternate route reaches them.
    for (const node of queue) {
      if (seen.has(node)) continue;
      seen.add(node);
      for (const target of outgoing.get(node)?.keys() ?? []) {
        queue.push(target);
      }
    }

    for (const [target, edge] of neighbors) {
      if (!seen.has(target)) retained.add(edge);
    }
    yield* Effect.yieldNow;
  }

  return retained;
});
