---
type: Experiment
title: "Symlinks as alternate concept placements"
description: "Examines whether one concept can appear in several folders without becoming several graph nodes."
timestamp: 2026-11-26T11:18:57Z
tags: [okf, symlinks, identity, navigation]
---

# Symlinks as alternate concept placements

A symbolic link gives a file another path. If folder placement carries meaning, that path could say “show this concept in another part of the bundle.” In houseplants, Soil Moisture Check could appear in both care and diagnostic workflows while its Markdown and frontmatter live in one place.

That raises two separate questions. Which paths can a reader use to find a page? Which concept should a graph analysis count? The OKF v0.3 specification defines concept IDs from file paths and prohibits following symlinks outside the bundle. It does not specify whether an in-bundle symlink and its target share a concept ID. [OKF specification, terminology and bundle discovery](https://github.com/open-knowledge-format/open-knowledge-format/blob/main/SPEC.md#32-concepts-assets-and-other-files).

## A local experiment

A scratch bundle had two regular concept files, `care/moisture.md` and `care/roots.md`. Moisture linked to `./roots.md`. The local OKF Graph v0.3.0 build used these paths as follows:

| Path observed                                                | What the graph reported                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `care/moisture.md`                                           | A concept with a working link to `care/roots.md`.                                       |
| File symlink `workflows/moisture.md` → `../care/moisture.md` | A second Moisture concept. Its link looked for `workflows/roots.md` and was unresolved. |
| Directory symlink `care-alias` → `care`                      | Two more concept IDs. The link between them resolved inside `care-alias/`.              |

The graph reported five nodes, two resolved edges, and one unresolved link. It exposed no alias relationship. This measures the existing local CLI build. The current source checkout and archive-backed loading were outside the experiment.

## What it opens up

Treating the alternate path as a placement of the same concept would let the [folder and index map](./evidence-layers.md) show two browsing locations while the authored graph counts one page. This is similar to collapsing equivalent nodes in a graph. It raises a concrete research question for [PageRank](../discovery/pagerank.md) and [coverage](../discovery/maximum-coverage.md): how much does a duplicate path change the ranking or reachable page count when the underlying reading material did not change?

Another comparison is to list the same concept in multiple indexes using ordinary Markdown links and use frontmatter tags for cross-cutting classification. Index links give readers curated entry points. Tags describe shared categories. A symlink additionally lets someone browsing the raw file tree open the document from the second folder. If the second context needs its own explanation or outgoing relationships, a separate concept with an authored link can express that distinction.

An alias can record where a concept is placed. A relationship such as “this workflow requires Soil Moisture Check” still needs authored evidence. A follow-up experiment could compare local and archive-backed discovery, relative link resolution, and concept counts across the three representations.
