# Graph Goodies package design

Graph Goodies extends Effect Graph with analyses that callers can use on any graph. The public modules should name the question they answer. Their inputs and results use Effect Graph node and edge indices so callers can work directly with the original graph.

## Module boundaries

| Subpath          | Question                                              | Candidate operations                                                                                                                                   |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Centrality`     | Which individual nodes stand out?                     | `pageRank` for visit probability. Betweenness is a possible second measure for nodes that lie on many shortest routes.                                 |
| `Connectivity`   | What keeps a route open, and how easily can it break? | `dominators`, minimum edge cuts, and eventually effective resistance. Keep endpoint, direction, and weighting rules explicit for each operation.       |
| `Paths`          | Which route or small network connects selected nodes? | Typed path search with caller-defined edge labels, and an approximate Steiner tree for multiple terminals.                                             |
| `Structure`      | How is the graph organized at a larger scale?         | Transitive reduction for DAGs, Infomap communities, and Weisfeiler–Lehman refinement. Revisit this boundary once two candidates have concrete callers. |
| `LinkPrediction` | Which absent edges are worth reviewing?               | Two-hop candidates with the intermediate nodes that explain each suggestion. Keep candidate edges separate from graph mutations.                       |

Effect Graph already provides breadth-first traversal, shortest-path algorithms, and strongly connected components. Use those directly or as building blocks for analyses that add a new result. A Markov chain explains PageRank and Infomap, but it earns its own module only when callers need something like a reusable transition model. Formal concept analysis works on an object–attribute relation, and maximum coverage works on sets. Both can start with standalone input models if a caller needs them. Provenance semirings are worth revisiting when typed-path callers have concrete evidence-combination rules.

## Where OKF fits

OKF decides how authored links, metadata, folders, and aliases become graph edges or annotations. Graph Goodies can accept a generic graph, restart weights, or an edge-label selector as an operation needs them. OKF owns concept IDs, alias identity, and how to render evidence back to Markdown.

For example, an OKF caller can turn a tag into restart weights and use PageRank to rank related concepts. The ranking module sees node indices and weights. Combining that ranking with path evidence can explain where the suggestions came from, while each operation stays useful on its own.

## Effect patterns

- Use named subpath exports and namespace imports. Keep an implementation private until a production caller needs it.
- Use plain functions for total calculations and `Effect.fnUntraced` with an explicit `Effect.fn.Return<A, E>` for expected failures. Use `Schema.TaggedError` for those failures. A cut of size zero, an unreachable destination, or an iteration limit can be valid output when the operation defines them that way.
- Use readonly result shapes and operation-specific options. Use Schema `.check` for option ranges and relationships the options alone can validate. Put defaults in the same schema. Keep checks that depend on the input graph in the operation. Leave graph construction, tracing, and runtime dependencies with the caller.
- Use collection expressions for projections and keep mutable worklists and numeric buffers local to the algorithms that need them. Specify direction, multiplicity, self-loops, tie order, node identity, and weight semantics wherever they change the result.
- Open every public module with its purpose and give each export a summary. Add **Details** for behavior the type cannot express and **Example** for a real call. Follow TaskPlan’s section style and omit Effect’s release and navigation tags.
- Test through the public subpath with small graphs whose results can be derived by hand. Keep scratchpads focused on one comparison a reader can run.

## First operations

| Operation                         | Caller question                                           | Small example                                                                                            |
| --------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `Centrality.pageRank`             | Where does a walk spend time?                             | A one-way link gives the destination more visits than the start.                                         |
| `Connectivity.dominators`         | Which nodes must a reader pass through?                   | A single junction before a fork dominates both branches.                                                 |
| `Connectivity.minimumEdgeCut`     | How many edges must disappear to block a route?           | Two independent routes need two removals, even when neither intermediate page dominates the destination. |
| `Paths.findTypedPath`             | Can I follow this exact sequence of relationships?        | A diagnosis edge followed by a treatment edge reaches the requested guide.                               |
| `LinkPrediction.twoHopCandidates` | Which missing outgoing links have nearby evidence?        | Two distinct intermediate pages point to the same unlinked page.                                         |
| `Structure.transitiveReduction`   | Which shortcuts can I remove without losing reachability? | In a DAG with A → B → C and A → C, keep the two edges through B.                                         |

Use `LinkPrediction.rankTwoHopCandidates` to compare witness counts with
degree-discounted support. A witness with two distinct outgoing neighbors
contributes half as much as one with a single neighbor. Both APIs return the
witness indices so reviewers can trace the suggestions.

Use `Paths.approximateSteinerTree` to connect selected nodes in an undirected
graph. Each edge has unit cost. The approximation grows a tree by attaching
the closest remaining terminal, returning original node and edge indices.
Three selected nodes can share a junction outside the selection. [Mehlhorn's
comparison of Steiner tree algorithms](https://people.mpi-inf.mpg.de/~mehlhorn/ftp/SteinerTrees.pdf)

## Follow-up candidates

- Explore Weisfeiler–Lehman refinement for finding nodes with similar neighborhoods.
