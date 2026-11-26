---
type: Concept
title: "Provenance semirings"
description: "Records which links are needed together and which alternative routes support a result."
timestamp: 2026-11-26T09:53:06Z
tags: [provenance, relations, evidence]
---

# Provenance semirings

A typed path query follows a recipe. First follow a link with one label, then follow a link with another. Save every route that matches. Those routes are the answer’s provenance. Within a route you need both links. Across routes you need at least one complete route to keep the answer.

## Houseplants example

Drainage Hole stays in the answer through Orchid. Direct Sun drops out because only Aloe Vera provided that route. An agent can return those links with its answer. The paths establish what the pages document. Using the same technique to infer facts would require defined relation meanings and rules. Here only 22 of 241 links have a relation title.

In a provenance expression, multiply the two link tokens needed for a single path and add expressions for alternate paths. Removing a link sets its token to zero. See the [typed path query](./typed-path-queries.md) for all result counts.

[Mendelzon and Wood on regular paths](https://www.vldb.org/conf/1989/P185.PDF) · [Green, Karvounarakis, and Tannen on provenance](https://doi.org/10.1145/1265530.1265535).
