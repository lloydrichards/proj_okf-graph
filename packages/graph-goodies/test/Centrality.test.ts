import { Effect, Graph } from "effect";
import { describe, expect, it } from "vitest";
import * as Centrality from "@repo/graph-goodies/Centrality";

const directed = Graph.directed<string, undefined>((graph) => {
  const a = Graph.addNode(graph, "a");
  const b = Graph.addNode(graph, "b");
  Graph.addEdge(graph, a, b, undefined);
});

describe("pageRank", () => {
  it("ranks a directed edge and redistributes dead-end mass", () => {
    const result = Effect.runSync(
      Centrality.pageRank(directed, { alpha: 0.5 }),
    );
    expect(result.converged).toBe(true);
    expect(result.scores.get(0)).toBeCloseTo(0.4, 5);
    expect(result.scores.get(1)).toBeCloseTo(0.6, 5);
    expect(result.residual).toBeLessThanOrEqual(1e-6);
  });

  it("uses the restart distribution at dead ends and normalizes large weights", () => {
    const seeded = Effect.runSync(
      Centrality.pageRank(directed, {
        alpha: 0.5,
        restart: new Map([[0, 1]]),
      }),
    );
    expect(seeded.scores.get(0)).toBeCloseTo(2 / 3, 5);
    expect(seeded.scores.get(1)).toBeCloseTo(1 / 3, 5);
    const weighted = Effect.runSync(
      Centrality.pageRank(directed, {
        alpha: 0,
        restart: new Map([
          [0, Number.MAX_VALUE],
          [1, Number.MAX_VALUE / 2],
        ]),
      }),
    );
    expect(weighted.scores.get(0)).toBeCloseTo(2 / 3);
    expect(weighted.scores.get(1)).toBeCloseTo(1 / 3);
  });

  it("counts parallel edges and self-loops and returns the last iterate at the limit", () => {
    const graph = Graph.directed<string, number>((mutable) => {
      const a = Graph.addNode(mutable, "a");
      const b = Graph.addNode(mutable, "b");
      Graph.addEdge(mutable, a, a, 100);
      Graph.addEdge(mutable, a, b, 1);
      Graph.addEdge(mutable, a, b, 1);
    });
    const result = Effect.runSync(
      Centrality.pageRank(graph, {
        alpha: 0.5,
        maxIterations: 1,
        restart: new Map([[0, 1]]),
      }),
    );
    expect(result).toMatchObject({ converged: false, iterations: 1 });
    expect(result.scores.get(0)).toBeCloseTo(2 / 3);
    expect(result.scores.get(1)).toBeCloseTo(1 / 3);
    expect(result.residual).toBeCloseTo(2 / 3);
  });

  it("follows undirected edges both ways and preserves sparse node indices", () => {
    const graph = Graph.undirected<string, undefined>((mutable) => {
      const a = Graph.addNode(mutable, "a");
      const removed = Graph.addNode(mutable, "removed");
      const b = Graph.addNode(mutable, "b");
      Graph.removeNode(mutable, removed);
      Graph.addEdge(mutable, a, b, undefined);
    });
    const result = Effect.runSync(
      Centrality.pageRank(graph, {
        alpha: 0.5,
        restart: new Map([[2, 1]]),
      }),
    );
    expect([...result.scores.keys()]).toEqual([0, 2]);
    expect(result.scores.get(0)).toBeCloseTo(1 / 3, 5);
    expect(result.scores.get(2)).toBeCloseTo(2 / 3, 5);
  });

  it("counts an undirected self-loop once", () => {
    const graph = Graph.undirected<string, undefined>((mutable) => {
      const a = Graph.addNode(mutable, "a");
      const b = Graph.addNode(mutable, "b");
      Graph.addEdge(mutable, a, a, undefined);
      Graph.addEdge(mutable, a, b, undefined);
    });
    const result = Effect.runSync(
      Centrality.pageRank(graph, {
        alpha: 0.5,
        maxIterations: 1,
        restart: new Map([[0, 1]]),
      }),
    );
    expect(result.scores.get(0)).toBe(0.75);
    expect(result.scores.get(1)).toBe(0.25);
  });

  it("returns an empty ranking for an empty graph", () => {
    expect(Effect.runSync(Centrality.pageRank(Graph.directed()))).toEqual({
      scores: new Map(),
      iterations: 0,
      residual: 0,
      converged: true,
    });
  });

  it.each([
    ["alpha", { alpha: 1 }],
    ["tolerance", { tolerance: Number.NaN }],
    ["maxIterations", { maxIterations: 1.5 }],
    ["maxIterations", { maxIterations: Number.MAX_SAFE_INTEGER + 1 }],
    ["restart", { restart: new Map([[7, 1]]) }],
    ["restart", { restart: new Map([[0, -1]]) }],
    ["restart", { restart: new Map([[0, Number.POSITIVE_INFINITY]]) }],
    ["restart", { restart: new Map() }],
    ["restart", { restart: new Map([[0, 0]]) }],
  ] satisfies ReadonlyArray<readonly [string, Centrality.PageRankOptions]>)(
    "rejects an invalid %s option",
    (option, options) => {
      expect(
        Effect.runSync(Effect.flip(Centrality.pageRank(directed, options))),
      ).toMatchObject({ _tag: "InvalidPageRankOptions", option });
    },
  );
});
