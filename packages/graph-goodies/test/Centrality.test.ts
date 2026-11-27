import { Effect, Graph, Option } from "effect";
import { describe, expect, it } from "@effect/vitest";
import * as Centrality from "@repo/graph-goodies/Centrality";

const directed = Graph.directed<string, undefined>((graph) => {
  const a = Graph.addNode(graph, "a");
  const b = Graph.addNode(graph, "b");
  Graph.addEdge(graph, a, b, undefined);
});

describe("pageRank", () => {
  it("ranks a directed edge and redistributes dead-end mass", () => {
    const result = Effect.runSync(
      directed.pipe(Centrality.pageRank({ alpha: 0.5 })),
    );
    expect(result.converged).toBe(true);
    expect(result.scores.get(0)).toBeCloseTo(0.4, 5);
    expect(result.scores.get(1)).toBeCloseTo(0.6, 5);
    expect(result.residual).toBeLessThanOrEqual(1e-6);
  });

  it.effect("lets a competing fiber run during power iteration", () =>
    Effect.gen(function* () {
      const winner = yield* Effect.raceFirst(
        Centrality.pageRank(directed, { tolerance: 1e-12 }).pipe(
          Effect.as("ranking"),
        ),
        Effect.yieldNow.pipe(Effect.as("competing fiber")),
      );

      expect(winner).toBe("competing fiber");
    }),
  );

  it.live("honors a live timeout during a long ranking", () =>
    Effect.gen(function* () {
      const cycle = Graph.directed<number, undefined>((graph) => {
        const nodes = Array.from({ length: 25_000 }, (_, id) =>
          Graph.addNode(graph, id),
        );
        for (const [slot, from] of nodes.entries()) {
          Graph.addEdge(
            graph,
            from,
            nodes[(slot + 1) % nodes.length]!,
            undefined,
          );
        }
      });

      const result = yield* Centrality.pageRank(cycle, {
        alpha: 0.99,
        maxIterations: 1_000,
        restart: new Map([[0, 1]]),
      }).pipe(Effect.timeoutOption("10 millis"));

      expect(Option.isNone(result)).toBe(true);
    }),
  );

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

  it("uses the same defaults with or without a pipeline", () => {
    const defaults = Effect.runSync(Centrality.pageRank(directed));
    expect(Effect.runSync(Centrality.pageRank(directed, undefined))).toEqual(
      defaults,
    );
    expect(Effect.runSync(directed.pipe(Centrality.pageRank()))).toEqual(
      defaults,
    );
    expect(
      Effect.runSync(directed.pipe(Centrality.pageRank(undefined))),
    ).toEqual(defaults);
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
