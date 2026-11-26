import * as Centrality from "@repo/graph-goodies/Centrality";
import { Console, Effect, Graph } from "effect";

const mutable = Graph.beginMutation(Graph.directed<string, undefined>());
const start = Graph.addNode(mutable, "Start");
const guide = Graph.addNode(mutable, "Guide");
const reference = Graph.addNode(mutable, "Reference");
Graph.addEdge(mutable, start, guide, undefined);
Graph.addEdge(mutable, guide, reference, undefined);
Graph.addEdge(mutable, reference, guide, undefined);
const graph = Graph.endMutation(mutable);

await Effect.runPromise(
  Effect.gen(function* () {
    const nodes = Array.from(Graph.nodes(graph));
    const global = yield* Centrality.pageRank(graph);
    const seeded = yield* Centrality.pageRank(graph, {
      restart: new Map([[start, 1]]),
    });

    yield* Console.table(
      nodes.map(([id, name]) => ({
        node: name,
        global: global.scores.get(id)?.toFixed(4),
        fromStart: seeded.scores.get(id)?.toFixed(4),
      })),
    );
  }),
);
