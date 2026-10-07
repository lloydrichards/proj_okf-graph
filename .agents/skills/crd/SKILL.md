---
name: crd
description: Create, amend, review, and maintain Component Requirements Documents inside Open Knowledge Format bundles. Use for component intent, requirements, design and implementation decisions, usage guidance, and CRD lifecycle updates. Ordinary component implementation or general Markdown editing alone does not require this skill.
---

# CRD for OKF

Keep one stable OKF concept per component. Its CRD carries intent, current requirements, unresolved questions, and the reasons behind decisions throughout design, implementation, and use. Other sources retain facts they own.

## Select the work

- **Explore or review:** inspect the CRD and relevant sources, then report findings without edits unless fixes are requested.
- **Create:** read [references/authoring.md](references/authoring.md), then use [assets/crd-template.md](assets/crd-template.md) as a starting shape. Adapt it to available evidence and consumers.
- **Maintain or amend:** read [references/maintenance.md](references/maintenance.md). Update the existing document rather than creating a parallel requirements or amendment file.
- **Convert:** use the authoring and maintenance guidance. Convert on substantive edits when useful. Preserve IDs, evidence, unknown metadata, and missing information.

Read [references/frontmatter.md](references/frontmatter.md) when creating or changing metadata. It defines OKF v0.2 fields and the single default CRD extension, `component_lifecycle`.

## Locate the authority

Identify the requested bundle and component. Follow repository instructions and existing navigation. Prefer an existing bundle; if none exists, create a requested bundle at the repository's established location or use `.okf/` as a stated default. Use `components/<stable-name>.md` only when no component convention exists. Keep the path stable across lifecycle changes.

Start with the bundle index, then relevant CRDs and their sources. Search for the component and changed source paths with `rg`. Read sibling decisions relevant to this component, not the entire corpus. Use graph neighborhoods when the CLI is available.

Separate supplied decisions, observed implementation, and proposals. A precedent can inform a question without becoming a global rule. Where code, design, and documented intent disagree, report the conflict and follow an established authority rule or ask for the decision. Code alone does not prove intended behavior or rationale.

## Keep one origin per fact

- Put purpose, anatomy, component-specific requirements, rejected alternatives, and dated reasons in the CRD.
- Link to visual specifications, token bindings, code APIs, and shared policy where those facts originate. A Figma or CMS table can carry a distinct design or consumer contract; identify its authority before adding it. Avoid independently maintained copies of code props.
- Keep component-local decisions in the same document. Reference shared decisions rather than repeating their reasoning across CRDs.
- Keep open matters visible at their point of use. Preserve `[open]` and `[review]` markers and an open-question table when present.
- Stages contribute knowledge through repeated design and implementation loops. Do not impose one stored stage, section-progress map, readiness flag, blocker count, acceptance checklist, or test-results summary in frontmatter.

## Write and maintain

Use evidence for every substantive claim. Leave gaps empty or explicitly unresolved. Ask only for decisions that available sources and prior user instructions do not settle. Continue independent work while an answer is pending, but do not close the dependent question or advance its requirement as agreed.

A maintenance or review request can finish with recorded open questions. Ask for a decision during the task when the requested outcome depends on resolving it, rather than starting an interview for every unknown.

Give observable requirements stable category IDs using the bundle's convention. F, S, B, C, A, and I cover functional requirements, states, behaviour, content, accessibility, and integration. Preserve existing IDs during edits. The authoring reference explains splitting, retirement, and human-review criteria. For new CRDs, retain the template's distinct requirement categories, Purpose and Scope, and design/implementation decision sections. Adapt empty sections to evidence rather than flattening them into a general obligations list.

Update descriptions, sources, and lifecycle only when their meaning changes. Update `generated` for substantive knowledge changes using the actual writer and current time. Do not invent verification, dates, owners, lifecycle events, rejected options, or approved rationale. Check changed claims against their current source, including usage summaries. Historical sources must not appear to authorize superseding decisions. Review the CRD's derived documentation when its meaning changes and update only artifacts within the authorized task.

## Assess readiness when asked

Compute readiness for the requested next activity from the document and available review evidence. For development, inspect requirements, authoritative design information, joint designer/developer review, inline `[open]` markers, open-question rows, pending amendments, and unresolved source conflicts. Missing review evidence is unknown, not approval. Report specific blockers and what would resolve them.

`[review]` identifies a human-assessed criterion, not automatically an unresolved design decision. Check what review the next activity actually requires. Optional brand and CMS guidance needs an applicability decision, not guessed completion. A built component or stable document does not by itself establish readiness or test success.

## Validate and report

Use the target repository's existing OKF check workflow. In this repository, from its root:

```bash
bun start -- validate <bundle-path> --json
bun start -- graph neighbors <bundle-path> <concept-id> --json
```

Elsewhere, discover the available `okf-graph` command and check its help. Do not silently install a latest version or assume this repository's runner exists there. If tooling is unavailable, inspect YAML, paths, and metadata manually and state that CLI validation was not run.

Review semantics separately: requirements are atomic and use anatomy consistently; IDs are unique; unresolved matters remain visible; decisions have grounded reasons; source ownership is clear; lifecycle has evidence. Structural validation cannot establish those facts or runtime behavior. Execute component tests only when verification is in scope and the relevant implementation is available.

Check changed source links and relevant graph neighborhoods. Keep broad navigation in indexes and relationships selective. Treat unresolved links as tolerated by OKF, while following stricter repository rules where present. Add a concise knowledge-change entry to an existing bundle log when its convention requires it. Do not create a changelog inside every CRD.

Report the file and changed knowledge, sources inspected, unresolved questions, lifecycle changes, and exact checks run. Distinguish structural validity, semantic findings, and runtime verification. State when no durable knowledge needed changing.

## Basis

This skill is a local adaptation, not the author's published CRD v2 skill. Read [references/basis.md](references/basis.md) when revisiting its design or choosing additional design-system practices.
