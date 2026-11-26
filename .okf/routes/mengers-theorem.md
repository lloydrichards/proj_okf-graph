---
type: Theorem
title: "Menger's theorem"
description: "Connects the number of independent routes to the smallest set of links that can block them all."
timestamp: 2026-11-26T09:53:06Z
tags: [directed-graphs, cuts, resilience]
---

# Menger's theorem

If three routes share no links, removing one link closes at most one route. The directed edge form of Menger's theorem says the largest number of such routes equals the fewest links you must remove to block travel between two distinct pages.

## Houseplants example

From Yellowing Leaves, a single link removal blocks Light Acclimation. Blocking Soil Moisture Check takes three. One such cut removes Watering → Soil Moisture Check, Yellow Leaves From Overwatering → Soil Moisture Check, and Yellowing Leaves → Diagnostic Triage.

Routes that share no links can still share an intermediate page. [Dominators](./dominators.md) identify pages that every route uses.

[Menger, Zur allgemeinen Kurventheorie](https://doi.org/10.4064/fm-10-1-96-115) · [Ford and Fulkerson, Maximal Flow Through a Network](https://doi.org/10.4153/CJM-1956-045-5).
