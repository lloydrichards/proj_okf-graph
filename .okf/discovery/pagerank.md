---
type: Algorithm
title: "Personalized PageRank"
description: "Ranks pages by how often a simulated reader visits them when restarting at a chosen concept."
timestamp: 2026-11-26T09:53:06Z
tags: [probability, ranking, random-walks]
---

# Personalized PageRank

Imagine a reader who chooses one outgoing link at random. On some turns, they jump back to a starting page. Repeat the experiment and count how much time the reader spends on each page. The ranking is called personalized PageRank. Here the reader follows a link 85% of the time and jumps back 15% of the time. They also jump back at dead ends.

## Houseplants example

Watering leads the bundle-wide ranking at 8.88%. Starting from Yellowing Leaves puts its overwatering diagnosis first and brings Soil Moisture Check into the first six results through two indirect routes, via Diagnostic Triage and Yellow Leaves From Overwatering. The scores describe a simulated reader and carry no information about page accuracy or actual readership.

This is a [Markov chain](./markov-chains.md "uses"). From Yellowing Leaves, Yellow Leaves From Overwatering scored 6.24%, excluding the seed from the display.

[Haveliwala on topic-sensitive PageRank](https://www.ra.ethz.ch/CDstore/www2002/refereed/127/).
