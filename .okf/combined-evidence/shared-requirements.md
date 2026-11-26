---
type: Experiment
title: "Shared requirements and different needs"
description: "Combines authored care links, concept types, and experience tags to compare plant profiles."
timestamp: 2026-11-26T11:15:17Z
tags: [concept-lattices, frontmatter, typed-links, comparison]
---

# Shared requirements and different needs

The original [Formal Concept Analysis experiment](../relations/formal-concept-analysis.md) groups plant pages by common outgoing care links. A narrower comparison uses declared type `PlantProfile` for the population and authored `requires` links to Drainage Hole and Growing Medium for the shared attributes. Aloe Vera and Orchid match both requirements.

| Profile   | Declared experience tag | Other authored requirements in the comparison |
| --------- | ----------------------- | --------------------------------------------- |
| Aloe Vera | `beginner`              | Direct Sun                                    |
| Orchid    | `advanced`              | Bright Indirect Light and Temperature Range   |

The link evidence brings the profiles together. The tag and the remaining links explain how the profiles differ. The same idea can compare pages across folders, because the group is defined by declared attributes and links. Comparisons across bundles depend on whether their type, tag, and relation vocabularies mean the same thing.

The experiment finds documented requirements, so it cannot rule out a requirement just because the corresponding link is absent.

The source profiles are `plants/aloe-vera.md` and `plants/orchid.md` in the houseplants fixture.
