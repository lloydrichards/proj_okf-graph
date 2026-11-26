---
type: Concept
title: "Maximum coverage"
description: "Selects a fixed number of starting pages that collectively reach the most distinct concepts."
timestamp: 2026-11-26T09:53:06Z
tags: [coverage, navigation, optimization]
---

# Maximum coverage

Give each starting link a two-click radius. Count each page once, even where circles overlap. Maximum coverage looks for a fixed number of starts that collectively reach the most pages. A shortcut is to choose whichever next start adds the most new pages.

## Houseplants example

Selecting purely by reach puts Leaf Drop first in the greedy method. This illustrates how the number of reachable pages can differ from the quality of an introduction. The experiment counts the selected concepts themselves and follows authored concept links. Directory navigation is outside the measurement.

With the same two-click budget, the best three actual index recommendations reach 32 of 67 pages. The unrestricted greedy result reaches 46. Exhaustive search reaches 48.

[Nemhauser, Wolsey, and Fisher on maximizing coverage](https://www.cs.cmu.edu/~aarti/Class/10704_Fall16/submod-max.pdf).
