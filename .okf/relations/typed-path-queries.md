---
type: Concept
title: "Typed path queries"
description: "Finds paths by matching the labels on their successive authored links."
timestamp: 2026-11-26T09:53:06Z
tags: [relations, path-queries, evidence]
---

# Typed path queries

A path query can ask for a specific sequence of relation labels. From Plant Difficulty, follow an outgoing link labeled `example of`, then an outgoing link labeled `requires`. The first label is used exactly as written and points from the overview to an example in this bundle.

## Houseplants example

The pattern finds seven paths to five care concepts. Drainage Hole and Growing Medium each have two witnesses, through Aloe Vera and Orchid. Direct Sun has one, through Aloe Vera. The paths show which requirements the examples name. [Provenance](./provenance-semirings.md) records the alternatives. Only 22 of the 241 links carry relation titles, so an empty result can also mean a label is missing.

[Mendelzon and Wood, Finding Regular Simple Paths in Graph Databases](https://www.vldb.org/conf/1989/P185.PDF).
