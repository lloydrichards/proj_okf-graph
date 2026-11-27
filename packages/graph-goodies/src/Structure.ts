/**
 * Analyzes graph structure through reachability and repeated neighborhood patterns.
 *
 * @module
 */

import { Effect, Graph, Order, Schema } from "effect";

/** Raised when a cycle prevents computing a DAG transitive reduction. */
export class CyclicGraphError extends Schema.TaggedError<
  CyclicGraphError,
  { readonly brand: unique symbol }
>()("CyclicGraphError", {}) {}

/**
 * Returns the original edge indices needed to preserve reachability in a
 * directed acyclic graph.
 *
 * **Details**
 *
 * All original nodes, including isolated nodes, remain part of the reduction.
 * Keep an edge if its target cannot be reached by starting with a different
 * neighbor. When a connection survives, keep its lowest edge index among
 * parallel edges.
 * The input graph stays intact. Edge payloads do not affect reachability.
 *
 * **Example**
 *
 * ```ts
 * import * as Structure from "@repo/graph-goodies/Structure";
 * import { Effect, Graph } from "effect";
 *
 * const graph = Graph.directed<string, undefined>((graph) => {
 *   const start = Graph.addNode(graph, "Start");
 *   const guide = Graph.addNode(graph, "Guide");
 *   const reference = Graph.addNode(graph, "Reference");
 *   Graph.addEdge(graph, start, guide, undefined);
 *   Graph.addEdge(graph, guide, reference, undefined);
 *   Graph.addEdge(graph, start, reference, undefined);
 * });
 *
 * const retained = await Effect.runPromise(Structure.transitiveReduction(graph));
 * // retained contains the first two edge indices.
 * ```
 */
export const transitiveReduction = Effect.fnUntraced(function* <N, E>(
  graph: Graph.DirectedGraph<N, E>,
): Effect.fn.Return<ReadonlySet<Graph.EdgeIndex>, CyclicGraphError> {
  if (!Graph.isAcyclic(graph)) {
    return yield* new CyclicGraphError();
  }

  const outgoing = new Map<
    Graph.NodeIndex,
    Map<Graph.NodeIndex, Graph.EdgeIndex>
  >();
  for (const [id, { source, target }] of Graph.edges(graph)) {
    const neighbors = outgoing.get(source);
    if (neighbors === undefined) {
      outgoing.set(source, new Map([[target, id]]));
      continue;
    }

    const previous = neighbors.get(target);
    if (previous === undefined || id < previous) neighbors.set(target, id);
  }

  const retained = new Set<Graph.EdgeIndex>();
  for (const neighbors of outgoing.values()) {
    if (neighbors.size === 1) {
      for (const edge of neighbors.values()) retained.add(edge);
      continue;
    }

    const seen = new Set<Graph.NodeIndex>();
    const queue = Array.from(neighbors.keys()).flatMap((node) =>
      Array.from(outgoing.get(node)?.keys() ?? []),
    );

    // Starting two steps away leaves direct neighbors visible only if an
    // alternate route reaches them.
    for (const node of queue) {
      if (seen.has(node)) continue;
      seen.add(node);
      for (const target of outgoing.get(node)?.keys() ?? []) {
        queue.push(target);
      }
    }

    for (const [target, edge] of neighbors) {
      if (!seen.has(target)) retained.add(edge);
    }
    yield* Effect.yieldNow;
  }

  return retained;
});

/** Selects initial node labels and an optional limit on refinement rounds. */
export type ColorRefinementOptions<N> = {
  /** Gets the initial label from the node payload and index. Defaults to one shared label. */
  readonly label?: (node: N, index: Graph.NodeIndex) => string;
  /** Maximum rounds. Zero returns the initial colors. Omit to refine until stable. */
  readonly maxRounds?: number;
};

/** Describes the resulting partition and whether a round left it unchanged. */
export type ColorRefinement = {
  /** Graph-local color IDs by original node index. */
  readonly colors: ReadonlyMap<Graph.NodeIndex, number>;
  /** Number of refinement rounds performed. */
  readonly rounds: number;
  /** Whether the partition stabilized or already consists entirely of singleton classes. */
  readonly converged: boolean;
};

/** Raised when the requested round limit is outside the supported range. */
export class InvalidColorRefinementLimit extends Schema.TaggedError<
  InvalidColorRefinementLimit,
  { readonly brand: unique symbol }
>()("InvalidColorRefinementLimit", { maxRounds: Schema.Number }) {}

const roundLimit = Schema.is(
  Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
);

const assignColors = <A>(
  signatures: ReadonlyArray<readonly [Graph.NodeIndex, A]>,
  order: Order.Order<A>,
): {
  readonly colors: Map<Graph.NodeIndex, number>;
  readonly classes: number;
} => {
  const sorted = signatures.toSorted((left, right) => order(left[1], right[1]));
  const colors = new Map<Graph.NodeIndex, number>();
  let color = -1;
  let previous: readonly [Graph.NodeIndex, A] | undefined;

  for (const entry of sorted) {
    const [node, signature] = entry;
    if (previous === undefined || order(previous[1], signature) !== 0) color++;
    colors.set(node, color);
    previous = entry;
  }

  return { colors, classes: color + 1 };
};

const neighborColors = (
  neighbors: ReadonlyArray<Graph.NodeIndex>,
  colors: ReadonlyMap<Graph.NodeIndex, number>,
): ReadonlyArray<number> =>
  neighbors.map((node) => colors.get(node)!).sort(Order.Number);

const signatureOrder = Order.Tuple([
  Order.Number,
  Order.Array(Order.Number),
  Order.Array(Order.Number),
]);

/**
 * Groups nodes by their labels and repeated patterns in their neighborhoods.
 *
 * **Details**
 *
 * Each Weisfeiler–Lehman refinement round splits a color class according to
 * the multisets of colors on adjacent nodes. Directed graphs compare incoming
 * and outgoing neighborhoods separately. An undirected self-loop contributes
 * once, and parallel edges contribute separately. Edge payloads are ignored.
 *
 * Colors are deterministic for the same graph and initial labels. They
 * identify classes within this result. Equal colors mean the performed
 * rounds could not distinguish two nodes, and do not establish a graph
 * isomorphism or prove the nodes can be exchanged.
 *
 * **Example**
 *
 * ```ts
 * import * as Structure from "@repo/graph-goodies/Structure";
 * import { Effect, Graph } from "effect";
 *
 * const graph = Graph.undirected<string, undefined>((graph) => {
 *   const left = Graph.addNode(graph, "Left");
 *   const hub = Graph.addNode(graph, "Hub");
 *   const right = Graph.addNode(graph, "Right");
 *   Graph.addEdge(graph, left, hub, undefined);
 *   Graph.addEdge(graph, hub, right, undefined);
 * });
 *
 * const { colors } = await Effect.runPromise(Structure.refineColors(graph));
 * // The two leaves share a color. The hub has a different color.
 * ```
 */
export const refineColors = Effect.fnUntraced(function* <
  N,
  E,
  K extends Graph.Kind,
>(
  graph: Graph.Graph<N, E, K>,
  options: ColorRefinementOptions<N> = {},
): Effect.fn.Return<ColorRefinement, InvalidColorRefinementLimit> {
  const { label, maxRounds } = options;
  if (maxRounds !== undefined && !roundLimit(maxRounds)) {
    return yield* new InvalidColorRefinementLimit({ maxRounds });
  }

  const nodes = Array.from(Graph.nodes(graph));
  let partition = assignColors(
    nodes.map(([node, value]) => [node, label?.(value, node) ?? ""]),
    Order.String,
  );

  if (maxRounds === 0 || partition.classes === nodes.length) {
    return {
      colors: partition.colors,
      rounds: 0,
      converged: partition.classes === nodes.length,
    };
  }

  const adjacency = new Map(
    nodes.map(([node]) => [
      node,
      {
        incoming: new Array<Graph.NodeIndex>(),
        outgoing: new Array<Graph.NodeIndex>(),
      },
    ]),
  );
  for (const [, { source, target }] of Graph.edges(graph)) {
    adjacency.get(source)!.outgoing.push(target);
    if (graph.type === "directed") {
      adjacency.get(target)!.incoming.push(source);
    } else if (source !== target) {
      adjacency.get(target)!.outgoing.push(source);
    }
  }

  let rounds = 0;
  while (maxRounds === undefined || rounds < maxRounds) {
    const { colors, classes } = partition;
    partition = assignColors(
      Array.from(adjacency, ([node, neighbors]) => [
        node,
        [
          colors.get(node)!,
          neighborColors(neighbors.incoming, colors),
          neighborColors(neighbors.outgoing, colors),
        ] as const,
      ]),
      signatureOrder,
    );
    rounds++;
    if (partition.classes === classes || partition.classes === nodes.length) {
      return { colors: partition.colors, rounds, converged: true };
    }

    yield* Effect.yieldNow;
  }

  return { colors: partition.colors, rounds, converged: false };
});

/** Original edges crossing a partition and its observed and expected counts. */
export type PartitionScore = {
  readonly crossingEdges: ReadonlyArray<Graph.EdgeIndex>;
  readonly observed: number;
  readonly expected: number;
  /** Alexander's redundancy score. Undefined when all possible pairs cross the partition. */
  readonly score: number | undefined;
};

/** Original crossing edges and the share of incident edge ends leaving each group. */
export type NormalizedCut = {
  readonly crossingEdges: ReadonlyArray<Graph.EdgeIndex>;
  readonly groups: ReadonlyArray<{
    readonly volume: number;
    readonly exits: number;
    readonly fraction: number | undefined;
  }>;
  /** Sum of exit fractions. Undefined if any group has zero volume. */
  readonly score: number | undefined;
};

/** Raised when a partition needs a simple graph or disjoint, exhaustive groups. */
export class InvalidPartition extends Schema.TaggedError<
  InvalidPartition,
  { readonly brand: unique symbol }
>()("InvalidPartition", {
  reason: Schema.Literals([
    "selfLoop",
    "parallelEdge",
    "tooFewGroups",
    "emptyGroup",
    "unknownNode",
    "duplicateNode",
    "missingNode",
  ]),
  index: Schema.optional(Schema.Number),
}) {}

type PartitionEdge = {
  readonly id: Graph.EdgeIndex;
  readonly source: Graph.NodeIndex;
  readonly target: Graph.NodeIndex;
};

type PartitionGraph = {
  readonly nodes: ReadonlyArray<Graph.NodeIndex>;
  readonly edges: ReadonlyArray<PartitionEdge>;
};

const readPartitionGraph = Effect.fnUntraced(function* <N, E>(
  graph: Graph.UndirectedGraph<N, E>,
): Effect.fn.Return<PartitionGraph, InvalidPartition> {
  const nodes = Array.from(Graph.nodes(graph), ([id]) => id).sort(Order.Number);
  const neighbors = new Map<Graph.NodeIndex, Set<Graph.NodeIndex>>();
  const edges: PartitionEdge[] = [];
  for (const [id, edge] of Graph.edges(graph)) {
    const source = Math.min(edge.source, edge.target);
    const target = Math.max(edge.source, edge.target);
    if (source === target)
      return yield* new InvalidPartition({ reason: "selfLoop", index: id });

    const adjacent = neighbors.get(source) ?? new Set<Graph.NodeIndex>();
    if (adjacent.has(target))
      return yield* new InvalidPartition({ reason: "parallelEdge", index: id });
    adjacent.add(target);
    neighbors.set(source, adjacent);
    edges.push({ id, source, target });
  }

  return { nodes, edges };
});

const readGroups = Effect.fnUntraced(function* (
  nodes: ReadonlyArray<Graph.NodeIndex>,
  groups: ReadonlyArray<ReadonlyArray<Graph.NodeIndex>>,
): Effect.fn.Return<ReadonlyMap<Graph.NodeIndex, number>, InvalidPartition> {
  if (groups.length < 2)
    return yield* new InvalidPartition({ reason: "tooFewGroups" });

  const available = new Set(nodes);
  const membership = new Map<Graph.NodeIndex, number>();
  for (const [index, group] of groups.entries()) {
    if (group.length === 0)
      return yield* new InvalidPartition({ reason: "emptyGroup", index });
    for (const node of group) {
      if (!available.has(node))
        return yield* new InvalidPartition({
          reason: "unknownNode",
          index: node,
        });
      if (membership.has(node))
        return yield* new InvalidPartition({
          reason: "duplicateNode",
          index: node,
        });
      membership.set(node, index);
    }
  }

  for (const node of nodes) {
    if (!membership.has(node))
      return yield* new InvalidPartition({
        reason: "missingNode",
        index: node,
      });
  }

  return membership;
});

const pairs = (size: number): number => (size * (size - 1)) / 2;

const redundancy = (
  possible: number,
  possibleCrossing: number,
  edgeCount: number,
  crossing: number,
): number | undefined => {
  const spread = Math.sqrt(possibleCrossing * (possible - possibleCrossing));
  return spread === 0
    ? undefined
    : (possible * crossing - edgeCount * possibleCrossing) / spread;
};

const exitFraction = (exits: number, volume: number): number | undefined =>
  volume === 0 ? undefined : exits / volume;

const measurePartition = (
  graph: PartitionGraph,
  membership: ReadonlyMap<Graph.NodeIndex, number>,
  groupCount: number,
) => {
  const crossingEdges: Graph.EdgeIndex[] = [];
  const groups = Array.from({ length: groupCount }, () => ({
    volume: 0,
    exits: 0,
  }));
  for (const { id, source, target } of graph.edges) {
    const from = membership.get(source)!;
    const to = membership.get(target)!;
    groups[from]!.volume++;
    groups[to]!.volume++;
    if (from === to) continue;

    crossingEdges.push(id);
    groups[from]!.exits++;
    groups[to]!.exits++;
  }

  return { crossingEdges: crossingEdges.sort(Order.Number), groups };
};

/**
 * Scores a given grouping against a baseline with the same number of randomly
 * placed edges.
 *
 * **Details**
 *
 * The graph must be simple and undirected. Groups must be nonempty and
 * contain every node exactly once. Negative scores mean fewer crossing edges
 * than expected. The score is undefined when all possible pairs cross the partition.
 * Edge payloads are ignored and crossing edge indices are sorted.
 */
export const scorePartition = Effect.fnUntraced(function* <N, E>(
  graph: Graph.UndirectedGraph<N, E>,
  groups: ReadonlyArray<ReadonlyArray<Graph.NodeIndex>>,
): Effect.fn.Return<PartitionScore, InvalidPartition> {
  const input = yield* readPartitionGraph(graph);
  const membership = yield* readGroups(input.nodes, groups);
  const { crossingEdges } = measurePartition(input, membership, groups.length);
  const possible = pairs(input.nodes.length);
  const possibleCrossing =
    possible - groups.reduce((sum, group) => sum + pairs(group.length), 0);
  const observed = crossingEdges.length;
  return {
    crossingEdges,
    observed,
    expected: (input.edges.length * possibleCrossing) / possible,
    score: redundancy(possible, possibleCrossing, input.edges.length, observed),
  };
});

/**
 * Scores a given grouping by summing the fractions of each group's edge ends
 * that lead outside it.
 *
 * **Details**
 *
 * Groups have the same rules as {@link scorePartition}. An internal edge
 * contributes two edge ends to its group. A crossing edge contributes one
 * exit and one edge end to each group it touches. A group with no edge ends
 * leaves the overall score undefined. Lower scores mean less flow across
 * the boundary.
 */
export const normalizedCut = Effect.fnUntraced(function* <N, E>(
  graph: Graph.UndirectedGraph<N, E>,
  partition: ReadonlyArray<ReadonlyArray<Graph.NodeIndex>>,
): Effect.fn.Return<NormalizedCut, InvalidPartition> {
  const input = yield* readPartitionGraph(graph);
  const membership = yield* readGroups(input.nodes, partition);
  const { crossingEdges, groups } = measurePartition(
    input,
    membership,
    partition.length,
  );
  const fractions = groups.map((group) => ({
    ...group,
    fraction: exitFraction(group.exits, group.volume),
  }));
  return {
    crossingEdges,
    groups: fractions,
    score: fractions.some(({ fraction }) => fraction === undefined)
      ? undefined
      : fractions.reduce((sum, { fraction }) => sum + fraction!, 0),
  };
});

/** Controls the score, starting points per group, and size and depth of the hierarchy. */
export type DecompositionOptions = {
  /** Defaults to Alexander's score. */
  readonly objective?: "alexander" | "normalizedCut";
  /** Maximum breadth-first starting points per group. Defaults to 32. */
  readonly maxSeeds?: number;
  /** Maximum splits along a branch. Defaults to 3. */
  readonly maxDepth?: number;
  /** Minimum nodes per child. Defaults to 2. */
  readonly minGroupSize?: number;
};

/** Raised when a hierarchy option is invalid. */
export class InvalidDecompositionOptions extends Schema.TaggedError<
  InvalidDecompositionOptions,
  { readonly brand: unique symbol }
>()("InvalidDecompositionOptions", {}) {}

const DecompositionConfig = Schema.Struct({
  objective: Schema.Literals(["alexander", "normalizedCut"]).pipe(
    Schema.withDecodingDefault(Effect.succeed("alexander" as const)),
  ),
  maxSeeds: Schema.Int.check(Schema.isGreaterThan(0)).pipe(
    Schema.withDecodingDefault(Effect.succeed(32)),
  ),
  maxDepth: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)).pipe(
    Schema.withDecodingDefault(Effect.succeed(3)),
  ),
  minGroupSize: Schema.Int.check(Schema.isGreaterThan(0)).pipe(
    Schema.withDecodingDefault(Effect.succeed(2)),
  ),
});

/** A hierarchy node with either a stopping reason or a split and its evidence. */
export type Decomposition =
  | {
      readonly _tag: "Leaf";
      readonly nodes: ReadonlyArray<Graph.NodeIndex>;
      readonly reason: "depthLimit" | "tooSmall" | "noImprovement";
      readonly candidatesEvaluated: number;
    }
  | {
      readonly _tag: "Split";
      readonly score: number;
      readonly crossingEdges: ReadonlyArray<Graph.EdgeIndex>;
      readonly candidatesEvaluated: number;
      readonly children: readonly [Decomposition, Decomposition];
    };

const neighborhoodOrder = (
  seed: Graph.NodeIndex,
  neighbors: ReadonlyMap<Graph.NodeIndex, ReadonlyArray<Graph.NodeIndex>>,
  nodes: ReadonlyArray<Graph.NodeIndex>,
): ReadonlyArray<Graph.NodeIndex> => {
  const order = [seed];
  const seen = new Set(order);
  for (const node of order) {
    for (const next of neighbors.get(node)!) {
      if (seen.has(next)) continue;
      seen.add(next);
      order.push(next);
    }
  }

  return [...order, ...nodes.filter((node) => !seen.has(node))];
};

const findBoundary = Effect.fnUntraced(function* (
  graph: PartitionGraph,
  config: typeof DecompositionConfig.Type,
) {
  const { nodes, edges } = graph;
  const neighbors = new Map(
    nodes.map((node) => [node, new Array<Graph.NodeIndex>()]),
  );
  for (const { source, target } of edges) {
    neighbors.get(source)!.push(target);
    neighbors.get(target)!.push(source);
  }
  for (const adjacent of neighbors.values()) adjacent.sort(Order.Number);

  const size = nodes.length;
  const seedCount = Math.min(config.maxSeeds, size);
  let candidatesEvaluated = 0;
  let best:
    | {
        readonly order: ReadonlyArray<Graph.NodeIndex>;
        readonly size: number;
        readonly score: number;
      }
    | undefined;
  for (let seed = 0; seed < seedCount; seed++) {
    const order = neighborhoodOrder(
      nodes[Math.floor((seed * size) / seedCount)]!,
      neighbors,
      nodes,
    );
    const left = new Set<Graph.NodeIndex>();
    let crossing = 0;
    let volume = 0;
    for (const node of order) {
      const adjacent = neighbors.get(node)!;
      for (const neighbor of adjacent) crossing += left.has(neighbor) ? -1 : 1;
      volume += adjacent.length;
      left.add(node);
      if (
        left.size < config.minGroupSize ||
        size - left.size < config.minGroupSize
      )
        continue;

      candidatesEvaluated++;
      const oppositeVolume = 2 * edges.length - volume;
      const score =
        config.objective === "alexander"
          ? redundancy(
              pairs(size),
              left.size * (size - left.size),
              edges.length,
              crossing,
            )
          : volume === 0 || oppositeVolume === 0
            ? undefined
            : crossing / volume + crossing / oppositeVolume;
      if (score !== undefined && (best === undefined || score < best.score)) {
        best = { order, size: left.size, score };
      }
    }
    yield* Effect.yieldNow;
  }

  return { best, candidatesEvaluated };
});

const decompose = Effect.fnUntraced(function* (
  graph: PartitionGraph,
  config: typeof DecompositionConfig.Type,
  depth: number,
): Effect.fn.Return<Decomposition> {
  if (depth === 0)
    return {
      _tag: "Leaf",
      nodes: graph.nodes,
      reason: "depthLimit",
      candidatesEvaluated: 0,
    };
  if (graph.nodes.length < 2 * config.minGroupSize) {
    return {
      _tag: "Leaf",
      nodes: graph.nodes,
      reason: "tooSmall",
      candidatesEvaluated: 0,
    };
  }

  const { best, candidatesEvaluated } = yield* findBoundary(graph, config);
  const threshold = config.objective === "alexander" ? 0 : 1;
  if (best === undefined || best.score >= threshold) {
    return {
      _tag: "Leaf",
      nodes: graph.nodes,
      reason: "noImprovement",
      candidatesEvaluated,
    };
  }

  const membership = new Set(best.order.slice(0, best.size));
  const left = graph.nodes.filter((node) => membership.has(node));
  const right = graph.nodes.filter((node) => !membership.has(node));
  const leftEdges: PartitionEdge[] = [];
  const rightEdges: PartitionEdge[] = [];
  const crossingEdges: Graph.EdgeIndex[] = [];
  for (const edge of graph.edges) {
    const sourceLeft = membership.has(edge.source);
    if (sourceLeft !== membership.has(edge.target)) crossingEdges.push(edge.id);
    else (sourceLeft ? leftEdges : rightEdges).push(edge);
  }

  const first = yield* decompose(
    { nodes: left, edges: leftEdges },
    config,
    depth - 1,
  );
  const second = yield* decompose(
    { nodes: right, edges: rightEdges },
    config,
    depth - 1,
  );
  return {
    _tag: "Split",
    score: best.score,
    crossingEdges: crossingEdges.sort(Order.Number),
    candidatesEvaluated,
    children: [first, second],
  };
});

/**
 * Suggests a hierarchy of two-way splits in a simple undirected graph.
 *
 * **Details**
 *
 * For each group, take breadth-first orders from up to `maxSeeds` nodes
 * evenly spaced by ascending node index, and score prefixes that meet the
 * size limit. This searches a bounded shortlist, and ties keep the first
 * candidate. Repeat on the links internal to each child. Stop at the depth
 * or size limit, or when no candidate scores below zero for Alexander's
 * score or below one for normalized cut. These thresholds are stopping
 * rules. Original node and crossing edge indices identify the results.
 */
export const decomposeHierarchy = Effect.fnUntraced(function* <N, E>(
  graph: Graph.UndirectedGraph<N, E>,
  options: DecompositionOptions = {},
): Effect.fn.Return<
  Decomposition,
  InvalidPartition | InvalidDecompositionOptions
> {
  const config = yield* Schema.decodeEffect(DecompositionConfig)(options).pipe(
    Effect.mapError(() => new InvalidDecompositionOptions()),
  );
  const input = yield* readPartitionGraph(graph);
  return yield* decompose(input, config, config.maxDepth);
});
