---
type: Concept
title: "Three kinds of evidence in an OKF"
description: "Distinguishes authored links, frontmatter attributes, file locations, and index navigation in a graph analysis."
timestamp: 2026-11-26T11:15:17Z
tags: [okf, graph-modeling, frontmatter, navigation]
---

# Three kinds of evidence in an OKF

| Evidence              | Houseplants example                                              | What it establishes                                                                                                          |
| --------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Authored concept link | Yellowing Leaves → Diagnostic Triage                             | The symptom page points readers to the triage page. An optional link title can describe why.                                 |
| Concept frontmatter   | Diagnostic Triage declares type `Workflow` and tag `diagnostics` | The author classified this page as a workflow about diagnostics.                                                             |
| File location         | Diagnostic Triage lives under `problems/`                        | The workflow was filed with problems.                                                                                        |
| Authored index entry  | The Care index lists Light Acclimation                           | A reader browsing that index has an explicit route to the page. A file can exist in a folder without appearing in its index. |

These facts support different questions. A folder can be a useful scope for browsing. A type can select the kind of answer you want across folders. A link can show how a reader got there. Missing tags and links can reflect incomplete documentation.

A **multilayer graph** keeps these kinds of connections distinct. A page can have a location edge to its folder while a separate index points to it. Tags can stay as labels for filtering. An analysis can also let a reader jump between pages that share a tag, but that step means “similarly classified” and needs to be distinguished from a link the author wrote. Broad tags and large folders can dominate a walk if every such jump counts like a concept link.

The [houseplants snapshot](../foundations/houseplants-snapshot.md) supports comparisons of types, tags, links, and indexes. Its timestamps are identical and it lacks explicit source and verification records, so it cannot test recency or provenance based on those fields.

[De Domenico et al., Mathematical Formulation of Multilayer Networks](https://journals.aps.org/prx/abstract/10.1103/PhysRevX.3.041022).

[Symlink placement](./symlink-placement.md) tests a case where several paths can lead to the same Markdown file and a reader's browsing map may differ from the concept graph.
