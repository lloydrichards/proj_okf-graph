import { describe, expect, it } from "@effect/vitest";
import * as Structure from "@repo/graph-goodies/Structure";
import { Effect, Graph } from "effect";

describe("refineColors", () => {
  it.effect("groups equivalent leaves while distinguishing their hub", () =>
    Effect.gen(function* () {
      const graph = Graph.undirected<string, undefined>((graph) => {
        const left = Graph.addNode(graph, "left");
        const hub = Graph.addNode(graph, "hub");
        const right = Graph.addNode(graph, "right");
        Graph.addEdge(graph, left, hub, undefined);
        Graph.addEdge(graph, hub, right, undefined);
      });

      const bounded = yield* Structure.refineColors(graph, { maxRounds: 1 });
      const stable = yield* Structure.refineColors(graph);

      expect(bounded.rounds).toBe(1);
      expect(bounded.converged).toBe(false);
      expect(stable.converged).toBe(true);
      expect(stable.colors).toEqual(bounded.colors);
      expect(stable.colors.get(0)).toBe(stable.colors.get(2));
      expect(stable.colors.get(0)).not.toBe(stable.colors.get(1));
    }),
  );

  it.effect("distinguishes direction and parallel-edge multiplicity", () =>
    Effect.gen(function* () {
      const graph = Graph.directed<string, undefined>((graph) => {
        const source = Graph.addNode(graph, "source");
        const single = Graph.addNode(graph, "single");
        const double = Graph.addNode(graph, "double");
        const sender = Graph.addNode(graph, "sender");
        Graph.addEdge(graph, sender, source, undefined);
        Graph.addEdge(graph, source, single, undefined);
        Graph.addEdge(graph, source, double, undefined);
        Graph.addEdge(graph, source, double, undefined);
      });

      const { colors } = yield* Structure.refineColors(graph);
      expect(new Set(colors.values()).size).toBe(4);
    }),
  );

  it.effect(
    "preserves caller labels for sparse indices before any refinement",
    () =>
      Effect.gen(function* () {
        const graph = Graph.undirected<string, undefined>((graph) => {
          Graph.addNode(graph, "guide");
          const removed = Graph.addNode(graph, "draft");
          Graph.removeNode(graph, removed);
          Graph.addNode(graph, "guide");
          Graph.addNode(graph, "task");
        });

        const result = yield* Structure.refineColors(graph, {
          label: (name) => name,
          maxRounds: 0,
        });

        expect(result).toEqual({
          colors: new Map([
            [0, 0],
            [2, 0],
            [3, 1],
          ]),
          rounds: 0,
          converged: false,
        });
      }),
  );

  it.effect("rejects fractional round limits", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Structure.refineColors(Graph.directed(), { maxRounds: 1.5 }),
      );

      expect(error).toMatchObject({
        _tag: "InvalidColorRefinementLimit",
        maxRounds: 1.5,
      });
    }),
  );
});

it.effect(
  "distinguishes equally connected nodes after neighbor colors propagate",
  () =>
    Effect.gen(function* () {
      const graph = Graph.undirected<number, undefined>((graph) => {
        for (let node = 0; node < 5; node++) Graph.addNode(graph, node);
        for (let node = 0; node < 4; node++)
          Graph.addEdge(graph, node, node + 1, undefined);
      });
      const first = yield* Structure.refineColors(graph, { maxRounds: 1 });
      const second = yield* Structure.refineColors(graph, { maxRounds: 2 });

      expect(first.colors.get(1)).toBe(first.colors.get(2));
      expect(second.colors.get(1)).not.toBe(second.colors.get(2));
      expect(second.colors.get(1)).toBe(second.colors.get(3));
    }),
);
