import type { MarkdownBlock } from "@repo/domain/Markdown";
import type { Bundle, Concept } from "@repo/domain/Okf";
import { Array as Arr, Order, pipe, String } from "effect";
import { proportion, summarizeDistribution } from "./GraphStatistics";

export const evaluateBundle = (bundle: Bundle) => {
  const concepts = bundle.concepts;
  const count = concepts.length;
  const nonEmptyBodies = pipe(
    Arr.map(concepts, (concept) => String.trim(concept.body)),
    Arr.filter(String.isNonEmpty),
  );

  return {
    metrics: {
      conceptCount: count,
      metadataCoverage: {
        title: coverageMetric(concepts, (concept) =>
          isMeaningfulString(concept.frontmatter.title),
        ),
        description: coverageMetric(concepts, (concept) =>
          isMeaningfulString(concept.frontmatter.description),
        ),
        tags: coverageMetric(
          concepts,
          (concept) => (concept.frontmatter.tags?.length ?? 0) > 0,
        ),
        timestamp: coverageMetric(concepts, (concept) =>
          isMeaningfulString(concept.frontmatter.timestamp),
        ),
      },
      emptyBodyRate: proportion(count - nonEmptyBodies.length, count),
      wordCount: summarizeDistribution(
        Arr.map(nonEmptyBodies, (body) => body.split(/\s+/u).length),
      ),
      contentCoverage: {
        heading: coverageMetric(concepts, (concept) =>
          hasBlock(concept.document.blocks, "Heading"),
        ),
        list: coverageMetric(concepts, (concept) =>
          hasBlock(concept.document.blocks, "List"),
        ),
        codeBlock: coverageMetric(concepts, (concept) =>
          hasBlock(concept.document.blocks, "CodeBlock"),
        ),
      },
    },
    findings: [
      ...duplicateFindings(concepts, "duplicate-title", (concept) =>
        concept.frontmatter.title === undefined
          ? undefined
          : pipe(concept.frontmatter.title, String.trim, String.toLowerCase),
      ),
      ...duplicateFindings(concepts, "duplicate-body", (concept) =>
        String.trim(concept.body),
      ),
    ],
  };
};

const isMeaningfulString = (value: string | undefined): boolean =>
  value !== undefined && String.isNonEmpty(String.trim(value));

const coverageMetric = (
  concepts: ReadonlyArray<Concept>,
  predicate: (concept: Concept) => boolean,
) => proportion(Arr.countBy(concepts, predicate), concepts.length);

const hasBlock = (
  blocks: ReadonlyArray<MarkdownBlock>,
  target: MarkdownBlock["_tag"],
): boolean =>
  Arr.some(
    blocks,
    (block) =>
      block._tag === target ||
      (block._tag === "Blockquote" && hasBlock(block.children, target)) ||
      (block._tag === "List" &&
        Arr.some(block.items, (item) => hasBlock(item, target))),
  );

const duplicateFindings = (
  concepts: ReadonlyArray<Concept>,
  tag: "duplicate-title" | "duplicate-body",
  normalize: (concept: Concept) => string | undefined,
) => {
  const groups = new Map<string, Array<string>>();

  for (const concept of concepts) {
    const normalized = normalize(concept);

    if (normalized === undefined || String.isEmpty(normalized)) continue;

    const conceptIds = groups.get(normalized) ?? [];
    conceptIds.push(concept.id);
    groups.set(normalized, conceptIds);
  }

  return pipe(
    [...groups.values()],
    Arr.filter((conceptIds) => conceptIds.length > 1),
    Arr.map((conceptIds) => pipe(conceptIds, Arr.sort(Order.String))),
    Arr.sort(
      Order.mapInput(Order.String, (conceptIds: ReadonlyArray<string>) =>
        conceptIds.join("\u0000"),
      ),
    ),
    Arr.map((conceptIds) => ({
      _tag: tag,
      conceptIds,
    })),
  );
};
