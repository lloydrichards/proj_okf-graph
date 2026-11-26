---
type: Experiment
title: "Reachability through concepts and indexes"
description: "Shows how an authored index can keep a page discoverable when a directed route from a symptom breaks."
timestamp: 2026-11-26T11:15:17Z
tags: [reachability, indexes, directed-graphs, resilience]
---

# Reachability through concepts and indexes

The [directed cut experiment](../routes/mengers-theorem.md) found one link whose removal blocks every authored concept route from Yellowing Leaves to Light Acclimation. That link runs from Yellow Leaves From Low Light to Light Acclimation.

If a reader can return to the root index, the destination remains reachable through another route:

```text
Root index → Care index → Light Acclimation
```

The experiment checked both explicit index entries. It did not infer the second arrow merely from the location of the file. The reader can still find the destination, but returning to the index does not restore the transition from a diagnosis to a remedy. The two routes answer different questions.

This distinction also changes [coverage](../discovery/maximum-coverage.md). Count what the index actually lists separately from what the file tree contains. Then group missed destinations by type or tag to see whether the gaps affect a topic, a kind of page, or only a particular starting route.

[Interactive route comparison](https://github.com/lloydrichards/proj_okf-graph/issues/20/artifacts/1).
