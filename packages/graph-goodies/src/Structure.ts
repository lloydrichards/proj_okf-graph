/**
 * Analyzes graph structure through reachability and repeated neighborhood patterns.
 *
 * @module
 */

import { Effect, Graph, Order, Schema } from "effect";

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

/** Selects initial node labels and an optional limit on refinement rounds. */
export type ColorRefinementOptions<N> = {
  /** Gets the initial label from the node payload and index. Defaults to one shared label. */
  readonly label?: (node: N, index: Graph.NodeIndex) => string;
  /** Maximum rounds. Zero returns the initial colors. Omit to refine until stable. */
  readonly maxRounds?: number;
};

/** Describes the resulting partition and whether a round left it unchanged. */
export type ColorRefinement = {
  /** Graph-local color IDs by original node index. */
  readonly colors: ReadonlyMap<Graph.NodeIndex, number>;
  /** Number of refinement rounds performed. */
  readonly rounds: number;
  /** Whether the partition stabilized or already consists entirely of singleton classes. */
  readonly converged: boolean;
};

/** Raised when the requested round limit is outside the supported range. */
export class InvalidColorRefinementLimit extends Schema.TaggedError<
  InvalidColorRefinementLimit,
  { readonly brand: unique symbol }
>()("InvalidColorRefinementLimit", { maxRounds: Schema.Number }) {}

const roundLimit = Schema.is(
  Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
);

const assignColors = <A>(
  signatures: ReadonlyArray<readonly [Graph.NodeIndex, A]>,
  order: Order.Order<A>,
): {
  readonly colors: Map<Graph.NodeIndex, number>;
  readonly classes: number;
} => {
  const sorted = signatures.toSorted((left, right) => order(left[1], right[1]));
  const colors = new Map<Graph.NodeIndex, number>();
  let color = -1;
  let previous: readonly [Graph.NodeIndex, A] | undefined;

  for (const entry of sorted) {
    const [node, signature] = entry;
    if (previous === undefined || order(previous[1], signature) !== 0) color++;
    colors.set(node, color);
    previous = entry;
  }

  return { colors, classes: color + 1 };
};

const neighborColors = (
  neighbors: ReadonlyArray<Graph.NodeIndex>,
  colors: ReadonlyMap<Graph.NodeIndex, number>,
): ReadonlyArray<number> =>
  neighbors.map((node) => colors.get(node)!).sort(Order.Number);

const signatureOrder = Order.Tuple([
  Order.Number,
  Order.Array(Order.Number),
  Order.Array(Order.Number),
]);

/**
 * Groups nodes by their labels and repeated patterns in their neighborhoods.
 *
 * **Details**
 *
 * Each Weisfeiler–Lehman refinement round splits a color class according to
 * the multisets of colors on adjacent nodes. Directed graphs compare incoming
 * and outgoing neighborhoods separately. An undirected self-loop contributes
 * once, and parallel edges contribute separately. Edge payloads are ignored.
 *
 * Colors are deterministic for the same graph and initial labels. They
 * identify classes within this result. Equal colors mean the performed
 * rounds could not distinguish two nodes, and do not establish a graph
 * isomorphism or prove the nodes can be exchanged.
 *
 * **Example**
 *
 * ```ts
 * import * as Structure from "@repo/graph-goodies/Structure";
 * import { Effect, Graph } from "effect";
 *
 * const graph = Graph.undirected<string, undefined>((graph) => {
 *   const left = Graph.addNode(graph, "Left");
 *   const hub = Graph.addNode(graph, "Hub");
 *   const right = Graph.addNode(graph, "Right");
 *   Graph.addEdge(graph, left, hub, undefined);
 *   Graph.addEdge(graph, hub, right, undefined);
 * });
 *
 * const { colors } = await Effect.runPromise(Structure.refineColors(graph));
 * // The two leaves share a color. The hub has a different color.
 * ```
 */
export const refineColors = Effect.fnUntraced(function* <
  N,
  E,
  K extends Graph.Kind,
>(
  graph: Graph.Graph<N, E, K>,
  options: ColorRefinementOptions<N> = {},
): Effect.fn.Return<ColorRefinement, InvalidColorRefinementLimit> {
  const { label, maxRounds } = options;
  if (maxRounds !== undefined && !roundLimit(maxRounds)) {
    return yield* new InvalidColorRefinementLimit({ maxRounds });
  }

  const nodes = Array.from(Graph.nodes(graph));
  let partition = assignColors(
    nodes.map(([node, value]) => [node, label?.(value, node) ?? ""]),
    Order.String,
  );

  if (maxRounds === 0 || partition.classes === nodes.length) {
    return {
      colors: partition.colors,
      rounds: 0,
      converged: partition.classes === nodes.length,
    };
  }

  const adjacency = new Map(
    nodes.map(([node]) => [
      node,
      {
        incoming: new Array<Graph.NodeIndex>(),
        outgoing: new Array<Graph.NodeIndex>(),
      },
    ]),
  );
  for (const [, { source, target }] of Graph.edges(graph)) {
    adjacency.get(source)!.outgoing.push(target);
    if (graph.type === "directed") {
      adjacency.get(target)!.incoming.push(source);
    } else if (source !== target) {
      adjacency.get(target)!.outgoing.push(source);
    }
  }

  let rounds = 0;
  while (maxRounds === undefined || rounds < maxRounds) {
    const { colors, classes } = partition;
    partition = assignColors(
      Array.from(adjacency, ([node, neighbors]) => [
        node,
        [
          colors.get(node)!,
          neighborColors(neighbors.incoming, colors),
          neighborColors(neighbors.outgoing, colors),
        ] as const,
      ]),
      signatureOrder,
    );
    rounds++;
    if (partition.classes === classes || partition.classes === nodes.length) {
      return { colors: partition.colors, rounds, converged: true };
    }

    yield* Effect.yieldNow;
  }

  return { colors: partition.colors, rounds, converged: false };
});
