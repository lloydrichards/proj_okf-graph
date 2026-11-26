---
type: Research
title: "Questions that need more than one method"
description: "Pairs graph methods with metadata and folder evidence to frame testable OKF research questions."
timestamp: 2026-11-26T11:15:17Z
tags: [graph-theory, research, frontmatter, evaluation]
---

# Questions that need more than one method

The houseplants experiments show that metadata can narrow or seed a search, refine a group, and help interpret what a route represents. The combinations below are hypotheses. Their value still needs to be measured.

| Combination                                                                                                                             | What the combination adds                                                                                                                                         | What to compare                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [PageRank](../discovery/pagerank.md) + [Steiner trees](../discovery/steiner-trees.md)                                                   | Rank candidates, select pages in complementary roles such as symptom and workflow, then connect them with a small map that may introduce a useful junction.       | Compare with ranking alone and with ordinary shortest paths. Judge the usefulness of the extra pages.                             |
| [Typed paths](../relations/typed-path-queries.md) + [provenance](../relations/provenance-semirings.md)                                  | Check declared types along a route and show which links, metadata, or source records keep the answer supported.                                                   | Hide a piece of evidence and check which answers survive. Two routes can depend on the same source.                               |
| [Strongly connected components](../routes/strongly-connected-components.md) + [transitive reduction](../routes/transitive-reduction.md) | Keep a compact map of authored routes and annotate each group with its types, tags, and folders. A group spread across folders may reveal a cross-topic workflow. | Compare directed boundaries before adding other kinds of edges. Two-way folder navigation can erase the boundaries being studied. |
| [Infomap](../discovery/infomap.md) + typed link patterns                                                                                | Compare groups suggested by simulated reading with folders and tags. Inspect patterns such as workflow → symptom → care concept inside each group.                | If tags helped build the groups, evaluate against independent judgments. Matching those tags alone would only confirm an input.   |
| [Effective resistance](../routes/effective-resistance.md) + [directed cuts](../routes/mengers-theorem.md)                               | Find links with weak detours across the whole graph, then ask how much they matter for a specific start, goal, or type of page.                                   | Keep the undirected score separate from the directed test. A fragile peripheral link may affect few reading tasks.                |
| [Weisfeiler–Lehman refinement](../relations/weisfeiler-lehman.md) + [link prediction](../discovery/two-hop-link-prediction.md)          | Find pages with similar link roles, then use tags or descriptions to judge whether a missing cross-reference would be meaningful.                                 | Compare with text matching alone and check cross-folder suggestions separately from within-folder ones.                           |

Compare each combined view with links alone, metadata alone, and folder or index navigation alone on the same reading tasks. Compare which pages readers find, what explains why they belong, and what changes when a field is unavailable. Preserve the difference between author-written evidence and associations calculated during the analysis.

Recency and source-based experiments need bundles with different dates, explicit verification records, or traceable sources. A timestamp by itself supplies neither a dependency relation nor evidence of causal order.

[Peel, Larremore, and Clauset, The Ground Truth About Metadata and Community Detection in Networks](https://pmc.ncbi.nlm.nih.gov/articles/PMC5415338/).
