---
type: Concept
title: "Strongly connected components"
description: "Groups pages when any member can reach any other and return along authored arrows."
timestamp: 2026-11-26T09:53:06Z
tags: [directed-graphs, reachability, navigation]
---

# Strongly connected components

If A can reach B and B can reach A, they belong to the same strongly connected component. A page can form a group of one. Collapse every group to one point. The arrows between points cannot make a loop, because groups on a loop would be mutually reachable and would form one group.

## Houseplants example

The largest of 23 groups contains 45 pages across seven folders. A reader can reach Watering Demand from the large group, but Watering Demand sits outside it and has no outgoing concept links. [Transitive reduction](./transitive-reduction.md) can simplify the map of group-to-group arrows.

[Tarjan, Depth-First Search and Linear Graph Algorithms](https://doi.org/10.1137/0201010).
