import {
  Array as Arr,
  DateTime,
  Effect,
  Graph,
  Option,
  pipe,
  Schema,
  SchemaGetter,
} from "effect";
import { MarkdownDocument } from "./Markdown";

export const ConceptLink = Schema.TaggedUnion({
  internal: {
    target: Schema.String,
    label: Schema.String,
    relation: Schema.optional(Schema.String),
  },
  external: {
    target: Schema.String,
    label: Schema.String,
    relation: Schema.optional(Schema.String),
  },
  broken: {
    target: Schema.String,
    relation: Schema.optional(Schema.String),
  },
});

export type ConceptLink = typeof ConceptLink.Type;

export const hasExplicitUtcOffset = (value: string): boolean =>
  /(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && Option.isSome(DateTime.make(value));

export const OkfDateTime = Schema.String.check(
  Schema.makeFilter(
    (value) =>
      hasExplicitUtcOffset(value)
        ? undefined
        : "expected an ISO 8601 datetime with an explicit UTC offset",
    { identifier: "OKFDateTime" },
  ),
);

const OkfPath = Schema.String.check(
  Schema.makeFilter((value) =>
    value.trim().length > 0 ? undefined : "path must not be empty",
  ),
);

export const OkfGenerated = Schema.Struct({
  by: Schema.String,
  at: Schema.optionalKey(OkfDateTime),
});

export type OkfGenerated = typeof OkfGenerated.Type;

export const OkfVerification = Schema.Struct({
  by: Schema.String,
  at: OkfDateTime,
});

export type OkfVerification = typeof OkfVerification.Type;

export const OkfUsageWindow = Schema.Struct({
  from: OkfDateTime,
  to: OkfDateTime,
});

export type OkfUsageWindow = typeof OkfUsageWindow.Type;

export const OkfSource = Schema.Struct({
  resource: OkfPath,
  id: Schema.optionalKey(Schema.String),
  title: Schema.optionalKey(Schema.String),
  author: Schema.optionalKey(Schema.String),
  usage_count: Schema.optionalKey(Schema.Finite),
  last_modified: Schema.optionalKey(OkfDateTime),
  usage_window: Schema.optionalKey(OkfUsageWindow),
});

export type OkfSource = typeof OkfSource.Type;

export const OkfComputationParameter = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
  required: Schema.Boolean,
});

export type OkfComputationParameter = typeof OkfComputationParameter.Type;

export const OkfExecutor = Schema.Struct({
  resource: OkfPath,
  receipt: Schema.Array(Schema.String),
});

export type OkfExecutor = typeof OkfExecutor.Type;

export const OkfAttester = Schema.Struct({
  resource: OkfPath,
});

export type OkfAttester = typeof OkfAttester.Type;

export const OkfStatus = Schema.Literals(["draft", "stable", "deprecated"]);
export type OkfStatus = typeof OkfStatus.Type;

export const OkfTrustTier = Schema.Literals([
  "unverified",
  "machine-confirmed",
  "human-reviewed",
]);
export type OkfTrustTier = typeof OkfTrustTier.Type;

const OkfVerifications = Schema.Union([
  Schema.Array(OkfVerification),
  OkfVerification,
]).pipe(
  Schema.decodeTo(Schema.Array(OkfVerification), {
    decode: SchemaGetter.transform((input) =>
      Array.isArray(input) ? input : [input],
    ),
    encode: SchemaGetter.transform((input) => input),
  }),
);

const OkfMetadataFields = Schema.Struct({
  generated: Schema.optionalKey(OkfGenerated),
  verified: OkfVerifications.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([])),
  ),
  sources: Schema.Array(OkfSource).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([])),
  ),
  usageWindow: Schema.optionalKey(OkfUsageWindow),
  status: OkfStatus.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("stable")),
  ),
  staleAfter: Schema.optionalKey(OkfDateTime),
  runtime: Schema.optionalKey(Schema.NonEmptyString),
  parameters: Schema.Array(OkfComputationParameter).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([])),
  ),
  computation: Schema.optionalKey(OkfPath),
  executor: Schema.optionalKey(OkfExecutor),
  attester: Schema.optionalKey(OkfAttester),
});

const omitInvalid = <S extends Schema.Constraint>(schema: S) =>
  Schema.catchDecoding<S>(() =>
    Effect.succeed<Option.Option<S["Type"]>>(Option.none()),
  )(schema);

const defaultInvalid = <S extends Schema.Constraint>(
  schema: S,
  fallback: S["Type"],
) =>
  Schema.catchDecoding<S>(() =>
    Effect.succeed<Option.Option<S["Type"]>>(Option.some(fallback)),
  )(schema);

const OkfMetadataRecoveredFields = OkfMetadataFields.mapFields((fields) => ({
  generated: omitInvalid(fields.generated),
  verified: defaultInvalid(fields.verified, []),
  sources: defaultInvalid(fields.sources, []),
  usageWindow: omitInvalid(fields.usageWindow),
  status: defaultInvalid(fields.status, "stable"),
  staleAfter: omitInvalid(fields.staleAfter),
  runtime: omitInvalid(fields.runtime),
  parameters: defaultInvalid(fields.parameters, []),
  computation: omitInvalid(fields.computation),
  executor: omitInvalid(fields.executor),
  attester: omitInvalid(fields.attester),
}));

export const OkfMetadataFrontmatter = OkfMetadataFields.pipe(
  Schema.encodeKeys({
    usageWindow: "usage_window",
    staleAfter: "stale_after",
  }),
);

const {
  usageWindow: recoveredUsageWindow,
  staleAfter: recoveredStaleAfter,
  ...recoveredMetadataFields
} = OkfMetadataRecoveredFields.fields;

export const OkfMetadataRecoveredFrontmatter = Schema.Struct({
  ...recoveredMetadataFields,
  usage_window: recoveredUsageWindow,
  stale_after: recoveredStaleAfter,
});

export type OkfMetadataRecoveredFrontmatter =
  typeof OkfMetadataRecoveredFrontmatter.Type;

export type OkfMetadataFrontmatter = typeof OkfMetadataFrontmatter.Type;

export const OkfMetadata = OkfMetadataFields.pipe(
  Schema.fieldsAssign({ trustTier: OkfTrustTier }),
);

export type OkfMetadata = typeof OkfMetadata.Type;

export const metadataFromFrontmatter = (
  frontmatter: OkfMetadataFrontmatter,
): OkfMetadata =>
  OkfMetadata.make({
    ...frontmatter,
    trustTier:
      frontmatter.verified.length === 0
        ? "unverified"
        : Arr.some(frontmatter.verified, ({ by }) => by.startsWith("human:"))
          ? "human-reviewed"
          : "machine-confirmed",
  });

export const metadataFromRecoveredFrontmatter = ({
  usage_window: usageWindow,
  stale_after: staleAfter,
  ...frontmatter
}: OkfMetadataRecoveredFrontmatter): OkfMetadata =>
  metadataFromFrontmatter({
    ...frontmatter,
    ...(usageWindow === undefined ? {} : { usageWindow }),
    ...(staleAfter === undefined ? {} : { staleAfter }),
  });

export const emptyOkfMetadata = OkfMetadata.make({
  verified: [],
  sources: [],
  status: "stable",
  trustTier: "unverified",
  parameters: [],
});

export const isStaleAt = (
  metadata: OkfMetadata,
  now: DateTime.DateTime,
): boolean =>
  pipe(
    Option.fromNullishOr(metadata.staleAfter),
    Option.filter(hasExplicitUtcOffset),
    Option.flatMap(DateTime.make),
    Option.exists((staleAfter) =>
      DateTime.isGreaterThanOrEqualTo(now, staleAfter),
    ),
  );

/** Accept both YAML arrays and comma-separated strings, normalize to array */
const Tags = Schema.Union([
  Schema.Array(Schema.String),
  Schema.String.pipe(
    Schema.decodeTo(Schema.Array(Schema.String), {
      decode: SchemaGetter.transform((s: string) =>
        s
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      ),
      encode: SchemaGetter.transform((arr: ReadonlyArray<string>) =>
        arr.join(", "),
      ),
    }),
  ),
]);

export const ConceptFrontmatter = Schema.Struct({
  type: Schema.NonEmptyString.annotate({
    description: "Kind of concept — MUST be non-empty (OKF §4.1, §9)",
  }),
  title: Schema.optional(
    Schema.String.annotate({ description: "Human-readable title (OKF §4.1)" }),
  ),
  description: Schema.optional(
    Schema.String.annotate({
      description: "Brief summary of the concept (OKF §4.1)",
    }),
  ),
  resource: Schema.optional(
    Schema.String.annotate({
      description: "URI identifying the underlying asset (OKF §4.1)",
    }),
  ),
  tags: Schema.optional(Tags),
  timestamp: Schema.optional(
    Schema.String.annotate({
      description: "ISO 8601 datetime (OKF §4.1)",
    }),
  ),
});

export type ConceptFrontmatter = typeof ConceptFrontmatter.Type;

export const Concept = Schema.Struct({
  id: Schema.String,
  path: Schema.String,
  frontmatter: ConceptFrontmatter,
  metadata: OkfMetadata,
  metadataIssues: Schema.Array(Schema.String),
  body: Schema.String,
  document: MarkdownDocument,
  links: Schema.Array(ConceptLink),
});

export type Concept = typeof Concept.Type;

export const IndexFile = Schema.Struct({
  path: Schema.String,
  content: Schema.String,
  version: Schema.optional(Schema.String),
});

export type IndexFile = typeof IndexFile.Type;

export const IndexFrontmatter = Schema.Struct({
  okf_version: Schema.optional(Schema.String),
});

export type IndexFrontmatter = typeof IndexFrontmatter.Type;

/** URI pattern for the SHOULD-level resource validation in OKF §4.1. */
export const ResourceUri = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9+.-]*:\S+$/, {
    description: "A valid URI (OKF §4.1)",
  }),
);

export const LogFile = Schema.Struct({
  path: Schema.String,
  content: Schema.String,
});

export type LogFile = typeof LogFile.Type;

export const Bundle = Schema.Struct({
  root: Schema.String,
  concepts: Schema.Array(Concept),
  indexFiles: Schema.Array(IndexFile),
  logFiles: Schema.Array(LogFile),
  version: Schema.optional(Schema.String),
});

export type Bundle = typeof Bundle.Type;

export const ConceptNode = Schema.Struct({
  id: Schema.String,
  path: Schema.String,
  type: Schema.String,
  title: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  resource: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
  status: OkfStatus,
  trustTier: OkfTrustTier,
});

export type ConceptNode = typeof ConceptNode.Type;

export const ConceptEdge = Schema.Struct({
  kind: Schema.Literals(["concept-link", "parent-child", "citation"]),
  sourceId: Schema.String,
  targetId: Schema.String,
  label: Schema.optional(Schema.String),
  relation: Schema.optional(Schema.String),
});

export type ConceptEdge = typeof ConceptEdge.Type;

export const UnresolvedLink = Schema.Struct({
  sourceId: Schema.String,
  targetId: Schema.String,
  label: Schema.optional(Schema.String),
  relation: Schema.optional(Schema.String),
});

export type UnresolvedLink = typeof UnresolvedLink.Type;

export type OkfGraph = {
  readonly graph: Graph.DirectedGraph<ConceptNode, ConceptEdge>;
  readonly nodeIndex: ReadonlyMap<string, Graph.NodeIndex>;
  readonly unresolvedLinks: ReadonlyArray<UnresolvedLink>;
};

const resolveConceptResource = (
  sourceId: string,
  resource: string,
): string | undefined => {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(resource)) return undefined;
  const path = resource.split(/[?#]/u, 1)[0];
  if (path === undefined || path === "") return undefined;
  const segments = (
    path.startsWith("/")
      ? path.slice(1)
      : `${sourceId.slice(0, sourceId.lastIndexOf("/") + 1)}${path}`
  ).split("/");
  const normalized: Array<string> = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (normalized.length === 0) return undefined;
      normalized.pop();
    } else normalized.push(segment);
  }
  return normalized.join("/").replace(/\.md$/u, "");
};

/** Derives the graph representation solely from an already decoded bundle. */
export const graphFromBundle = (bundle: Bundle): OkfGraph => {
  const nodeIndex = new Map<string, Graph.NodeIndex>();
  const graph = Graph.directed<ConceptNode, ConceptEdge>((mutable) => {
    for (const concept of bundle.concepts) {
      nodeIndex.set(
        concept.id,
        Graph.addNode(
          mutable,
          ConceptNode.make({
            id: concept.id,
            path: concept.path,
            type: concept.frontmatter.type,
            tags: concept.frontmatter.tags ?? [],
            title: concept.frontmatter.title,
            description: concept.frontmatter.description,
            resource: concept.frontmatter.resource,
            status: concept.metadata.status,
            trustTier: concept.metadata.trustTier,
          }),
        ),
      );
    }

    for (const concept of bundle.concepts) {
      const source = nodeIndex.get(concept.id);
      if (source === undefined) continue;

      for (const link of concept.links) {
        if (link._tag !== "internal") continue;
        const target = nodeIndex.get(link.target);
        if (target === undefined) continue;
        Graph.addEdge(
          mutable,
          source,
          target,
          ConceptEdge.make({
            kind: "concept-link",
            sourceId: concept.id,
            targetId: link.target,
            label: link.label,
            relation: link.relation,
          }),
        );
      }

      for (const provenanceSource of concept.metadata.sources) {
        const targetId = resolveConceptResource(
          concept.id,
          provenanceSource.resource,
        );
        if (targetId === undefined) continue;
        const target = nodeIndex.get(targetId);
        if (target === undefined) continue;
        Graph.addEdge(
          mutable,
          source,
          target,
          ConceptEdge.make({
            kind: "citation",
            sourceId: concept.id,
            targetId,
            label: provenanceSource.title ?? provenanceSource.id,
            relation: "source",
          }),
        );
      }
    }
  });

  return {
    graph,
    nodeIndex,
    unresolvedLinks: pipe(
      bundle.concepts,
      Arr.flatMap((concept) =>
        pipe(
          concept.links,
          Arr.filter((link) => link._tag === "broken"),
          Arr.map(({ target, relation }) => ({
            sourceId: concept.id,
            targetId: target,
            relation,
          })),
        ),
      ),
    ),
  };
};

export const ValidationIssueSource = Schema.Literals([
  "concept",
  "index",
  "log",
  "graph",
  "bundle",
]);

export type ValidationIssueSource = typeof ValidationIssueSource.Type;

export const ValidationIssue = Schema.Struct({
  id: Schema.String,
  source: ValidationIssueSource,
  reason: Schema.String,
  severity: Schema.Literals(["error", "warning"]),
});

export type ValidationIssue = typeof ValidationIssue.Type;

export const ValidationResult = Schema.Struct({
  valid: Schema.Boolean,
  issues: Schema.Array(ValidationIssue),
});

export type ValidationResult = typeof ValidationResult.Type;

export const OkfSourceInput = Schema.TaggedUnion({
  Local: {
    input: Schema.String,
    path: Schema.String,
  },
  Git: {
    input: Schema.String,
    repoUrl: Schema.String,
    ref: Schema.String,
    subpath: Schema.String,
  },
});

export type OkfSourceInput = typeof OkfSourceInput.Type;

export const ResolvedOkfSource = Schema.Struct({
  input: Schema.String,
  bundlePath: Schema.String,
  source: OkfSourceInput,
  checkoutPath: Schema.optional(Schema.String),
  commit: Schema.optional(Schema.String),
});

export type ResolvedOkfSource = typeof ResolvedOkfSource.Type;
