import type { Concept, OkfGraph } from "@repo/domain/Okf";

import { Effect } from "effect";
import { Box } from "effect-boxes";
import { ConceptDocumentPanel } from "./ConceptDocumentPanel";

export const ConceptCard = (concept: Concept, graph: OkfGraph, width: number) =>
  Effect.sync(() => {
    const graphNode = graph.nodeIndex.get(concept.id);
    if (graphNode === undefined) return Box.nullBox;

    return ConceptDocumentPanel({
      title: concept.frontmatter.title ?? concept.id,
      reference: concept.path,
      type: concept.frontmatter.type,
      tags: concept.frontmatter.tags,
      document: concept.document,
      width,
    }).pipe(Box.pad(2, 0));
  });
