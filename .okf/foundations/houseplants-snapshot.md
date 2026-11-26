---
type: Dataset
title: "Houseplants research snapshot"
description: "Records the bundle and counting rules behind the worked examples."
timestamp: 2026-11-26T09:53:06Z
tags: [okf, houseplants, evidence]
---

# Houseplants research snapshot

The examples use `examples/house-plants-okf` in this repository. The directed graph contains 67 concept pages and 241 distinct links after removing self-links and duplicates. Of those links, 22 have an explicit relation label. Treating the links as two-way gives 207 distinct undirected connections. The nine index files provide separate navigation. Citations and index navigation are outside this graph.

These examples describe one set of authored links under stated assumptions. The same methods can give different results for other OKFs or later versions of this bundle.

[Houseplants experiments and issue artifacts](https://github.com/lloydrichards/proj_okf-graph/issues/19).

## Metadata available for comparison

All 67 concepts have a declared type, title, description, and tags. All carry the same timestamp, 25 June 2026 at 00:00 UTC. No concept explicitly declares `status`, `verified`, `resource`, or `sources`. The [evidence comparison](../combined-evidence/evidence-layers.md) uses the fields available in this snapshot and keeps authored index entries separate from folder membership.
