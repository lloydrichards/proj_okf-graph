import { expect, it } from "@effect/vitest";
import * as RandomWalk from "@repo/graph-goodies/RandomWalk";
import { Effect, Graph } from "effect";

it.effect(
  "records first hits by step and leaves unresolved walks at the horizon",
  () =>
    Effect.gen(function* () {
      const graph = Graph.directed<string, undefined>((graph) => {
        const start = Graph.addNode(graph, "start");
        const goal = Graph.addNode(graph, "goal");
        Graph.addEdge(graph, start, start, undefined);
        Graph.addEdge(graph, start, goal, undefined);
        Graph.addEdge(graph, goal, start, undefined);
      });

      const result = yield* RandomWalk.firstHitWithin(graph, {
        source: 0,
        targets: [1],
        maxSteps: 3,
      });

      expect(result).toEqual({
        hitsByStep: new Map([
          [1, new Map([[1, 0.5]])],
          [2, new Map([[1, 0.25]])],
          [3, new Map([[1, 0.125]])],
        ]),
        deadEndProbability: 0,
        remainingProbability: 0.125,
      });
    }),
);

it.effect(
  "counts parallel edges as separate choices and keeps dead ends separate",
  () =>
    Effect.gen(function* () {
      const graph = Graph.directed<string, undefined>((graph) => {
        const start = Graph.addNode(graph, "start");
        const deadEnd = Graph.addNode(graph, "dead end");
        const first = Graph.addNode(graph, "first target");
        const second = Graph.addNode(graph, "second target");
        Graph.addEdge(graph, start, first, undefined);
        Graph.addEdge(graph, start, first, undefined);
        Graph.addEdge(graph, start, second, undefined);
        Graph.addEdge(graph, start, deadEnd, undefined);
      });

      const result = yield* RandomWalk.firstHitWithin(graph, {
        source: 0,
        targets: [2, 3, 2],
        maxSteps: 1,
      });

      expect(result).toEqual({
        hitsByStep: new Map([
          [
            1,
            new Map([
              [2, 0.5],
              [3, 0.25],
            ]),
          ],
        ]),
        deadEndProbability: 0.25,
        remainingProbability: 0,
      });
    }),
);

it.effect("can hit a target without taking an edge", () =>
  Effect.gen(function* () {
    const graph = Graph.directed<string, undefined>((graph) => {
      Graph.addNode(graph, "start");
    });
    const result = yield* RandomWalk.firstHitWithin(graph, {
      source: 0,
      targets: [0],
      maxSteps: 0,
    });

    expect(result).toEqual({
      hitsByStep: new Map([[0, new Map([[0, 1]])]]),
      deadEndProbability: 0,
      remainingProbability: 0,
    });
  }),
);

it.effect("reports invalid horizons and unknown endpoints", () =>
  Effect.gen(function* () {
    const graph = Graph.directed<string, undefined>((graph) => {
      Graph.addNode(graph, "start");
    });
    for (const maxSteps of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const error = yield* Effect.flip(
        RandomWalk.firstHitWithin(graph, { source: 0, targets: [0], maxSteps }),
      );
      expect(error).toMatchObject({ _tag: "InvalidWalkHorizon", maxSteps });
    }
    for (const { role, source, targets } of [
      { role: "source", source: 7, targets: [0] },
      { role: "target", source: 0, targets: [7] },
    ]) {
      const error = yield* Effect.flip(
        RandomWalk.firstHitWithin(graph, { source, targets, maxSteps: 1 }),
      );
      expect(error).toMatchObject({ _tag: "UnknownWalkNode", role, node: 7 });
    }
  }),
);

it.effect(
  "preserves subnormal probability across parallel edges to the same target",
  () =>
    Effect.gen(function* () {
      const graph = Graph.directed<number, undefined>((graph) => {
        const start = Graph.addNode(graph, 0);
        const via = Graph.addNode(graph, 1);
        const goal = Graph.addNode(graph, 2);
        Graph.addEdge(graph, start, start, undefined);
        Graph.addEdge(graph, start, via, undefined);
        Graph.addEdge(graph, via, goal, undefined);
        Graph.addEdge(graph, via, goal, undefined);
      });

      const result = yield* RandomWalk.firstHitWithin(graph, {
        source: 0,
        targets: [2],
        maxSteps: 1075,
      });

      expect(result.hitsByStep.get(1075)?.get(2)).toBe(Number.MIN_VALUE);
    }),
);
