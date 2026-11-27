import { Graph, Order, Result, Schema } from "effect";

/** @internal */
export const PartitionIssue = Schema.Struct({
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
});

type PartitionIssue = typeof PartitionIssue.Type;

/** @internal */
export type PartitionEdge = {
  readonly id: Graph.EdgeIndex;
  readonly source: Graph.NodeIndex;
  readonly target: Graph.NodeIndex;
};

/** @internal */
export type PartitionGraph = {
  readonly nodes: ReadonlyArray<Graph.NodeIndex>;
  readonly edges: ReadonlyArray<PartitionEdge>;
};

/** @internal */
export const readPartitionGraph = <N, E>(
  graph: Graph.UndirectedGraph<N, E>,
): Result.Result<PartitionGraph, PartitionIssue> => {
  const nodes = Array.from(Graph.nodes(graph), ([id]) => id).sort(Order.Number);
  const neighbors = new Map<Graph.NodeIndex, Set<Graph.NodeIndex>>();
  const edges: PartitionEdge[] = [];
  for (const [id, edge] of Graph.edges(graph)) {
    const source = Math.min(edge.source, edge.target);
    const target = Math.max(edge.source, edge.target);
    if (source === target)
      return Result.fail({ reason: "selfLoop", index: id });

    const adjacent = neighbors.get(source) ?? new Set<Graph.NodeIndex>();
    if (adjacent.has(target))
      return Result.fail({ reason: "parallelEdge", index: id });
    adjacent.add(target);
    neighbors.set(source, adjacent);
    edges.push({ id, source, target });
  }

  return Result.succeed({ nodes, edges });
};

/** @internal */
export const readGroups = (
  nodes: ReadonlyArray<Graph.NodeIndex>,
  groups: ReadonlyArray<ReadonlyArray<Graph.NodeIndex>>,
): Result.Result<ReadonlyMap<Graph.NodeIndex, number>, PartitionIssue> => {
  if (groups.length < 2) return Result.fail({ reason: "tooFewGroups" });

  const available = new Set(nodes);
  const membership = new Map<Graph.NodeIndex, number>();
  for (const [index, group] of groups.entries()) {
    if (group.length === 0) return Result.fail({ reason: "emptyGroup", index });
    for (const node of group) {
      if (!available.has(node))
        return Result.fail({
          reason: "unknownNode",
          index: node,
        });
      if (membership.has(node))
        return Result.fail({
          reason: "duplicateNode",
          index: node,
        });
      membership.set(node, index);
    }
  }

  for (const node of nodes) {
    if (!membership.has(node))
      return Result.fail({
        reason: "missingNode",
        index: node,
      });
  }

  return Result.succeed(membership);
};

/** @internal */
export const pairs = (size: number): number => (size * (size - 1)) / 2;

/** @internal */
export const redundancy = (
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

/** @internal */
export const exitFraction = (
  exits: number,
  volume: number,
): number | undefined => (volume === 0 ? undefined : exits / volume);

/** @internal */
export const twoWayNormalizedCut = (
  crossing: number,
  leftVolume: number,
  rightVolume: number,
): number | undefined =>
  leftVolume === 0 || rightVolume === 0
    ? undefined
    : (crossing * (leftVolume + rightVolume)) / (leftVolume * rightVolume);

/** @internal */
export const measurePartition = (
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
