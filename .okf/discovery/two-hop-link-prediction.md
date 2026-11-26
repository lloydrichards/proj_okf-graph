---
type: Algorithm
title: "Two-hop link prediction"
description: "Uses authored two-step routes as evidence for possible direct links."
timestamp: 2026-11-26T09:53:06Z
tags: [link-prediction, directed-graphs, evidence]
---

# Two-hop link prediction

If one page links to a second and the second links to a third, the third might be worth linking directly. Start by showing the actual two-step routes. Multiple routes give the editor more leads to inspect. The prototype gives less weight to intermediaries that link to many pages.

## Houseplants example

The Growing Medium page has a natural anchor in the diagnosis’s mention of “medium structure.” Underwatering is useful only if the editor wants to introduce a different diagnosis. The prototype recovered 81 of 241 hidden authored links in its top five, compared with 62 for ranking by popularity. That experiment measures recovery of existing links. An editor would still need to judge the usefulness of newly proposed links.

Two authored routes support Growing Medium, via Soil Moisture Check and Root Rot. A [typed path query](../relations/typed-path-queries.md) can instead require specific relation labels.

[Liben-Nowell and Kleinberg on link prediction](https://people.csail.mit.edu/dln/papers/link/paper.pdf).
