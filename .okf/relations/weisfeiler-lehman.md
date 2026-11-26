---
type: Algorithm
title: "Weisfeiler–Lehman refinement"
description: "Compares structural roles by repeatedly grouping pages according to their neighbors and link labels."
timestamp: 2026-11-26T09:53:06Z
tags: [similarity, graph-kernels, structure]
---

# Weisfeiler–Lehman refinement

First group pages by type. Then split the groups based on what their immediate neighbors look like, including which way each arrow points. Repeat for the next ring of neighbors. This is Weisfeiler–Lehman refinement.

## Houseplants example

Boston Fern, Peace Lily, and Spider Plant still share a group after two rounds. An editor might compare how those profiles are linked or written. The plants themselves have distinct care needs. With two rounds nearly every page becomes unique in this bundle, so a practical view might compare partial matches.

The grouping grows from six starting classes to 63 after one round and 65 after two. [Formal Concept Analysis](./formal-concept-analysis.md) instead compares chosen attributes directly.

[Shervashidze et al. on Weisfeiler–Lehman graph kernels](https://www.jmlr.org/papers/v12/shervashidze11a.html).
