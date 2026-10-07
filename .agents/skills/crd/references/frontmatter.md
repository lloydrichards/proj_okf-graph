# CRD frontmatter

Use standard OKF v0.2 fields and one default extension. Preserve existing extensions without adding them to every document. The CRD body is free to evolve without a mirrored section schema.

| Field                 | Meaning and maintenance                                                                                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                | `Component Requirements Document` for new CRDs. Only a non-empty type is required by OKF. Preserve an established equivalent taxonomy unless conversion is requested.                                                                                                       |
| `title`               | Component name, consistent with its established identity.                                                                                                                                                                                                                   |
| `description`         | Purpose and boundary in one grounded sentence. Revise when scope changes, not after every edit.                                                                                                                                                                             |
| `tags`                | Focused component topics useful for retrieval. Do not encode transient workflow state as tags.                                                                                                                                                                              |
| `status`              | Document lifecycle: `draft`, `stable`, or `deprecated`. Set explicitly because omission defaults to `stable`.                                                                                                                                                               |
| `component_lifecycle` | Component lifecycle, described below. It is a producer extension, not standard OKF.                                                                                                                                                                                         |
| `resource`            | Optional canonical identifier for the component itself. Supporting design, code, and policy belong in sources or body links.                                                                                                                                                |
| `sources`             | Evidence used in the CRD. Each entry needs `resource`; add stable `id` and descriptive `title` when useful. Relative paths resolve from the concept's directory. Use matching source IDs for claim-level footnotes.                                                         |
| `generated`           | `by` identifies the actual current content producer. `at` records its last meaningful change. Preserve both for formatting-only work. Use `human:<id>`, `process:<id>`, or an honest agent/tool identifier such as `codex/crd`.                                             |
| `verified`            | Actual confirmations of document content against its sources, with verifier and time. A check of YAML syntax alone does not verify the requirements. Do not refresh after an unreviewed edit. Existing events describe earlier checks, not blanket approval of new content. |
| `stale_after`         | Optional deliberate freshness deadline. Add only when justified by a real review policy.                                                                                                                                                                                    |

Use ISO 8601 datetimes with an explicit UTC offset. Do not invent a time for date-only evidence. New v0.2 documents use `generated.at`, not a duplicate `timestamp` or `last_updated`. Preserve legacy values during import until a sourced conversion is possible.

For local evidence outside the bundle, put its path in `sources[].resource` and attribute claims with a matching source-ID footnote. Ordinary relative Markdown links become graph links to concepts; a link to a raw image, code file, or review note outside the bundle can therefore appear broken even when the file exists. Use ordinary body links for existing bundle concepts and external URLs. Do not create duplicate evidence concepts merely to eliminate that warning.

## Component lifecycle

Use the article's vocabulary for new CRDs: `requested`, `backlog`, `active`, `built`, `deprecated`. These are component states, independent of OKF document status. The precise boundary between requested, backlog, and active follows the team's actual work policy. If that policy or the current state is unknown, omit the field and record the question in the body.

Change it when a sourced request, scheduling decision, work-start event, accepted implementation, or retirement decision establishes a transition. File presence, a code stub, passing tests, or absence of objections is not sufficient by itself. Built does not mean published. Keep a built component built while an amendment is being discussed unless an actual lifecycle change is decided.

A document may be `draft` while its component is `built`. A stable CRD can describe agreed requirements for a backlog component. Component retirement does not automatically make its explanatory document obsolete; evaluate document status separately.

## Minimal illustration

```yaml
type: Component Requirements Document
title: Switch
description: Requirements and decisions for a binary settings control.
status: draft
tags: [settings, binary-input]
```

Add `component_lifecycle` only when established. Add actual sources and generation metadata when authoring. No default `owner`, `applies_to`, format version, section status, or readiness fields are prescribed. Ownership of particular open questions remains beside those questions.

Bundle version belongs in root `index.md` as `okf_version: "0.2"` when used. Ordinary navigation indexes do not need concept frontmatter. The current local parser preserves extension fields but does not validate or graph-filter `component_lifecycle`.
