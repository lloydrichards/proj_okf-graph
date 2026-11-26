---
type: Algorithm
title: "Transitive reduction"
description: "Hides shortcuts from an acyclic graph while preserving which destinations are reachable."
timestamp: 2026-11-26T09:53:06Z
tags: [directed-graphs, reachability, simplification]
---

# Transitive reduction

If A → B → C already works, removing the direct A → C arrow leaves C reachable. In an acyclic graph, there is a unique smallest set of arrows that preserves all reachable pairs.

## Houseplants example

The [map of mutually reachable groups](./strongly-connected-components.md) drops from 30 arrows to 21 while preserving reachability. The large group can still reach Watering Demand via Dry-Down after the direct shortcut is hidden. The reduced map may require more steps, so an authored shortcut can still serve readers.

[Aho, Garey, and Ullman, The Transitive Reduction of a Directed Graph](https://www.cs.tufts.edu/comp/150FP/archive/al-aho/transitive-reduction.pdf).
