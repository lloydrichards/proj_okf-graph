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

it.effect("finds a two-edge cut when neither intermediate node dominates", () =>
  Effect.gen(function* () {
    const graph = Graph.directed<string, undefined>((graph) => {
      const start = Graph.addNode(graph, "start");
      const left = Graph.addNode(graph, "left");
      const right = Graph.addNode(graph, "right");
      const end = Graph.addNode(graph, "end");
      Graph.addEdge(graph, start, left, undefined);
      Graph.addEdge(graph, left, end, undefined);
      Graph.addEdge(graph, start, right, undefined);
      Graph.addEdge(graph, right, end, undefined);
    });
    const dominators = yield* Connectivity.dominators(graph, 0);
    const cut = yield* Connectivity.minimumEdgeCut(graph, {
      source: 0,
      target: 3,
    });

    const pipedDominators = yield* graph.pipe(Connectivity.dominators(0));
    const pipedCut = yield* graph.pipe(
      Connectivity.minimumEdgeCut({ source: 0, target: 3 }),
    );
    expect(dominators.get(3)).toEqual(new Set([0, 3]));
    expect(pipedDominators).toEqual(dominators);
    expect([...cut]).toEqual([0, 2]);
    expect([...pipedCut]).toEqual([...cut]);
    expect(Graph.edgeCount(graph)).toBe(4);
  }),
);

it.effect(
  "reroutes existing flow when the first route would hide a second route",
  () =>
    Effect.gen(function* () {
      const graph = Graph.directed<number, undefined>((graph) => {
        for (let i = 0; i < 6; i++) Graph.addNode(graph, i);
        Graph.addEdge(graph, 0, 1, undefined);
        Graph.addEdge(graph, 0, 2, undefined);
        Graph.addEdge(graph, 1, 3, undefined);
        Graph.addEdge(graph, 1, 4, undefined);
        Graph.addEdge(graph, 2, 3, undefined);
        Graph.addEdge(graph, 3, 5, undefined);
        Graph.addEdge(graph, 4, 5, undefined);
      });

      const cut = yield* Connectivity.minimumEdgeCut(graph, {
        source: 0,
        target: 5,
      });
      expect([...cut]).toEqual([0, 1]);
    }),
);

it.effect(
  "counts parallel undirected links once each in either direction",
  () =>
    Effect.gen(function* () {
      const graph = Graph.undirected<string, undefined>((graph) => {
        const start = Graph.addNode(graph, "start");
        const end = Graph.addNode(graph, "end");
        Graph.addEdge(graph, end, start, undefined);
        Graph.addEdge(graph, start, end, undefined);
        Graph.addEdge(graph, start, start, undefined);
      });

      const cut = yield* Connectivity.minimumEdgeCut(graph, {
        source: 0,
        target: 1,
      });
      expect([...cut]).toEqual([0, 1]);
    }),
);

it.effect("excludes edges entering the source side of a directed cut", () =>
  Effect.gen(function* () {
    const graph = Graph.beginMutation(Graph.directed<string, undefined>());
    const source = Graph.addNode(graph, "source");
    const removed = Graph.addNode(graph, "removed");
    const target = Graph.addNode(graph, "target");
    Graph.removeNode(graph, removed);
    Graph.addEdge(graph, target, source, undefined);
    const forward = Graph.addEdge(graph, source, target, undefined);

    const cut = yield* Connectivity.minimumEdgeCut(Graph.endMutation(graph), {
      source,
      target,
    });

    expect([...cut]).toEqual([forward]);
  }),
);

it.effect("returns an empty cut when the target is already unreachable", () =>
  Effect.gen(function* () {
    const graph = Graph.directed<string, undefined>((graph) => {
      const start = Graph.addNode(graph, "start");
      const end = Graph.addNode(graph, "end");
      Graph.addEdge(graph, end, start, undefined);
    });

    const cut = yield* Connectivity.minimumEdgeCut(graph, {
      source: 0,
      target: 1,
    });
    expect(cut.size).toBe(0);
  }),
);

it.effect("rejects unknown or identical endpoints", () =>
  Effect.gen(function* () {
    const graph = Graph.directed<string, undefined>((graph) => {
      Graph.addNode(graph, "start");
    });

    for (const input of [
      { source: 1, target: 0, reason: "unknownSource" },
      { source: 0, target: 1, reason: "unknownTarget" },
      { source: 0, target: 0, reason: "sameNode" },
    ]) {
      const { reason, ...endpoints } = input;
      const error = yield* Effect.flip(
        Connectivity.minimumEdgeCut(graph, endpoints),
      );
      expect(error).toMatchObject({
        _tag: "InvalidEdgeCutEndpoints",
        ...endpoints,
        reason,
      });
    }
  }),
);
