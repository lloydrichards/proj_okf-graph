---
type: Experiment
title: "PageRank with metadata and folder filters"
description: "Shows how tags can change a walk's starting points while types and folders narrow its displayed results."
timestamp: 2026-11-26T11:15:17Z
tags: [pagerank, frontmatter, ranking, navigation]
---

# PageRank with metadata and folder filters

The experiment starts from Yellowing Leaves and follows authored links. With ordinary [personalized PageRank](../discovery/pagerank.md), all restart probability goes back to that symptom. In the tag-guided variant, half the restart probability goes to the symptom and half is divided across the other concepts with the selected tag. The `water` tag supplies 12 additional restart pages. The walk still follows the same authored links between restarts.

A second operation chooses which ranked pages to display. It does not recompute scores. Filtering for declared type `Workflow` includes Diagnostic Triage. Filtering for the `workflows/` folder excludes it because it is filed under `problems/`. Type and location give different answers to “find me a workflow.”

Topic-guided restarts can surface pages with no authored path from the symptom. This extends discovery, but it changes the explanation. The reason can be a shared tag, an authored path, or both. Report the origin of the match before treating a high-ranked result as reading guidance.

The demo shows that the two controls change the results in different ways. It does not establish that tag-biased results are more relevant. That requires comparing results against the same reading tasks and judging which pages actually help.

[Interactive ranking comparison](https://github.com/lloydrichards/proj_okf-graph/issues/22/artifacts/1).
