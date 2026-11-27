import { expect, it } from "@effect/vitest";
import * as Structure from "@repo/graph-goodies/Structure";
import { Effect, Graph } from "effect";

const fixture = (
  size: number,
  edges: ReadonlyArray<readonly [number, number]>,
) =>
  Graph.undirected<number, undefined>((graph) => {
    for (let node = 0; node < size; node++) Graph.addNode(graph, node);
    for (const [source, target] of edges)
      Graph.addEdge(graph, source, target, undefined);
  });

it.effect(
  "scores a multiway grouping and returns original crossing edge IDs",
  () =>
    Effect.gen(function* () {
      const graph = fixture(5, [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ]);
      const groups = [[0, 1], [2, 3], [4]];
      const result = yield* Structure.scorePartition(graph, groups);
      expect(result).toEqual({
        observed: 2,
        expected: 3.2,
        crossingEdges: [1, 3],
        score: -3,
      });
      const cut = yield* Structure.normalizedCut(graph, groups);
      expect(cut).toEqual({
        crossingEdges: [1, 3],
        groups: [
          { exits: 1, volume: 3, fraction: 1 / 3 },
          { exits: 2, volume: 4, fraction: 1 / 2 },
          { exits: 1, volume: 1, fraction: 1 },
        ],
        score: 1 / 3 + 1 / 2 + 1,
      });
    }),
);

it.effect(
  "distinguishes undefined scores from zero and rejects invalid partitions",
  () =>
    Effect.gen(function* () {
      const graph = fixture(3, [[0, 1]]);
      const disconnected = yield* Structure.normalizedCut(graph, [[0, 1], [2]]);
      expect(disconnected.groups[0]?.fraction).toBe(0);
      expect(disconnected.score).toBeUndefined();
      expect(
        (yield* Structure.scorePartition(fixture(2, [[0, 1]]), [[0], [1]]))
          .score,
      ).toBeUndefined();
      expect(
        yield* Effect.flip(
          Structure.scorePartition(graph, [
            [0, 1],
            [1, 2],
          ]),
        ),
      ).toMatchObject({
        _tag: "InvalidPartition",
        reason: "duplicateNode",
        index: 1,
      });
      expect(
        yield* Effect.flip(
          Structure.normalizedCut(
            fixture(2, [
              [0, 1],
              [1, 0],
            ]),
            [[0], [1]],
          ),
        ),
      ).toMatchObject({
        _tag: "InvalidPartition",
        reason: "parallelEdge",
        index: 1,
      });
    }),
);

it.effect(
  "matches exhaustive two-way search for both objectives on a small graph",
  () =>
    Effect.gen(function* () {
      const graph = fixture(6, [
        [0, 1],
        [0, 2],
        [0, 4],
        [1, 2],
        [1, 4],
        [1, 5],
        [2, 3],
        [2, 4],
        [2, 5],
      ]);
      const nodes = [0, 1, 2, 3, 4, 5];
      let alexander = Infinity;
      let normalizedCut = Infinity;
      for (let mask = 0; mask < 1 << (nodes.length - 1); mask++) {
        const left = nodes.filter(
          (node) => node === 0 || (mask & (1 << (node - 1))) !== 0,
        );
        const right = nodes.filter((node) => !left.includes(node));
        if (left.length < 2 || right.length < 2) continue;
        const scores = yield* Effect.all([
          Structure.scorePartition(graph, [left, right]),
          Structure.normalizedCut(graph, [left, right]),
        ]);
        alexander = Math.min(alexander, scores[0].score ?? Infinity);
        normalizedCut = Math.min(normalizedCut, scores[1].score ?? Infinity);
      }

      const first = yield* Structure.decomposeHierarchy(graph, {
        objective: "alexander",
        maxDepth: 1,
      });
      const second = yield* Structure.decomposeHierarchy(graph, {
        objective: "normalizedCut",
        maxDepth: 1,
      });
      expect(first).toMatchObject({
        _tag: "Split",
        score: alexander,
        crossingEdges: [5, 6, 8],
      });
      expect(second).toMatchObject({
        _tag: "Split",
        score: normalizedCut,
        crossingEdges: [1, 3, 5, 7],
      });
    }),
);

it.effect(
  "repeats within each child and respects limits on seed count and depth",
  () =>
    Effect.gen(function* () {
      const graph = fixture(12, [
        [0, 1],
        [0, 2],
        [1, 2],
        [3, 4],
        [3, 5],
        [4, 5],
        [6, 7],
        [6, 8],
        [7, 8],
        [9, 10],
        [9, 11],
        [10, 11],
        [2, 4],
        [8, 9],
        [3, 10],
      ]);
      const tree = yield* Structure.decomposeHierarchy(graph);
      expect(tree).toMatchObject({
        _tag: "Split",
        crossingEdges: [14],
        children: [
          {
            _tag: "Split",
            crossingEdges: [12],
            children: [
              { _tag: "Leaf", nodes: [0, 1, 2], reason: "tooSmall" },
              { _tag: "Leaf", nodes: [3, 4, 5], reason: "tooSmall" },
            ],
          },
          { _tag: "Split", crossingEdges: [13] },
        ],
      });
      const limited = yield* Structure.decomposeHierarchy(graph, {
        maxSeeds: 1,
        maxDepth: 1,
      });
      expect(limited).toMatchObject({
        _tag: "Split",
        candidatesEvaluated: 9,
        children: [
          { _tag: "Leaf", reason: "depthLimit" },
          { _tag: "Leaf", reason: "depthLimit" },
        ],
      });
      expect(
        yield* Effect.flip(
          Structure.decomposeHierarchy(graph, { maxSeeds: 0 }),
        ),
      ).toMatchObject({ _tag: "InvalidDecompositionOptions" });
    }),
);
