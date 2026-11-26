---
type: Concept
title: "Markov chains"
description: "Describes a process whose next move depends on its current state."
timestamp: 2026-11-26T09:53:06Z
tags: [probability, random-walks, navigation]
---

# Markov chains

Imagine a reader rolling a die at each page. The page determines which links can be followed and the rules determine the odds. In a Markov chain, the current state determines the probabilities for the next state. The reader's earlier steps need not enter the rule.

In the [houseplants snapshot](../foundations/houseplants-snapshot.md), outgoing links provide destinations. An analyst still has to choose the odds and a rule for dead ends. [Personalized PageRank](./pagerank.md) models a reader who repeatedly returns to a starting page. [Infomap](./infomap.md) groups pages based on the movement of a simulated reader.
