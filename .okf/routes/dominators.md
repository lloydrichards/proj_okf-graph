---
type: Concept
title: "Dominators"
description: "Identifies pages every authored route from a chosen entry must pass through."
timestamp: 2026-11-26T09:53:06Z
tags: [directed-graphs, reachability, resilience]
---

# Dominators

Pick a start and a reachable destination. If every route between them passes through the same intermediate page, that page dominates the destination from this start. Try hiding the page. If the destination disappears from the reachable set, the page was mandatory.

## Houseplants example

From Yellowing Leaves, every authored route to Light Acclimation and Insufficient Light passes through Yellow Leaves From Low Light. Starting from a different concept or following index links can change the answer. [Menger's theorem](./mengers-theorem.md) answers the related question for sets of links.

[Lengauer and Tarjan, A Fast Algorithm for Finding Dominators in a Flowgraph](https://doi.org/10.1145/357062.357071).
