import { describe, expect, it } from "@effect/vitest";
import * as LinkPrediction from "@repo/graph-goodies/LinkPrediction";
import { Effect, Graph } from "effect";

describe("twoHopCandidates", () => {
  it.effect(
    "ranks missing targets by unique support and breaks ties by node index",
    () =>
      Effect.gen(function* () {
        const graph = Graph.directed<string, string>((graph) => {
          const source = Graph.addNode(graph, "Source");
          const first = Graph.addNode(graph, "First intermediate");
          const second = Graph.addNode(graph, "Second intermediate");
          const tieFirst = Graph.addNode(graph, "First one-witness target");
          const tieSecond = Graph.addNode(graph, "Second one-witness target");
          const strongest = Graph.addNode(graph, "Two-witness target");
          Graph.addEdge(graph, source, second, "first link");
          Graph.addEdge(graph, source, second, "parallel link");
          Graph.addEdge(graph, source, first, "link");
          Graph.addEdge(graph, second, tieSecond, "link");
          Graph.addEdge(graph, second, strongest, "link");
          Graph.addEdge(graph, second, strongest, "parallel link");
          Graph.addEdge(graph, first, tieFirst, "link");
          Graph.addEdge(graph, first, strongest, "link");
        });

        expect(yield* LinkPrediction.twoHopCandidates(graph, 0)).toEqual([
          { target: 5, intermediates: [1, 2] },
          { target: 3, intermediates: [1] },
          { target: 4, intermediates: [2] },
        ]);
      }),
  );

  it.effect(
    "ignores self-links, existing links, and incoming-only first hops",
    () =>
      Effect.gen(function* () {
        const graph = Graph.directed<number, undefined>((graph) => {
          const source = Graph.addNode(graph, 0);
          const intermediate = Graph.addNode(graph, 1);
          const direct = Graph.addNode(graph, 2);
          const incoming = Graph.addNode(graph, 3);
          const incomingOnlyTarget = Graph.addNode(graph, 4);
          Graph.addEdge(graph, source, intermediate, undefined);
          Graph.addEdge(graph, source, direct, undefined);
          Graph.addEdge(graph, intermediate, source, undefined);
          Graph.addEdge(graph, intermediate, direct, undefined);
          Graph.addEdge(graph, incoming, source, undefined);
          Graph.addEdge(graph, incoming, incomingOnlyTarget, undefined);
        });

        expect(yield* LinkPrediction.twoHopCandidates(graph, 0)).toEqual([]);
      }),
  );

  it.effect("reports the index of an unknown source", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        LinkPrediction.twoHopCandidates(Graph.directed(), 7),
      );
      expect(error._tag).toBe("UnknownLinkPredictionSource");
      expect(error.source).toBe(7);
    }),
  );
});

it.effect(
  "ranks a focused witness above a broad witness and keeps both explanations",
  () =>
    Effect.gen(function* () {
      const graph = Graph.directed<string, undefined>((graph) => {
        const source = Graph.addNode(graph, "Source");
        const broad = Graph.addNode(graph, "Broad witness");
        const focused = Graph.addNode(graph, "Focused witness");
        const broadTarget = Graph.addNode(graph, "Broad target");
        const focusedTarget = Graph.addNode(graph, "Focused target");
        Graph.addEdge(graph, source, broad, undefined);
        Graph.addEdge(graph, source, focused, undefined);
        Graph.addEdge(graph, broad, broadTarget, undefined);
        Graph.addEdge(graph, broad, source, undefined);
        Graph.addEdge(graph, focused, focusedTarget, undefined);
        Graph.addEdge(graph, focused, focusedTarget, undefined);
      });
      const counted = yield* LinkPrediction.twoHopCandidates(graph, 0);
      const ranked = yield* LinkPrediction.rankTwoHopCandidates(graph, 0);

      expect(counted).toEqual([
        { target: 3, intermediates: [1] },
        { target: 4, intermediates: [2] },
      ]);
      expect(ranked).toEqual([
        { target: 4, intermediates: [2], score: 1 },
        { target: 3, intermediates: [1], score: 0.5 },
      ]);
    }),
);
