import { expect, it } from "@effect/vitest";
import * as Connectivity from "@repo/graph-goodies/Connectivity";
import { Effect, Graph } from "effect";

it.effect("returns mandatory nodes through a fork and a cycle", () =>
  Effect.gen(function* () {
    const graph = Graph.beginMutation(Graph.directed<string, undefined>());
    const start = Graph.addNode(graph, "start");
    const bridge = Graph.addNode(graph, "bridge");
    const left = Graph.addNode(graph, "left");
    const right = Graph.addNode(graph, "right");
    const end = Graph.addNode(graph, "end");
    const unreachable = Graph.addNode(graph, "unreachable");

    Graph.addEdge(graph, start, bridge, undefined);
    Graph.addEdge(graph, bridge, left, undefined);
    Graph.addEdge(graph, bridge, right, undefined);
    Graph.addEdge(graph, left, end, undefined);
    Graph.addEdge(graph, right, end, undefined);
    Graph.addEdge(graph, end, left, undefined);
    Graph.addEdge(graph, bridge, bridge, undefined);
    Graph.addEdge(graph, unreachable, end, undefined);

    const result = yield* Connectivity.dominators(
      Graph.endMutation(graph),
      start,
    );

    expect(result).toEqual(
      new Map([
        [start, new Set([start])],
        [bridge, new Set([start, bridge])],
        [left, new Set([start, bridge, left])],
        [right, new Set([start, bridge, right])],
        [end, new Set([start, bridge, end])],
      ]),
    );
  }),
);

it.effect("drops an apparent dominator when a longer route bypasses it", () =>
  Effect.gen(function* () {
    const graph = Graph.beginMutation(Graph.directed<string, undefined>());
    const start = Graph.addNode(graph, "start");
    const short = Graph.addNode(graph, "short");
    const long = Graph.addNode(graph, "long");
    const end = Graph.addNode(graph, "end");
    const bend = Graph.addNode(graph, "bend");

    Graph.addEdge(graph, start, short, undefined);
    Graph.addEdge(graph, start, long, undefined);
    Graph.addEdge(graph, short, end, undefined);
    Graph.addEdge(graph, long, bend, undefined);
    Graph.addEdge(graph, bend, end, undefined);

    const result = yield* Connectivity.dominators(
      Graph.endMutation(graph),
      start,
    );

    expect(result.get(end)).toEqual(new Set([start, end]));
  }),
);

it.effect("rejects a missing start node", () =>
  Effect.gen(function* () {
    const error = yield* Effect.flip(
      Connectivity.dominators(Graph.directed(), 42),
    );

    expect(error).toMatchObject({ _tag: "UnknownStartNode", start: 42 });
  }),
);
