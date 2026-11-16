---
name: okf-dream
description: Reorganize an Open Knowledge Format (OKF) bundle after development. Use for periodic cleanup of handovers, overlapping concepts, and scattered observations. Supports review-only and unattended cleanup runs.
---

# Consolidate accumulated OKF knowledge

Organize the bundle around questions a future reader will need answered. In a cleanup run, prepare a reviewable diff within the requested scope. The caller controls delivery, including whether to open a PR. For a review-only request, describe the proposed changes and leave files untouched.

## Decide what survives

Read the candidate pages alongside their sources. Keep the shortest account that preserves the evidence, rationale, exceptions, attribution, and uncertainty a reader needs. Drop session narration and repeated facts. Keep a unique observation with its source when it could change a future investigation, even if nobody has reproduced it.

Synthesize patterns across records and cite the records that support them. Three recoveries after a restart support a bounded observation about those incidents. A general restart procedure needs evidence of safety and effectiveness. Distinguish what happened, what caused it, and what anyone has approved.

Correct a description of current behavior when implementation and tests establish it. If it conflicts with an accepted decision, preserve the decision and flag the discrepancy. Update decision history when a later accepted decision explicitly supersedes the earlier one.

## Give each answer a home

Start at the index and trace links through the affected area. Merge duplicates, split a handover across topics, move claims to a better owner, or create a concept when no existing page fits. Rename or delete concepts when doing so makes the bundle easier to use. A page containing only incidental detail can disappear entirely.

Check incoming links, heading references, indexes, and known consumers of an ID. Update internal references and rebase relative links and citations that move. Keep source IDs, footnotes, custom metadata, and verification claims attached to the facts they describe. If a known external consumer still needs an address, keep a useful pointer or flag the proposed removal and its impact. Retire an obsolete ID outright when its useful content and references have been accounted for.

## Hand off the diff

Read the affected pages through the index. Run the repository's OKF checks, or use `npx --yes okf-graph@latest validate "<bundle-path>" --json` with Bun available. Inspect warnings and fix broken references the cleanup introduced. Report what ran and any remaining findings.

Group related changes into one short summary. Name retired IDs and where their useful content went, including IDs dropped without replacement. Ask individual questions only where a judgment could change what readers believe or do. Point the reviewer to the evidence and state the choice, such as whether a discrepancy reflects policy change or implementation drift. Continue independent cleanup while leaving unsettled claims open.

When the same evidence already has a concise, accurate home, report no change. Leave settled pages, timestamps, and logs alone.
