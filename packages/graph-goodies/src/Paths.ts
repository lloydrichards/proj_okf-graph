/**
 * Finds routes and connecting trees in an Effect graph.
 *
 * @module
 */

import { Effect, Equal, Graph, Option, Order, Schema } from "effect";

/** Specifies the endpoints and edge labels a directed walk must follow in order. */
export type TypedPathQuery<E, L> = {
  readonly source: Graph.NodeIndex;
  readonly target: Graph.NodeIndex;
  readonly labels: ReadonlyArray<L>;
  readonly label: (edge: E) => L;
};

/** A matching walk in traversal order, using indices from the supplied graph. */
export type TypedPath = {
  readonly nodes: ReadonlyArray<Graph.NodeIndex>;
  readonly edges: ReadonlyArray<Graph.EdgeIndex>;
};

/** Raised by {@link findTypedPath} when the source or target does not exist. */
export class UnknownPathEndpoint extends Schema.TaggedError<
  UnknownPathEndpoint,
  { readonly brand: unique symbol }
>()("UnknownPathEndpoint", {
  endpoint: Schema.Literals(["source", "target"]),
  node: Schema.Number,
}) {}

type Step = {
  node: Graph.NodeIndex;
  via?: { edge: Graph.EdgeIndex; previous: Step };
};

const toTypedPath = (end: Step): TypedPath => {
  const nodes = [end.node];
  const edges: Array<Graph.EdgeIndex> = [];
  let step = end;

  while (step.via !== undefined) {
    edges.push(step.via.edge);
    step = step.via.previous;
    nodes.push(step.node);
  }

  return { nodes: nodes.reverse(), edges: edges.reverse() };
};

/**
 * Finds a directed walk whose edge labels exactly match the requested sequence.
 *
 * **Details**
 *
 * Labels are compared with `Equal.equals`. Nodes and edges may repeat. An
 * empty sequence matches a zero-edge walk when both endpoints are the same.
 * When multiple walks match, the earliest sequence by ascending edge indices
 * wins. An existing pair of endpoints with no match returns `Option.none()`.
 *
 * **Example**
 *
 * ```ts
 * import * as Paths from "@repo/graph-goodies/Paths";
 * import { Effect, Graph } from "effect";
 *
 * const graph = Graph.directed<string, string>((graph) => {
 *   const intro = Graph.addNode(graph, "Intro");
 *   const guide = Graph.addNode(graph, "Guide");
 *   Graph.addEdge(graph, intro, guide, "explains");
 * });
 *
 * const result = Effect.runSync(Paths.findTypedPath(graph, {
 *   source: 0,
 *   target: 1,
 *   labels: ["explains"],
 *   label: (edge) => edge,
 * }));
 * // Option.some({ nodes: [0, 1], edges: [0] })
 * ```
 */
export const findTypedPath = Effect.fnUntraced(function* <N, E, L>(
  graph: Graph.DirectedGraph<N, E>,
  query: TypedPathQuery<E, L>,
): Effect.fn.Return<Option.Option<TypedPath>, UnknownPathEndpoint> {
  if (!Graph.hasNode(graph, query.source)) {
    return yield* new UnknownPathEndpoint({
      endpoint: "source",
      node: query.source,
    });
  }
  if (!Graph.hasNode(graph, query.target)) {
    return yield* new UnknownPathEndpoint({
      endpoint: "target",
      node: query.target,
    });
  }
  if (query.labels.length === 0) {
    return query.source === query.target
      ? Option.some({ nodes: [query.source], edges: [] })
      : Option.none();
  }

  let frontier = new Map<Graph.NodeIndex, Step>([
    [query.source, { node: query.source }],
  ]);

  for (const label of query.labels) {
    // Insertion order follows edge-index sequences. At the same depth, paths
    // ending at the same node have the same possible continuations.
    const next = new Map<Graph.NodeIndex, Step>();
    for (const step of frontier.values()) {
      const outgoing = Graph.outgoingEdges(graph, step.node).sort(Order.Number);
      for (const index of outgoing) {
        const edge = Option.getOrThrow(Graph.getEdge(graph, index));
        if (
          next.has(edge.target) ||
          !Equal.equals(query.label(edge.data), label)
        ) {
          continue;
        }

        next.set(edge.target, {
          node: edge.target,
          via: { edge: index, previous: step },
        });
      }
    }
    if (next.size === 0) return Option.none();

    frontier = next;
  }

  return Option.map(
    Option.fromUndefinedOr(frontier.get(query.target)),
    toTypedPath,
  );
});

/** A tree represented by its original node and edge indices in ascending order. */
export type SteinerTree = {
  readonly nodes: ReadonlyArray<Graph.NodeIndex>;
  readonly edges: ReadonlyArray<Graph.EdgeIndex>;
};

/** Raised when a Steiner tree query names a node absent from the graph. */
export class UnknownSteinerTerminal extends Schema.TaggedError<
  UnknownSteinerTerminal,
  { readonly brand: unique symbol }
>()("UnknownSteinerTerminal", {
  terminal: Schema.Number,
}) {}

type Neighbor = {
  readonly node: Graph.NodeIndex;
  readonly edge: Graph.EdgeIndex;
};

const nearestTerminal = (
  neighborsOf: (node: Graph.NodeIndex) => ReadonlyArray<Neighbor>,
  tree: ReadonlySet<Graph.NodeIndex>,
  remaining: ReadonlySet<Graph.NodeIndex>,
): Step | undefined => {
  const queue: Array<Step> = Array.from(tree)
    .sort(Order.Number)
    .map((node) => ({ node }));
  const visited = new Set(tree);

  for (const step of queue) {
    if (remaining.has(step.node)) return step;

    for (const { node, edge } of neighborsOf(step.node)) {
      if (visited.has(node)) continue;

      visited.add(node);
      queue.push({ node, via: { edge, previous: step } });
    }
  }

  return undefined;
};

/**
 * Finds an approximate minimum-edge tree connecting selected nodes in an
 * undirected graph.
 *
 * **Details**
 *
 * Each edge has unit cost. Starting from the lowest terminal index, the
 * Takahashi–Matsuyama heuristic repeatedly adds a shortest path from the
 * current tree to an unconnected terminal. For equal distances, breadth-first
 * search visits tree nodes in ascending node-index order and each node's
 * incident edges in ascending edge-index order.
 *
 * Duplicate terminal indices are ignored. An empty selection returns an empty
 * tree, and a singleton returns its node. An unknown terminal fails with
 * {@link UnknownSteinerTerminal}. Disconnected terminals return
 * `Option.none()`. The input graph stays intact.
 *
 * **Example**
 *
 * ```ts
 * import * as Paths from "@repo/graph-goodies/Paths";
 * import { Effect, Graph } from "effect";
 *
 * const graph = Graph.undirected<string, undefined>((graph) => {
 *   const junction = Graph.addNode(graph, "Junction");
 *   for (const label of ["A", "B", "C"]) {
 *     const terminal = Graph.addNode(graph, label);
 *     Graph.addEdge(graph, junction, terminal, undefined);
 *   }
 * });
 *
 * const result = await Effect.runPromise(
 *   Paths.approximateSteinerTree(graph, [1, 2, 3]),
 * );
 * // Option.some({ nodes: [0, 1, 2, 3], edges: [0, 1, 2] })
 * ```
 */
export const approximateSteinerTree = Effect.fnUntraced(function* <N, E>(
  graph: Graph.UndirectedGraph<N, E>,
  terminals: ReadonlyArray<Graph.NodeIndex>,
): Effect.fn.Return<Option.Option<SteinerTree>, UnknownSteinerTerminal> {
  const ordered = Array.from(new Set(terminals)).sort(Order.Number);
  for (const terminal of ordered) {
    if (!Graph.hasNode(graph, terminal)) {
      return yield* new UnknownSteinerTerminal({ terminal });
    }
  }
  if (ordered.length < 2) {
    return Option.some({ nodes: ordered, edges: [] });
  }

  const adjacency = new Map<Graph.NodeIndex, ReadonlyArray<Neighbor>>();
  const neighborsOf = (node: Graph.NodeIndex): ReadonlyArray<Neighbor> => {
    const cached = adjacency.get(node);
    if (cached !== undefined) return cached;

    const neighbors = Graph.incidentEdges(graph, node)
      .sort(Order.Number)
      .flatMap((edge) => {
        const { source, target } = Option.getOrThrow(
          Graph.getEdge(graph, edge),
        );
        if (source === target) return [];
        return [{ node: source === node ? target : source, edge }];
      });
    adjacency.set(node, neighbors);
    return neighbors;
  };

  const [start, ...unconnected] = ordered;
  const remaining = new Set(unconnected);
  const nodes = new Set([start!]);
  const edges: Array<Graph.EdgeIndex> = [];
  while (remaining.size > 0) {
    let step = nearestTerminal(neighborsOf, nodes, remaining);
    if (step === undefined) return Option.none();

    remaining.delete(step.node);
    // Every tree node is already a BFS root, so the new path meets the tree
    // only at its root and cannot introduce a cycle.
    while (step.via !== undefined) {
      nodes.add(step.node);
      edges.push(step.via.edge);
      step = step.via.previous;
    }
    yield* Effect.yieldNow;
  }

  return Option.some({
    nodes: Array.from(nodes).sort(Order.Number),
    edges: edges.sort(Order.Number),
  });
});
