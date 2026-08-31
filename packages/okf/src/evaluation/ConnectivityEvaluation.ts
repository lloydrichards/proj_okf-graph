import { Array as Arr, Option, Order, pipe, String } from "effect";
import type { EvaluationTopology } from "./EvaluationTopology";
import { uniqueEndpoints } from "./EvaluationTopology";
import {
  analyzeDegrees,
  normalizedEntropy,
  proportion,
  summarizeExtendedDistribution,
  weakComponentSizes,
} from "./GraphStatistics";

type RelationEvidence = {
  readonly relation: string;
  readonly occurrences: number;
  readonly share: number;
};

/**
 * Calculates link health and connectivity from prepared authored and topology views.
 */
export const evaluateConnectivity = ({
  conceptIds,
  resolvedOccurrences: resolved,
  unresolvedOccurrences,
  directedGraph,
  nodeIndexByConceptId,
}: EvaluationTopology) => {
  const count = conceptIds.length;
  const {
    inDegrees,
    outDegrees,
    isolatedConceptIds,
    isolatedCount,
    withOutboundCount,
  } = analyzeDegrees(conceptIds, directedGraph, nodeIndexByConceptId);

  const inboundExtended = summarizeExtendedDistribution(inDegrees);
  const outboundExtended = summarizeExtendedDistribution(outDegrees);
  const componentSizes = weakComponentSizes(directedGraph);
  const largestComponent = Arr.reduce(componentSizes, 0, (largest, size) =>
    Math.max(largest, size),
  );

  const unresolved = unresolvedOccurrences.length;
  const authoredOccurrences = resolved.length + unresolved;
  const relationCounts = new Map<string, number>();
  for (const link of resolved) {
    const relation =
      link.relation === undefined ? "" : String.trim(link.relation);
    if (String.isEmpty(relation)) continue;
    relationCounts.set(relation, (relationCounts.get(relation) ?? 0) + 1);
  }
  const labeledOccurrences = pipe(
    [...relationCounts.values()],
    Arr.reduce(0, (total, count) => total + count),
  );

  const relationOrder: Order.Order<RelationEvidence> = Order.combine(
    Order.flip(
      Order.mapInput(
        Order.Number,
        (item: RelationEvidence) => item.occurrences,
      ),
    ),
    Order.mapInput(Order.String, (item: RelationEvidence) => item.relation),
  );
  const rankedRelations = pipe(
    [...relationCounts.entries()],
    Arr.map(([relation, occurrences]) => ({
      relation,
      occurrences,
      share: proportion(occurrences, labeledOccurrences),
    })),
    Arr.sort(relationOrder),
  );
  type DegreeEvidence = {
    readonly conceptId: string;
    readonly degree: number;
  };
  const degreeOrder: Order.Order<DegreeEvidence> = Order.combine(
    Order.flip(
      Order.mapInput(Order.Number, (item: DegreeEvidence) => item.degree),
    ),
    Order.mapInput(Order.String, (item: DegreeEvidence) => item.conceptId),
  );
  const rankedDegrees = (degrees: ReadonlyArray<number>) =>
    pipe(
      Arr.zip(conceptIds, degrees),
      Arr.map(([conceptId, degree]) => ({ conceptId, degree })),
      Arr.sort(degreeOrder),
      Arr.take(5),
    );

  return {
    metrics: {
      brokenLinkRate: proportion(unresolved, authoredOccurrences),
      outboundLinkCoverage: proportion(withOutboundCount, count),
      isolatedRate: proportion(isolatedCount, count),
      components: {
        count: componentSizes.length,
        largestCoverage: proportion(largestComponent, count),
      },
      degree: {
        inbound: {
          ...inboundExtended,
          zeroRate: proportion(
            Arr.countBy(inDegrees, (degree) => degree === 0),
            count,
          ),
        },
        outbound: {
          ...outboundExtended,
        },
      },
      relationLabels: {
        coverage: proportion(labeledOccurrences, resolved.length),
        distinctCount: relationCounts.size,
        entropy: normalizedEntropy([...relationCounts.values()]),
        topShare: pipe(
          rankedRelations,
          Arr.head,
          Option.match({ onNone: () => 0, onSome: ({ share }) => share }),
        ),
      },
    },
    evidence: {
      degree: {
        highestInbound: rankedDegrees(inDegrees),
        highestOutbound: rankedDegrees(outDegrees),
      },
      relationLabels: { highest: Arr.take(rankedRelations, 5) },
    },
    findings: [
      ...Arr.map(
        uniqueEndpoints(unresolvedOccurrences),
        ({ sourceId, targetId }) => ({
          _tag: "broken-link" as const,
          sourceId,
          targetId,
        }),
      ),
      ...Arr.map(isolatedConceptIds, (conceptId) => ({
        _tag: "isolated-concept" as const,
        conceptId,
      })),
    ],
  };
};
