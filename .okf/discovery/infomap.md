---
type: Algorithm
title: "Infomap"
description: "Finds groups where a simulated reader frequently revisits nearby pages."
timestamp: 2026-11-26T09:53:06Z
tags: [communities, random-walks, compression]
---

# Infomap

Imagine shortening a transcript of the pages a reader visits. If the reader keeps returning to the same little group, give the group a name and reuse short page names inside it. Infomap looks for groups that make the transcript shortest. It can group pages that link in a way that keeps the simulated reader nearby.

## Houseplants example

A reader investigating pests might also need the pest response workflow, a specific symptom, or a humidity concept. These pages are spread across folders. A small experiment using a simplified version of Infomap grouped them together. A different algorithm, Leiden, looks for dense groups. Compare either view with folders and tags before deciding whether it helps readers.

The recorded experiment used a simplified greedy search. Compare its groups with [mutual reachability](../routes/strongly-connected-components.md).

[Rosvall and Bergstrom on Infomap](https://doi.org/10.1073/pnas.0706851105) · [Traag et al. on Leiden](https://www.nature.com/articles/s41598-019-41695-z).
