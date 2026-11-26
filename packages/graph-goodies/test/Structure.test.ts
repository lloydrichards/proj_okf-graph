import { expect, it } from "@effect/vitest";
import * as Structure from "@repo/graph-goodies/Structure";
import { Effect, Graph } from "effect";

it.effect("retains the lowest parallel edge index and removes shortcuts", () =>
  Effect.gen(function* () {
    const graph = Graph.directed<string, undefined>((graph) => {
      const a = Graph.addNode(graph, "a");
      const b = Graph.addNode(graph, "b");
      const c = Graph.addNode(graph, "c");
      Graph.addNode(graph, "isolated");
      Graph.addEdge(graph, a, b, undefined);
      Graph.addEdge(graph, b, c, undefined);
      Graph.addEdge(graph, a, c, undefined);
      Graph.addEdge(graph, a, b, undefined);
    });

    expect(yield* Structure.transitiveReduction(graph)).toEqual(
      new Set([0, 1]),
    );
  }),
);

it.effect("rejects a directed cycle", () =>
  Effect.gen(function* () {
    const graph = Graph.directed<string, undefined>((graph) => {
      const a = Graph.addNode(graph, "a");
      Graph.addEdge(graph, a, a, undefined);
    });

    expect(
      yield* Effect.flip(Structure.transitiveReduction(graph)),
    ).toMatchObject({
      _tag: "CyclicGraphError",
    });
  }),
);
