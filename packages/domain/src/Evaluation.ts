import { Schema } from "effect";

const Ratio = Schema.Finite.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1)),
);

const NonNegative = Schema.Finite.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
);

const NonNegativeInt = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
);

export const GraphProjection = Schema.Literals(["directed", "undirected"]);

export type GraphProjection = typeof GraphProjection.Type;

export const MarkovPolicy = Schema.Struct({
  projection: GraphProjection,
  alpha: Schema.Finite.pipe(
    Schema.check(Schema.isGreaterThan(0), Schema.isLessThan(1)),
  ),
  tolerance: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  maxIterations: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
});

export type MarkovPolicy = typeof MarkovPolicy.Type;

const Convergence = Schema.Struct({
  converged: Schema.Boolean,
  iterations: NonNegativeInt,
  residual: NonNegative,
});

const RankedConcept = Schema.Struct({
  conceptId: Schema.String,
  probability: Ratio,
});

const RankedConceptDegree = Schema.Struct({
  conceptId: Schema.String.annotate({ description: "Concept identifier." }),
  degree: NonNegativeInt.annotate({ description: "Unique neighbor count." }),
});

const RankedRelationLabel = Schema.Struct({
  relation: Schema.String.annotate({ description: "Authored relation label." }),
  occurrences: NonNegativeInt.annotate({
    description: "Resolved occurrences.",
  }),
  share: Ratio.annotate({ description: "Share of labeled occurrences." }),
});

const Distribution = Schema.Struct({
  p50: Ratio.annotate({ description: "Median normalized coverage." }),
  p90: Ratio.annotate({ description: "90th-percentile normalized coverage." }),
});

const DiscoverabilityMetrics = Schema.Struct({
  entropy: Ratio.annotate({
    description: "Normalized entropy of stationary discovery probabilities.",
  }),
  effectiveConcepts: NonNegative.annotate({
    description: "Equivalent number of equally discoverable concepts.",
  }),
  topProbability: Ratio.annotate({
    description: "Largest stationary discovery probability.",
  }),
  teleportRate: Ratio.annotate({
    description:
      "Navigation supplied by teleportation and dangling-node redistribution.",
  }),
});

const NavigationProjection = Schema.Struct({
  policy: MarkovPolicy,
  convergence: Convergence,
  metrics: DiscoverabilityMetrics,
  evidence: Schema.Struct({
    highest: Schema.Array(RankedConcept),
    lowest: Schema.Array(RankedConcept),
  }),
});

const DirectionSensitiveConcept = Schema.Struct({
  conceptId: Schema.String.annotate({ description: "Concept identifier." }),
  directedProbability: Ratio.annotate({
    description: "Directed stationary probability.",
  }),
  undirectedProbability: Ratio.annotate({
    description: "Undirected stationary probability.",
  }),
  absoluteDifference: Ratio.annotate({
    description: "Absolute probability difference between projections.",
  }),
});

const BundleMetrics = Schema.Struct({
  conceptCount: NonNegativeInt.annotate({
    description: "Parsed concept count.",
  }),
  metadataCoverage: Schema.Struct({
    title: Ratio.annotate({ description: "Concepts with non-blank titles." }),
    description: Ratio.annotate({
      description: "Concepts with non-blank descriptions.",
    }),
    tags: Ratio.annotate({ description: "Concepts with tags." }),
    timestamp: Ratio.annotate({ description: "Concepts with timestamps." }),
  }),
  emptyBodyRate: Ratio.annotate({ description: "Concepts with blank bodies." }),
  wordCount: Schema.Struct({
    p50: NonNegativeInt.annotate({
      description: "Median non-empty body word count.",
    }),
    p90: NonNegativeInt.annotate({
      description: "90th-percentile non-empty body word count.",
    }),
  }),
  contentCoverage: Schema.Struct({
    heading: Ratio.annotate({ description: "Concepts containing a heading." }),
    list: Ratio.annotate({ description: "Concepts containing a list." }),
    codeBlock: Ratio.annotate({
      description: "Concepts containing a code block.",
    }),
  }),
});

const BundleFinding = Schema.TaggedUnion({
  "duplicate-title": {
    conceptIds: Schema.Array(Schema.String),
  },
  "duplicate-body": {
    conceptIds: Schema.Array(Schema.String),
  },
});

export const BundleEvaluation = Schema.Struct({
  metrics: BundleMetrics,
  findings: Schema.Array(BundleFinding),
});
export type BundleEvaluation = typeof BundleEvaluation.Type;

const ConnectivityMetrics = Schema.Struct({
  brokenLinkRate: Ratio.annotate({
    description: "Unresolved internal links among authored internal links.",
  }),
  outboundLinkCoverage: Ratio.annotate({
    description: "Concepts with a resolved outbound neighbor.",
  }),
  isolatedRate: Ratio.annotate({
    description: "Concepts with no resolved neighbors.",
  }),
  components: Schema.Struct({
    count: NonNegativeInt.annotate({
      description: "Weakly connected component count.",
    }),
    largestCoverage: Ratio.annotate({
      description: "Concepts in the largest weak component.",
    }),
  }),
  degree: Schema.Struct({
    inbound: Schema.Struct({
      p50: NonNegativeInt.annotate({
        description: "Median unique inbound neighbors.",
      }),
      p90: NonNegativeInt.annotate({
        description: "90th-percentile unique inbound neighbors.",
      }),
      max: NonNegativeInt.annotate({
        description: "Maximum unique inbound neighbors.",
      }),
      zeroRate: Ratio.annotate({
        description: "Concepts with zero inbound neighbors.",
      }),
    }),
    outbound: Schema.Struct({
      p50: NonNegativeInt.annotate({
        description: "Median unique outbound neighbors.",
      }),
      p90: NonNegativeInt.annotate({
        description: "90th-percentile unique outbound neighbors.",
      }),
      max: NonNegativeInt.annotate({
        description: "Maximum unique outbound neighbors.",
      }),
    }),
  }),
  relationLabels: Schema.Struct({
    coverage: Ratio.annotate({
      description: "Resolved links with non-blank relation labels.",
    }),
    distinctCount: NonNegativeInt.annotate({
      description: "Distinct trimmed relation labels.",
    }),
    entropy: Ratio.annotate({
      description: "Normalized entropy of relation-label occurrences.",
    }),
    topShare: Ratio.annotate({
      description: "Share held by the most common relation label.",
    }),
  }),
});

const ConnectivityFinding = Schema.Union([
  Schema.TaggedStruct("broken-link", {
    sourceId: Schema.String,
    targetId: Schema.String,
  }),
  Schema.TaggedStruct("isolated-concept", {
    conceptId: Schema.String,
  }),
]);

export const ConnectivityEvaluation = Schema.Struct({
  metrics: ConnectivityMetrics,
  findings: Schema.Array(ConnectivityFinding),
  evidence: Schema.Struct({
    degree: Schema.Struct({
      highestInbound: Schema.Array(RankedConceptDegree),
      highestOutbound: Schema.Array(RankedConceptDegree),
    }),
    relationLabels: Schema.Struct({
      highest: Schema.Array(RankedRelationLabel),
    }),
  }),
});
export type ConnectivityEvaluation = typeof ConnectivityEvaluation.Type;

const StructureMetrics = Schema.Struct({
  directedDensity: Ratio.annotate({
    description: "Unique directed links among possible non-self links.",
  }),
  averageTotalDegree: NonNegative.annotate({
    description: "Average inbound plus outbound degree.",
  }),
  reachability: Schema.Struct({
    pairRate: Ratio.annotate({
      description: "Reachable ordered concept pairs.",
    }),
    averageShortestPathLength: NonNegative.annotate({
      description: "Mean shortest path over reachable directed pairs.",
    }),
    diameter: NonNegativeInt.annotate({
      description: "Longest finite directed shortest path.",
    }),
  }),
  inboundCentralization: Ratio.annotate({
    description: "Freeman in-degree centralization.",
  }),
  resilience: Schema.Struct({
    articulationConceptCount: NonNegativeInt.annotate({
      description: "Articulation concepts in the simple undirected projection.",
    }),
    articulationConceptRate: Ratio.annotate({
      description: "Share of concepts that are articulation points.",
    }),
    bridgeRelationshipCount: NonNegativeInt.annotate({
      description: "Bridge edges in the simple undirected projection.",
    }),
    bridgeRelationshipRate: Ratio.annotate({
      description: "Share of simple undirected edges that are bridges.",
    }),
  }),
  neighborhoodGrowth: Schema.Struct({
    directed: Schema.Struct({
      within1Hop: Distribution,
      within2Hops: Distribution,
      within3Hops: Distribution,
    }),
    undirected: Schema.Struct({
      within1Hop: Distribution,
      within2Hops: Distribution,
      within3Hops: Distribution,
    }),
  }),
});

const RankedConceptCoverage = Schema.Struct({
  conceptId: Schema.String,
  coverage: Ratio,
});

export const StructureEvaluation = Schema.Struct({
  metrics: StructureMetrics,
  evidence: Schema.Struct({
    reachability: Schema.Struct({
      diameterPath: Schema.Array(Schema.String),
    }),
    resilience: Schema.Struct({
      articulationConcepts: Schema.Array(Schema.String),
      bridgeRelationships: Schema.Array(
        Schema.Struct({ sourceId: Schema.String, targetId: Schema.String }),
      ),
    }),
    neighborhoodGrowth: Schema.Struct({
      directedSlowest: Schema.Array(RankedConceptCoverage),
      directedFastest: Schema.Array(RankedConceptCoverage),
      undirectedSlowest: Schema.Array(RankedConceptCoverage),
      undirectedFastest: Schema.Array(RankedConceptCoverage),
    }),
  }),
});
export type StructureEvaluation = typeof StructureEvaluation.Type;

export const NavigationEvaluation = Schema.Struct({
  directed: NavigationProjection,
  undirected: NavigationProjection,
  directionSensitivity: Schema.Struct({
    divergence: Ratio.annotate({
      description: "Normalized Jensen-Shannon divergence between projections.",
    }),
    concepts: Schema.Array(DirectionSensitiveConcept),
  }),
});

export type NavigationEvaluation = typeof NavigationEvaluation.Type;

export const EvaluationReport = Schema.Struct({
  bundle: BundleEvaluation.annotate({
    description: "Authored content and metadata measurements.",
  }),
  connectivity: ConnectivityEvaluation.annotate({
    description: "Link integrity, participation, and relation measurements.",
  }),
  structure: StructureEvaluation.annotate({
    description:
      "Topology, reachability, resilience, and neighborhood measurements.",
  }),
  navigation: NavigationEvaluation.annotate({
    description: "Policy-dependent discoverability measurements.",
  }),
}).annotate({
  title: "OKF evaluation report",
  description:
    "Structural measurements and concrete evidence for an OKF bundle.",
});

export type EvaluationReport = typeof EvaluationReport.Type;
