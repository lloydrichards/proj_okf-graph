---
name: okf
description: Write or update Open Knowledge Format (OKF) concepts when a repository decision, contract, or workflow changes. Use to decide what belongs in the bundle, find the existing concept that owns it, and ground the change in sources.
---

# Write durable OKF concepts

Start with the question a future reader will need to answer. For a retry change, that might be "When can a client safely submit the same request twice?" The answer belongs in OKF if readers need the contract, its rationale, or the conditions under which it holds. A transcript of the debugging session and today's test output belong in the task record.

## Find the concept that owns the answer

Read the bundle's root `index.md` if present and follow links to the relevant area. Search for the terminology and paths of the affected sources. For a changed concept, `okf-graph graph neighbors <bundle-path> <concept-id> --json` shows related concepts worth checking. The ID is the bundle-relative path without `.md`.

Check each claim against the relevant implementation, test, accepted decision, or primary research. If a refactor leaves the answer intact, leave the concept and log alone. If code conflicts with an accepted decision, describe the discrepancy and its evidence. A change in implementation alone cannot establish that a decision was reversed.

## Write the answer

When a source adds an exception or extends a rule, put that change in the concept that already explains the rule. Cite the source there. Give a new concept one purpose and a stable filename. State what a reader can rely on, when it applies, and why a constraint or exception matters. Identify proposals as proposals.

- Begin each concept with YAML frontmatter and a nonempty `type`. Choose a useful `title` and `description` consistent with neighboring concepts. Reserve `index.md` for navigation and `log.md` for bundle history.
- Cite the material behind the claim. In OKF v0.2, use `sources` entries with a `resource`. Resolve relative paths from the concept's directory. Preserve existing source IDs and matching footnotes.
- Preserve custom frontmatter. Follow the bundle's lifecycle and provenance conventions. Update `generated.at` for a meaningful content change when the bundle records it. Add a verification event only for a check that actually confirmed the claim against its source.
- Link to a related concept where a reader needs the relationship. Explain it in the sentence around the link and use the bundle's link style. Update the section index if readers need a route to the new concept.

Run the repository's OKF check after editing, or run `npx --yes okf-graph@latest validate "<bundle-path>" --json` with Bun available. Read the findings. Structural validation cannot confirm that a cited decision supports the prose. Follow the bundle's log convention for material changes. Report the concept, evidence, and any unresolved question.

For field definitions and version differences, consult the [OKF specification](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md).
