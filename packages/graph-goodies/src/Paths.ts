/**
 * Finds routes through an Effect graph under constraints supplied by the caller.
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
