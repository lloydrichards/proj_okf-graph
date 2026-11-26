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
        const reversedLabels = yield* Paths.findTypedPath(graph, {
          source,
          target,
          labels: ["evidence", "context"],
          label,
        });
        expect(reversedLabels).toEqual(Option.none());
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

describe("approximateSteinerTree", () => {
  it.effect(
    "connects three terminals through a shared junction and keeps original indices",
    () =>
      Effect.gen(function* () {
        const mutable = Graph.beginMutation(
          Graph.undirected<string, undefined>(),
        );
        const removed = Graph.addNode(mutable, "removed");
        const first = Graph.addNode(mutable, "first");
        const junction = Graph.addNode(mutable, "junction");
        const second = Graph.addNode(mutable, "second");
        const third = Graph.addNode(mutable, "third");
        const spur = Graph.addNode(mutable, "spur");
        Graph.removeNode(mutable, removed);
        Graph.addEdge(mutable, junction, spur, undefined);
        const firstSpoke = Graph.addEdge(mutable, junction, first, undefined);
        const secondSpoke = Graph.addEdge(mutable, second, junction, undefined);
        Graph.addEdge(mutable, junction, second, undefined);
        const thirdSpoke = Graph.addEdge(mutable, junction, third, undefined);

        const result = yield* Paths.approximateSteinerTree(
          Graph.endMutation(mutable),
          [third, second, first, third],
        );

        expect(result).toEqual(
          Option.some({
            nodes: [first, junction, second, third],
            edges: [firstSpoke, secondSpoke, thirdSpoke],
          }),
        );
      }),
  );

  it.effect("returns no tree when known terminals are disconnected", () =>
    Effect.gen(function* () {
      const graph = Graph.undirected<string, undefined>((graph) => {
        Graph.addNode(graph, "first");
        Graph.addNode(graph, "second");
      });

      expect(yield* Paths.approximateSteinerTree(graph, [0, 1])).toEqual(
        Option.none(),
      );
    }),
  );

  it.effect(
    "handles empty and singleton selections and identifies unknown terminals",
    () =>
      Effect.gen(function* () {
        const graph = Graph.undirected<string, undefined>((graph) => {
          Graph.addNode(graph, "only");
        });

        expect(yield* Paths.approximateSteinerTree(graph, [])).toEqual(
          Option.some({
            nodes: [],
            edges: [],
          }),
        );
        expect(yield* Paths.approximateSteinerTree(graph, [0, 0])).toEqual(
          Option.some({
            nodes: [0],
            edges: [],
          }),
        );
        expect(
          yield* Effect.flip(Paths.approximateSteinerTree(graph, [0, 7])),
        ).toMatchObject({
          _tag: "UnknownSteinerTerminal",
          terminal: 7,
        });
      }),
  );
});
