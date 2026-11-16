---
name: okf-dream
description: Consolidate an Open Knowledge Format (OKF) bundle after development. Use for periodic cleanup of overlapping concepts, session notes, stale explanations, or competing accounts of the same decision. Supports review-only and unattended cleanup runs.
---

# Consolidate accumulated OKF notes

Start at the bundle index. Follow links into the requested area and look for pages that answer the same reader question. A similar title, low link count, or old timestamp is only a reason to inspect the content. For a review-only request, return proposed edits and their evidence. For a cleanup request, apply supported changes within the specified bundle.

1. Read each candidate beside its sources. Separate established behavior and decision rationale from experiments, discarded ideas, and open questions. Check apparent contradictions against the cited evidence. If the evidence cannot settle a conflict, retain both accounts with their status and report the question for review. Continue with independent edits.
2. Choose the existing concept whose scope and incoming links best fit the answer. Rewrite that answer once. Keep unique conditions, exceptions, rationale, and attribution. For example, two retry notes may repeat the same rule while only one records the timeout at which it stops applying. Preserve that limit and its source in the owning concept.
3. Trace links into and out of each affected page, including index entries, source references, and links to headings. A filename is part of a concept's ID. Prefer editing in place. When retiring an address that other readers may use, keep a short pointer to the owner at the old path, using the bundle's deprecation convention. Rebase relative references moved between directories. Preserve source IDs, footnotes, custom fields, and the scope of existing verification claims.
4. Read the resulting concepts as a reader following the index. Run the repository's OKF checks, or use `npx --yes okf-graph@latest validate "<bundle-path>" --json` with Bun available. Inspect warnings even on success and repair broken references introduced by the cleanup. Report the concepts consolidated, checks run, and conflicts that need a decision.

A repeated run on the same evidence should produce no further edits. Leave settled pages, timestamps, and logs alone when there is no material change. For runs launched by a scheduler, return the same concise report, including a no-change result when appropriate.
