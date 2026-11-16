---
name: okf
description: Write or update Open Knowledge Format (OKF) concepts when a repository decision, contract, or workflow changes. Use to decide what belongs in the bundle, find the existing concept that owns it, and ground the change in sources.
---

# Write durable OKF concepts

Identify the question a future reader needs answered. Keep contracts, rationale, conditions, and exceptions. Leave session chatter and transient test output in the task record.

Read the named source, the bundle index if present, and the concept that owns the rule. Search further when ownership, evidence, or the impact on another concept is unclear. To inspect related concepts, use `okf-graph graph neighbors <bundle-path> <concept-id> --json`. The ID is the bundle-relative path without `.md`.

Check the claim against the implementation, test, accepted decision, or primary research that establishes it. If the answer is unchanged, leave the bundle and log alone. If code conflicts with an accepted decision, record the discrepancy. Only a superseding decision establishes a change in policy.

Extend the existing rule in place. Create a concept with a stable filename when the answer needs its own home. State the claim, scope, and supporting evidence. Distinguish proposals from accepted decisions.

- In OKF v0.2, cite evidence in `sources` using a `resource` path relative to the concept. Reuse an existing citation and name the relevant decision or section in prose. Markdown links between concepts create graph edges. Keep references to repository files outside the bundle in `sources`.
- Start concepts with YAML frontmatter and a nonempty `type`. Follow neighboring concepts for `title`, `description`, and lifecycle fields. Preserve custom metadata, source IDs, and footnotes. Update `generated.at` for a material change if the bundle tracks it. Record verification only for a check that confirmed the claim against its source.
- Use `index.md` for navigation and `log.md` for bundle history. Follow the local logging convention. Add links where readers need a route to a related concept.

After editing, run the repository's OKF check or use `npx --yes okf-graph@latest validate "<bundle-path>" --json` with Bun available. Read the findings and report the edited concept, evidence, check result, and unresolved questions.

For field definitions or version differences, consult the [OKF specification](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md).
