import { describe, expect, it } from "@effect/vitest";
import type { Bundle, OkfMetadata } from "@repo/domain/Okf";
import { evaluateBundle } from "./BundleEvaluation";

describe("evaluateBundle", () => {
  it.each([
    {
      source: "generated.at",
      frontmatter: { type: "Note" },
      metadata: {
        generated: { by: "agent/1.0", at: "2026-08-01T00:00:00Z" },
      },
    },
    {
      source: "legacy timestamp",
      frontmatter: { type: "Note", timestamp: "2026-08-01T00:00:00Z" },
      metadata: {},
    },
  ])(
    "should count timestamp coverage when $source is present",
    ({ frontmatter, metadata }) => {
      const okfMetadata: OkfMetadata = {
        verified: [],
        sources: [],
        status: "stable",
        trustTier: "unverified",
        parameters: [],
        ...metadata,
      };
      const bundle: Bundle = {
        root: "/test",
        concepts: [
          {
            id: "concept",
            path: "concept.md",
            frontmatter,
            metadata: okfMetadata,
            metadataIssues: [],
            body: "Concept body",
            document: { blocks: [] },
            links: [],
          },
        ],
        indexFiles: [],
        logFiles: [],
      };

      expect(evaluateBundle(bundle).metrics.metadataCoverage.timestamp).toBe(1);
    },
  );
});
