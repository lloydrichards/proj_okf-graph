import { describe, expect, it } from "@effect/vitest";
import * as Paths from "@repo/graph-goodies/Paths";
import { Effect, Graph, Option } from "effect";

const makeFixture = () => {
  const graph = Graph.beginMutation(Graph.directed<string, { kind: string }>());
  const source = Graph.addNode(graph, "source");
  const removed = Graph.addNode(graph, "removed");
  const via = Graph.addNode(graph, "via");
  const target = Graph.addNode(graph, "target");
  Graph.removeNode(graph, removed);
  const alternative = Graph.addNode(graph, "alternative");
  Graph.addEdge(graph, source, target, { kind: "context" });
  const first = Graph.addEdge(graph, source, via, { kind: "context" });
  Graph.addEdge(graph, source, via, { kind: "context" });
  Graph.addEdge(graph, source, alternative, { kind: "context" });
  Graph.addEdge(graph, alternative, target, { kind: "evidence" });
  const loop = Graph.addEdge(graph, via, via, { kind: "context" });
  const second = Graph.addEdge(graph, via, target, { kind: "evidence" });

  return {
    graph: Graph.endMutation(graph),
    source,
    target,
    via,
    first,
    second,
    loop,
  };
};

const label = (edge: { kind: string }) => edge.kind;

describe("findTypedPath", () => {
  it.effect("matches the full sequence and resolves ties by edge index", () =>
    Effect.gen(function* () {
      const { graph, source, target, via, first, second } = makeFixture();
      const result = yield* Paths.findTypedPath(graph, {
        source,
        target,
        labels: ["context", "evidence"],
        label,
      });
      expect(result).toEqual(
        Option.some({ nodes: [source, via, target], edges: [first, second] }),
      );
    }),
  );

  it.effect("can revisit a node and follow a self-loop", () =>
    Effect.gen(function* () {
      const { graph, source, target, via, first, second, loop } = makeFixture();
      const result = yield* Paths.findTypedPath(graph, {
        source,
        target,
        labels: ["context", "context", "evidence"],
        label,
      });
      expect(result).toEqual(
        Option.some({
          nodes: [source, via, via, target],
          edges: [first, loop, second],
        }),
      );
    }),
  );

  it.effect(
    "returns no match when a directed walk cannot follow the labels",
    () =>
      Effect.gen(function* () {
        const { graph, source, target } = makeFixture();
        const result = yield* Paths.findTypedPath(graph, {
          source: target,
          target: source,
          labels: ["evidence", "context"],
          label,
        });
        expect(result).toEqual(Option.none());
      }),
  );

  it.effect("accepts an empty walk from a node to itself", () =>
    Effect.gen(function* () {
      const { graph, source, target } = makeFixture();
      const same = yield* Paths.findTypedPath(graph, {
        source,
        target: source,
        labels: [],
        label,
      });
      const different = yield* Paths.findTypedPath(graph, {
        source,
        target,
        labels: [],
        label,
      });
      expect(same).toEqual(Option.some({ nodes: [source], edges: [] }));
      expect(different).toEqual(Option.none());
    }),
  );

  it.effect("reports the unknown endpoint with its node index", () =>
    Effect.gen(function* () {
      const { graph, source, target } = makeFixture();
      const unknownSource = yield* Effect.flip(
        Paths.findTypedPath(graph, { source: -1, target, labels: [], label }),
      );
      const unknownTarget = yield* Effect.flip(
        Paths.findTypedPath(graph, { source, target: -1, labels: [], label }),
      );
      expect(unknownSource).toMatchObject({
        _tag: "UnknownPathEndpoint",
        endpoint: "source",
        node: -1,
      });
      expect(unknownTarget).toMatchObject({
        _tag: "UnknownPathEndpoint",
        endpoint: "target",
        node: -1,
      });
    }),
  );
});
