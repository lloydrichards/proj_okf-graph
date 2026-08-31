import { Array as Arr, Graph, Number, Option, Order, pipe } from "effect";
import type { EvaluationTopology } from "./EvaluationTopology";
import type { TopologyEdge } from "./EvaluationTopology";
import {
  analyzeDegrees,
  analyzeResilience,
  proportion,
  summarizeDistribution,
} from "./GraphStatistics";

type PathSample = {
  readonly distance: number;
  readonly conceptIds: ReadonlyArray<string>;
};

type SourceTraversal = {
  readonly sourceId: string;
  readonly distances: ReadonlyMap<string, number>;
};

const pathOrder = Order.combine(
  Order.flip(
    Order.mapInput(Order.Number, (sample: PathSample) => sample.distance),
  ),
  Order.mapInput(Order.String, (sample: PathSample) =>
    sample.conceptIds.join("\u0000"),
  ),
);

/** Deterministic shortest paths, using concept-id order to break equal-length ties. */
const traverseTopology = (
  conceptIds: ReadonlyArray<string>,
  graph: Graph.Graph<string, TopologyEdge, Graph.Kind>,
  nodeIndexByConceptId: ReadonlyMap<string, Graph.NodeIndex>,
  maximumDepth = Infinity,
  includeDiameterPath = false,
): {
  readonly traversals: ReadonlyArray<SourceTraversal>;
  readonly reachablePairCount: number;
  readonly totalDistance: number;
  readonly diameter: PathSample | undefined;
} => {
  let reachablePairCount = 0;
  let totalDistance = 0;
  let diameter: PathSample | undefined;
  const traversals = pipe(
    conceptIds,
    Arr.map((sourceId) => {
      const sourceIndex = nodeIndexByConceptId.get(sourceId);
      const distances = new Map<string, number>();
      if (sourceIndex === undefined) return { sourceId, distances };

      for (const [nodeIndex, distance] of Graph.unweightedDistances(
        graph,
        sourceIndex,
      )) {
        if (distance > maximumDepth) continue;
        const conceptId = Graph.getNode(graph, nodeIndex);
        if (Option.isNone(conceptId)) continue;
        distances.set(conceptId.value, distance);
        if (distance > 0) {
          reachablePairCount += 1;
          totalDistance += distance;
        }
      }

      const farthest = Arr.reduce(
        [...distances.entries()],
        0,
        (maximum, [, distance]) => Math.max(maximum, distance),
      );
      if (!includeDiameterPath) return { sourceId, distances };

      for (const [targetId, distance] of distances) {
        if (distance !== farthest || distance === 0) continue;
        const targetIndex = nodeIndexByConceptId.get(targetId);
        if (targetIndex === undefined) continue;
        const path = Graph.dijkstra(graph, {
          source: sourceIndex,
          target: targetIndex,
          cost: () => 1,
        }).pipe(
          Option.map((result) =>
            pipe(
              result.path,
              Arr.map((nodeIndex) => Graph.getNode(graph, nodeIndex)),
              Arr.getSomes,
            ),
          ),
          Option.getOrElse(() => []),
        );
        const sample = { distance, conceptIds: path };
        if (diameter === undefined || pathOrder(sample, diameter) < 0) {
          diameter = sample;
        }
      }
      return { sourceId, distances };
    }),
  );
  return { traversals, reachablePairCount, totalDistance, diameter };
};

type ConceptCoverage = {
  readonly conceptId: string;
  readonly coverage: number;
};

const neighborhoodCoverages = (
  traversals: ReadonlyArray<SourceTraversal>,
  conceptCount: number,
) => {
  return pipe(
    traversals,
    Arr.map(({ sourceId, distances }) => {
      const coverageAt = (radius: number) =>
        proportion(
          Arr.countBy(
            [...distances.values()],
            (distance) => distance > 0 && distance <= radius,
          ),
          Math.max(conceptCount - 1, 0),
        );
      return {
        conceptId: sourceId,
        within1Hop: coverageAt(1),
        within2Hops: coverageAt(2),
        within3Hops: coverageAt(3),
      };
    }),
  );
};

const coverageOrder = Order.combine(
  Order.mapInput(Order.Number, (item: ConceptCoverage) => item.coverage),
  Order.mapInput(Order.String, (item: ConceptCoverage) => item.conceptId),
);

const summarizeGrowth = (
  items: ReadonlyArray<{
    readonly within1Hop: number;
    readonly within2Hops: number;
    readonly within3Hops: number;
  }>,
) => ({
  within1Hop: summarizeDistribution(Arr.map(items, (item) => item.within1Hop)),
  within2Hops: summarizeDistribution(
    Arr.map(items, (item) => item.within2Hops),
  ),
  within3Hops: summarizeDistribution(
    Arr.map(items, (item) => item.within3Hops),
  ),
});

const rankGrowth = (
  items: ReadonlyArray<{
    readonly conceptId: string;
    readonly within3Hops: number;
  }>,
  order: Order.Order<ConceptCoverage>,
) =>
  pipe(
    items,
    Arr.map(({ conceptId, within3Hops: coverage }) => ({
      conceptId,
      coverage,
    })),
    Arr.sort(order),
    Arr.take(5),
  );

/**
 * Explores graph shape using prepared directed and undirected projections.
 */
export const evaluateStructure = ({
  conceptIds,
  directedTopology: topology,
  directedGraph,
  undirectedGraph,
  nodeIndexByConceptId,
}: EvaluationTopology) => {
  const { inDegrees } = analyzeDegrees(
    conceptIds,
    directedGraph,
    nodeIndexByConceptId,
  );
  const conceptCount = conceptIds.length;
  const possibleDirectedEdges = conceptCount * Math.max(conceptCount - 1, 0);
  const averageTotalDegree =
    conceptCount === 0 ? 0 : (2 * topology.length) / conceptCount;
  const maximumInDegree = Arr.reduce(inDegrees, 0, (maximum, degree) =>
    Math.max(maximum, degree),
  );
  const centralizationDenominator = Math.max(conceptCount - 1, 0) ** 2;
  const inDegreeCentralization =
    centralizationDenominator === 0
      ? 0
      : pipe(
          inDegrees,
          Arr.reduce(0, (total, degree) =>
            Number.sum(total, maximumInDegree - degree),
          ),
          (total) => total / centralizationDenominator,
        );

  const directed = traverseTopology(
    conceptIds,
    directedGraph,
    nodeIndexByConceptId,
    Infinity,
    true,
  );
  const resilience = analyzeResilience(undirectedGraph);
  const directedGrowth = neighborhoodCoverages(
    directed.traversals,
    conceptCount,
  );
  const undirectedGrowth = neighborhoodCoverages(
    traverseTopology(conceptIds, undirectedGraph, nodeIndexByConceptId, 3)
      .traversals,
    conceptCount,
  );
  const averageShortestPath =
    directed.reachablePairCount === 0
      ? 0
      : directed.totalDistance / directed.reachablePairCount;
  const diameter = directed.diameter;

  return {
    metrics: {
      directedDensity: proportion(topology.length, possibleDirectedEdges),
      averageTotalDegree,
      reachability: {
        pairRate: proportion(
          directed.reachablePairCount,
          possibleDirectedEdges,
        ),
        averageShortestPathLength: averageShortestPath,
        diameter: diameter?.distance ?? 0,
      },
      inboundCentralization: inDegreeCentralization,
      resilience: {
        articulationConceptCount: resilience.articulationConcepts.length,
        articulationConceptRate: proportion(
          resilience.articulationConcepts.length,
          conceptCount,
        ),
        bridgeRelationshipCount: resilience.bridgeRelationships.length,
        bridgeRelationshipRate: proportion(
          resilience.bridgeRelationships.length,
          resilience.undirectedEdgeCount,
        ),
      },
      neighborhoodGrowth: {
        directed: summarizeGrowth(directedGrowth),
        undirected: summarizeGrowth(undirectedGrowth),
      },
    },
    evidence: {
      reachability: {
        diameterPath: diameter?.conceptIds ?? [],
      },
      resilience: {
        articulationConcepts: resilience.articulationConcepts,
        bridgeRelationships: resilience.bridgeRelationships,
      },
      neighborhoodGrowth: {
        directedSlowest: rankGrowth(directedGrowth, coverageOrder),
        directedFastest: rankGrowth(directedGrowth, Order.flip(coverageOrder)),
        undirectedSlowest: rankGrowth(undirectedGrowth, coverageOrder),
        undirectedFastest: rankGrowth(
          undirectedGrowth,
          Order.flip(coverageOrder),
        ),
      },
    },
  };
};
