import { Array as Arr, Graph, Option, Order, pipe } from "effect";
import type { TopologyEdge } from "./EvaluationTopology";

export const proportion = (part: number, total: number) =>
  total === 0 ? 0 : part / total;

const nearestRankFrom = (sorted: ReadonlyArray<number>, percentile: number) =>
  Arr.get(sorted, Math.ceil(percentile * sorted.length) - 1).pipe(
    Option.getOrElse(() => 0),
  );

/** Sorts once and applies one consistent empty-distribution and percentile policy. */
export const summarizeDistribution = (values: ReadonlyArray<number>) => {
  const sorted = Arr.sort(values, Order.Number);
  return {
    p50: nearestRankFrom(sorted, 0.5),
    p90: nearestRankFrom(sorted, 0.9),
  };
};

export const summarizeExtendedDistribution = (
  values: ReadonlyArray<number>,
) => ({
  ...summarizeDistribution(values),
  max: Arr.reduce(values, 0, (maximum, value) => Math.max(maximum, value)),
});

export const normalizedEntropy = (counts: ReadonlyArray<number>) => {
  const total = Arr.reduce(counts, 0, (sum, count) => sum + count);
  if (counts.length <= 1 || total === 0) return 0;

  return (
    Arr.reduce(counts, 0, (entropy, count) => {
      const probability = count / total;
      return entropy - probability * Math.log(probability);
    }) / Math.log(counts.length)
  );
};

export const weakComponentSizes = (
  graph: Graph.DirectedGraph<string, TopologyEdge>,
) => pipe(Graph.weaklyConnectedComponents(graph), Arr.map(Arr.length));

export const analyzeDegrees = (
  conceptIds: ReadonlyArray<string>,
  graph: Graph.DirectedGraph<string, TopologyEdge>,
  nodeIndexByConceptId: ReadonlyMap<string, Graph.NodeIndex>,
) => {
  const inDegrees = pipe(
    conceptIds,
    Arr.map((id) => {
      const nodeIndex = nodeIndexByConceptId.get(id);
      return nodeIndex === undefined ? 0 : Graph.inDegree(graph, nodeIndex);
    }),
  );
  const outDegrees = pipe(
    conceptIds,
    Arr.map((id) => {
      const nodeIndex = nodeIndexByConceptId.get(id);
      return nodeIndex === undefined ? 0 : Graph.outDegree(graph, nodeIndex);
    }),
  );
  const isolatedConceptIds = pipe(
    conceptIds,
    Arr.zip(Arr.zip(inDegrees, outDegrees)),
    Arr.filter(([, [incoming, outgoing]]) => incoming + outgoing === 0),
    Arr.map(([id]) => id),
  );

  return {
    inDegrees,
    outDegrees,
    isolatedConceptIds,
    isolatedCount: isolatedConceptIds.length,
    withOutboundCount: Arr.countBy(outDegrees, (degree) => degree > 0),
    withoutInboundCount: Arr.countBy(inDegrees, (degree) => degree === 0),
  };
};

export const analyzeResilience = (
  graph: Graph.UndirectedGraph<string, TopologyEdge>,
) => {
  const articulationConcepts = pipe(
    Graph.articulationPoints(graph),
    Arr.map((nodeIndex) => Graph.getNode(graph, nodeIndex)),
    Arr.getSomes,
    Arr.sort(Order.String),
  );
  const bridgeRelationships = pipe(
    Graph.bridges(graph),
    Arr.map((edgeIndex) =>
      Graph.getEdge(graph, edgeIndex).pipe(Option.map((edge) => edge.data)),
    ),
    Arr.getSomes,
    Arr.sort(
      Order.combine(
        Order.mapInput(Order.String, (edge: TopologyEdge) => edge.sourceId),
        Order.mapInput(Order.String, (edge: TopologyEdge) => edge.targetId),
      ),
    ),
  );
  return {
    articulationConcepts,
    bridgeRelationships,
    undirectedEdgeCount: Graph.edgeCount(graph),
  };
};
