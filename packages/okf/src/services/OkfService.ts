import {
  type Concept,
  ConceptFrontmatter,
  ConceptLink,
  emptyOkfMetadata,
  hasExplicitUtcOffset,
  type IndexFile,
  IndexFrontmatter,
  type LogFile,
  metadataFromRecoveredFrontmatter,
  OkfMetadataFrontmatter,
  OkfMetadataRecoveredFrontmatter,
  graphFromBundle,
  type ValidationIssue,
  type ValidationResult,
} from "@repo/domain/Okf";
import {
  Array as Arr,
  Context,
  Data,
  DateTime,
  Effect,
  FileSystem,
  Layer,
  Option,
  Path,
  pipe,
  Result,
  Schema,
  String as Str,
} from "effect";
import {
  MarkdownParseError,
  MarkdownService,
  type RawLink,
} from "./MarkdownService";
import { SourceResolver } from "./SourceResolver";

export class BundleNotFound extends Data.TaggedError("BundleNotFound")<{
  path: string;
}> {}

export class BundleInvalid extends Data.TaggedError("BundleInvalid")<{
  path: string;
  issues: ReadonlyArray<{
    file: string;
    reason: string;
  }>;
}> {}

const RESERVED_NAMES = new Set(["index.md", "log.md"]);

const warning = (id: string, reason: string) =>
  ({
    id,
    source: "concept",
    reason,
    severity: "warning",
  }) satisfies ValidationIssue;

const conceptWarnings = (concept: Concept) => {
  const issues = Arr.map(concept.metadataIssues, (issue) =>
    warning(concept.id, `Invalid OKF v0.2 metadata: ${issue}`),
  );
  const timestamp = concept.frontmatter.timestamp;
  if (timestamp !== undefined && !hasExplicitUtcOffset(timestamp)) {
    issues.push(
      warning(
        concept.id,
        `Invalid timestamp datetime "${timestamp}" — expected ISO 8601 with an explicit UTC offset`,
      ),
    );
  }
  if (
    concept.frontmatter.type === "Attested Computation" &&
    concept.metadata.runtime === undefined
  ) {
    issues.push(
      warning(concept.id, "Attested Computation requires a non-empty runtime"),
    );
  }
  const resource = concept.frontmatter.resource;
  if (resource !== undefined && Str.isEmpty(Str.trim(resource))) {
    issues.push(warning(concept.id, "resource must not be empty"));
  }
  return issues;
};

export class OkfService extends Context.Service<OkfService>()(
  "@repo/OkfService",
  {
    make: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const md = yield* MarkdownService;
      const sourceResolver = yield* SourceResolver;

      const parentDir = (id: string) =>
        pipe(
          id,
          Str.lastIndexOf("/"),
          Option.map((i) => Str.slice(0, i)(id)),
          Option.getOrElse(() => ""),
        );

      const classifyLink =
        (conceptId: string, knownIds: ReadonlySet<string>) =>
        (link: RawLink) => {
          if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(link.target)) {
            return ConceptLink.cases.external.make({
              target: link.target,
              label: link.label,
              relation: link.title,
            });
          }
          const pathTarget = link.target.split(/[?#]/, 1)[0] ?? "";
          const relativeTarget = pathTarget.startsWith("/")
            ? pathTarget.slice(1)
            : pathTarget.length === 0
              ? conceptId
              : path.join(parentDir(conceptId), pathTarget);
          const resolvedId = pipe(relativeTarget, Str.replace(/\.md$/, ""));
          return knownIds.has(resolvedId)
            ? ConceptLink.cases.internal.make({
                target: resolvedId,
                label: link.label,
                relation: link.title,
              })
            : ConceptLink.cases.broken.make({
                target: resolvedId,
                relation: link.title,
              });
        };

      const validateIndexFile = Effect.fn("validateIndexFile")(function* (
        rel: string,
        content: string,
      ) {
        const parsed = yield* md.parse(content);

        if (Option.isNone(parsed.frontmatter)) {
          return { path: rel, content } satisfies IndexFile;
        }

        if (rel !== "index.md") {
          return yield* new MarkdownParseError({
            reason: "Frontmatter is only permitted in the bundle-root index.md",
          });
        }

        return yield* Schema.decodeUnknownEffect(IndexFrontmatter)(
          parsed.frontmatter.value,
          { onExcessProperty: "error" },
        ).pipe(
          Effect.map(({ okf_version }) => ({
            path: rel,
            content,
            ...(okf_version ? { version: okf_version } : {}),
          })),
          Effect.mapError(
            (error) => new MarkdownParseError({ reason: String(error) }),
          ),
        );
      });

      const validateLogFile = Effect.fn("validateLogFile")(function* (
        rel: string,
        content: string,
      ) {
        const parsed = yield* md.parseDocument(content);

        const invalidDateHeading = pipe(
          parsed.document.blocks,
          Arr.findFirst((block) => {
            if (block._tag !== "Heading" || block.level !== 2) return false;
            const value = block.children
              .filter((child) => child._tag === "Text")
              .map((child) => child.value)
              .join("")
              .trim();
            return (
              !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
              Option.isNone(DateTime.make(value))
            );
          }),
        );

        if (Option.isSome(invalidDateHeading)) {
          return yield* new MarkdownParseError({
            reason: "Log date headings must use ISO 8601 YYYY-MM-DD format",
          });
        }

        return { path: rel, content } satisfies LogFile;
      });

      const loadBundle = Effect.fn("loadBundle")(function* (
        bundlePath: string,
      ) {
        // 1. Verify path exists and is a directory
        const pathNorm = path.normalize(bundlePath);
        yield* fs.exists(pathNorm);

        yield* fs
          .stat(pathNorm)
          .pipe(
            Effect.flatMap(({ type }) =>
              type !== "Directory"
                ? Effect.fail(new BundleNotFound({ path: bundlePath }))
                : Effect.succeed("Directory"),
            ),
          );

        const bundleRealPath = yield* fs.realPath(pathNorm);
        const readBundleFile = Effect.fn("readBundleFile")(function* (
          rel: string,
        ) {
          const filePath = path.resolve(pathNorm, rel);
          const realPath = yield* fs.realPath(filePath);
          if (
            realPath !== bundleRealPath &&
            !realPath.startsWith(`${bundleRealPath}/`)
          ) {
            return yield* new MarkdownParseError({
              reason: "Markdown file resolves outside the bundle directory",
            });
          }
          return yield* fs.readFileString(realPath, "utf-8");
        });

        // 2. Walk the directory tree for .md files
        const mdFiles = yield* fs
          .readDirectory(pathNorm, { recursive: true })
          .pipe(Effect.map(Arr.filter((e) => e.endsWith(".md"))));

        // 3. Partition reserved files from concept files
        const [conceptFiles, reservedFiles] = Arr.partition(mdFiles, (rel) =>
          RESERVED_NAMES.has(path.basename(rel))
            ? Result.succeed(rel)
            : Result.fail(rel),
        );

        // 4. Parse reserved files
        const reservedEntries = yield* Effect.forEach(
          reservedFiles,
          Effect.fn(function* (rel) {
            const content = yield* readBundleFile(rel);
            return { rel, content, basename: path.basename(rel) };
          }),
        );

        const [logEntries, indexEntries] = Arr.partition(
          reservedEntries,
          (entry) =>
            entry.basename === "index.md"
              ? Result.succeed(entry)
              : Result.fail(entry),
        );

        const indexResults = yield* Effect.forEach(
          indexEntries,
          ({ rel, content }) =>
            validateIndexFile(rel, content).pipe(
              Effect.map((file) => Result.succeed(file)),
              Effect.catchTag("MarkdownParseError", (error) =>
                Effect.succeed(
                  Result.fail({ file: rel, reason: error.reason }),
                ),
              ),
            ),
        );

        const logResults = yield* Effect.forEach(
          logEntries,
          ({ rel, content }) =>
            validateLogFile(rel, content).pipe(
              Effect.map((file) => Result.succeed(file)),
              Effect.catchTag("MarkdownParseError", (error) =>
                Effect.succeed(
                  Result.fail({ file: rel, reason: error.reason }),
                ),
              ),
            ),
        );

        const [indexIssues, indexFiles] = Arr.partition(indexResults, (r) => r);
        const [logIssues, logFiles] = Arr.partition(logResults, (r) => r);

        // 5. Parse each concept file once. Retain the document structure in the
        // bundle so EvaluationService does not need to reparse Markdown bodies.
        const parseResults = yield* Effect.forEach(conceptFiles, (rel) =>
          Effect.gen(function* () {
            const raw = yield* readBundleFile(rel);

            return yield* Effect.gen(function* () {
              const parsed = yield* md.parseDocument(raw);
              if (Option.isNone(parsed.frontmatter)) {
                return yield* new MarkdownParseError({
                  reason: "No frontmatter found",
                });
              }
              // Preserve unknown frontmatter keys per OKF §4.1:
              // "Consumers SHOULD preserve unknown keys when round-tripping"
              const frontmatter = yield* Schema.decodeUnknownEffect(
                ConceptFrontmatter,
              )(parsed.frontmatter.value, {
                onExcessProperty: "preserve",
              }).pipe(
                Effect.mapError(
                  (e) => new MarkdownParseError({ reason: String(e) }),
                ),
              );
              const decodedMetadata = Schema.decodeUnknownResult(
                OkfMetadataFrontmatter,
              )(parsed.frontmatter.value, { errors: "all" });
              const metadata = pipe(
                Schema.decodeUnknownResult(OkfMetadataRecoveredFrontmatter)(
                  parsed.frontmatter.value,
                ),
                Result.map(metadataFromRecoveredFrontmatter),
                Result.getOrElse(() => emptyOkfMetadata),
              );
              const metadataIssues = Result.match(decodedMetadata, {
                onSuccess: () => [],
                onFailure: (error) => [String(error)],
              });
              return Result.succeed({
                id: pipe(rel, Str.replace(/\.md$/, "")),
                path: rel,
                frontmatter,
                metadata,
                metadataIssues,
                body: parsed.body,
                document: parsed.document,
                links: parsed.links,
              });
            }).pipe(
              Effect.catchTag("MarkdownParseError", (e) =>
                Effect.succeed(Result.fail({ file: rel, reason: e.reason })),
              ),
            );
          }),
        );

        const [conceptIssues, parsedConcepts] = Arr.partition(
          parseResults,
          (r) => r,
        );
        const issues = [...indexIssues, ...logIssues, ...conceptIssues];

        // Fail fast on conformance issues
        if (Arr.isArrayNonEmpty(issues)) {
          return yield* new BundleInvalid({ path: bundlePath, issues });
        }

        // 6. Classify links (already extracted during parse)
        const knownIds = new Set(Arr.map(parsedConcepts, (c) => c.id));

        const concepts: ReadonlyArray<Concept> = Arr.map(
          parsedConcepts,
          (c) => ({
            ...c,
            links: Arr.map(c.links, classifyLink(c.id, knownIds)),
          }),
        );

        // 7. Extract version from root index file if present
        const rootVersion = Arr.findFirst(
          indexFiles,
          (f) => f.path === "index.md",
        ).pipe(
          Option.flatMap((idx) => Option.fromNullishOr(idx.version)),
          Option.getOrUndefined,
        );

        return {
          root: bundlePath,
          concepts,
          indexFiles,
          logFiles,
          ...(rootVersion ? { version: rootVersion } : {}),
        };
      });

      const loadBundleGraph = Effect.fn("loadBundleGraph")(function* (
        bundlePath: string,
      ) {
        const source = yield* sourceResolver
          .resolve(bundlePath)
          .pipe(
            Effect.catchTag(
              "SourceResolveError",
              () => new BundleNotFound({ path: bundlePath }),
            ),
          );
        const bundle = yield* loadBundle(source.bundlePath).pipe(
          Effect.catchTag(
            "PlatformError",
            () => new BundleNotFound({ path: bundlePath }),
          ),
        );

        return { bundle, graph: graphFromBundle(bundle) } as const;
      });

      return {
        make: Effect.fn("make")(function* (bundlePath: string) {
          return yield* loadBundleGraph(bundlePath);
        }),
        validate: Effect.fn("validate")(function* (bundlePath: string) {
          const { bundle, graph } = yield* loadBundleGraph(bundlePath);

          // Broken links are warnings per OKF spec §5.3:
          // "Consumers MUST tolerate broken links"
          const linkIssues = Arr.map(graph.unresolvedLinks, (link) => ({
            id: `${link.sourceId}->${link.targetId}`,
            source: "graph" as const,
            reason: `Broken internal link from ${link.sourceId} to ${link.targetId}`,
            severity: "warning" as const,
          }));

          const qualityIssues = Arr.flatMap(bundle.concepts, conceptWarnings);

          const knownIndexTargets = new Set([
            ...Arr.map(bundle.concepts, (concept) => concept.id),
            ...Arr.flatMap(bundle.indexFiles, (index) => [
              pipe(index.path, Str.replace(/\.md$/, "")),
              pipe(index.path, Str.replace(/index\.md$/, "")),
            ]),
          ]);
          const indexLinkIssues = yield* Effect.forEach(
            bundle.indexFiles,
            Effect.fn(function* (index) {
              const parsed = yield* md.parse(index.content);
              const sourceId = pipe(
                index.path,
                Str.replace(/index\.md$/, "index"),
              );
              return pipe(
                parsed.links,
                Arr.map(classifyLink(sourceId, knownIndexTargets)),
                Arr.filter((link) => link._tag === "broken"),
                Arr.map((link) => ({
                  id: `${index.path}->${link.target}`,
                  source: "index" as const,
                  reason: `Broken internal link from ${index.path} to ${link.target}`,
                  severity: "warning" as const,
                })),
              );
            }),
            { concurrency: "unbounded" },
          ).pipe(Effect.map(Arr.flatten));

          const issues: ValidationResult["issues"] = [
            ...linkIssues,
            ...qualityIssues,
            ...indexLinkIssues,
          ];

          return {
            // Only conformance errors affect validity
            valid: !Arr.some(issues, (i) => i.severity === "error"),
            issues,
          } satisfies ValidationResult;
        }),
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(MarkdownService.layer),
    Layer.provideMerge(SourceResolver.layer),
    Layer.satisfiesServicesType(),
  );
}
