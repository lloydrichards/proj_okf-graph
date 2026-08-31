import type {
  Bundle,
  ConceptEdge,
  OkfGraph,
  UnresolvedLink,
} from "@repo/domain/Okf";
import { Array as Arr, Graph, Order, pipe } from "effect";

/** Internal, prepared graph views shared by the evaluation algorithms. */
export type EvaluationTopology = {
  readonly conceptIds: ReadonlyArray<string>;
  readonly resolvedOccurrences: ReadonlyArray<ConceptEdge>;
  readonly unresolvedOccurrences: ReadonlyArray<UnresolvedLink>;
  readonly directedTopology: ReadonlyArray<TopologyEdge>;
  readonly undirectedTopology: ReadonlyArray<TopologyEdge>;
  readonly directedGraph: Graph.DirectedGraph<string, TopologyEdge>;
  readonly undirectedGraph: Graph.UndirectedGraph<string, TopologyEdge>;
  readonly nodeIndexByConceptId: ReadonlyMap<string, Graph.NodeIndex>;
};

export type TopologyEdge = {
  readonly sourceId: string;
  readonly targetId: string;
};

const edgeOrder = Order.combine(
  Order.mapInput(Order.String, (edge: TopologyEdge) => edge.sourceId),
  Order.mapInput(Order.String, (edge: TopologyEdge) => edge.targetId),
);

const uniqueBy =
  <T>(keyOf: (value: T) => string) =>
  (values: ReadonlyArray<T>) => {
    const seen = new Set<string>();
    return Arr.filter(values, (value) => {
      const key = keyOf(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

export const uniqueEndpoints = <T extends TopologyEdge>(
  links: ReadonlyArray<T>,
): ReadonlyArray<TopologyEdge> =>
  pipe(
    links,
    uniqueBy<TopologyEdge>((edge) => `${edge.sourceId}\u0000${edge.targetId}`),
    Arr.map(({ sourceId, targetId }) => ({ sourceId, targetId })),
    Arr.sort(edgeOrder),
  );

export const uniqueUndirectedEndpoints = (
  links: ReadonlyArray<TopologyEdge>,
): ReadonlyArray<TopologyEdge> =>
  pipe(
    links,
    Arr.filter(({ sourceId, targetId }) => sourceId !== targetId),
    Arr.map(({ sourceId, targetId }) =>
      sourceId < targetId
        ? { sourceId, targetId }
        : { sourceId: targetId, targetId: sourceId },
    ),
    uniqueEndpoints,
  );

/** Builds the stable authored and normalized graph views used by evaluation. */
export const makeEvaluationTopology = (
  bundle: Bundle,
  graph: OkfGraph,
): EvaluationTopology => {
  const resolvedOccurrences = pipe(
    Array.from(Graph.edges(graph.graph)),
    Arr.map(([, edge]) => edge.data),
    Arr.filter((edge) => edge.kind === "concept-link"),
  );
  const directedTopology = pipe(
    resolvedOccurrences,
    Arr.filter(({ sourceId, targetId }) => sourceId !== targetId),
    uniqueEndpoints,
  );
  const conceptIds = pipe(
    bundle.concepts,
    Arr.map(({ id }) => id),
    Arr.sort(Order.String),
  );
  const undirectedTopology = uniqueUndirectedEndpoints(directedTopology);
  const nodeIndexByConceptId = new Map<string, Graph.NodeIndex>();
  const directedGraph = Graph.directed<string, TopologyEdge>((mutable) => {
    for (const conceptId of conceptIds) {
      nodeIndexByConceptId.set(conceptId, Graph.addNode(mutable, conceptId));
    }
    for (const edge of directedTopology) {
      const source = nodeIndexByConceptId.get(edge.sourceId);
      const target = nodeIndexByConceptId.get(edge.targetId);
      if (source !== undefined && target !== undefined) {
        Graph.addEdge(mutable, source, target, edge);
      }
    }
  });
  const undirectedGraph = Graph.undirected<string, TopologyEdge>((mutable) => {
    const undirectedNodeIndex = new Map(
      Arr.map(conceptIds, (conceptId) => [
        conceptId,
        Graph.addNode(mutable, conceptId),
      ]),
    );
    for (const edge of undirectedTopology) {
      const source = undirectedNodeIndex.get(edge.sourceId);
      const target = undirectedNodeIndex.get(edge.targetId);
      if (source !== undefined && target !== undefined) {
        Graph.addEdge(mutable, source, target, edge);
      }
    }
  });

  return {
    conceptIds,
    resolvedOccurrences,
    unresolvedOccurrences: [...graph.unresolvedLinks],
    directedTopology,
    undirectedTopology,
    directedGraph,
    undirectedGraph,
    nodeIndexByConceptId,
  };
};
