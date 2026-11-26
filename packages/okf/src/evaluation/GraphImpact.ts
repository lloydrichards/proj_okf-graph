import type { OkfGraph } from "@repo/domain/Okf";
import { authoredConceptLinks, uniqueEndpoints } from "./EvaluationTopology";

type Removal =
  | { readonly kind: "link"; readonly source: string; readonly target: string }
  | { readonly kind: "concept"; readonly id: string };

type Path = ReadonlyArray<string> | null;

function shortestPath(
  outgoing: ReadonlyMap<string, ReadonlyArray<string>>,
  from: string,
  to: string,
  removal?: Removal,
): Path {
  const previous = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  for (const source of queue) {
    for (const target of outgoing.get(source) ?? []) {
      if (
        previous.has(target) ||
        (removal?.kind === "concept" && target === removal.id) ||
        (removal?.kind === "link" &&
          source === removal.source &&
          target === removal.target)
      )
        continue;

      previous.set(target, source);
      if (target === to) {
        const path = [target];
        let cursor = source;
        while (cursor !== from) {
          path.push(cursor);
          cursor = previous.get(cursor)!;
        }
        path.push(from);
        return path.reverse();
      }
      queue.push(target);
    }
  }
  return null;
}

export function analyzeGraphImpact(
  graph: OkfGraph,
  from: string,
  to: string,
  removal: Removal,
) {
  const known = [
    from,
    to,
    ...(removal.kind === "concept"
      ? [removal.id]
      : [removal.source, removal.target]),
  ];
  const unknown = known.find((id) => !graph.nodeIndex.has(id));
  if (unknown !== undefined) return { error: `Unknown concept ID: ${unknown}` };
  if (from === to)
    return {
      error: `Start and destination are both ${from}. Choose two distinct concepts.`,
    };
  if (
    removal.kind === "concept" &&
    (removal.id === from || removal.id === to)
  ) {
    const role = removal.id === from ? "start" : "destination";
    return {
      error: `Cannot remove ${removal.id} because it is the ${role} of this impact check.`,
    };
  }

  const occurrences = authoredConceptLinks(graph);
  const removedLinkCount =
    removal.kind === "link"
      ? occurrences.filter(
          (edge) =>
            edge.sourceId === removal.source &&
            edge.targetId === removal.target,
        ).length
      : undefined;
  if (removal.kind === "link" && removedLinkCount === 0) {
    return {
      error: `No authored link from ${removal.source} to ${removal.target}.`,
    };
  }

  // Sorted endpoint pairs make breadth-first search choose the first path by ID.
  const outgoing = new Map<string, string[]>();
  for (const { sourceId, targetId } of uniqueEndpoints(occurrences)) {
    const neighbors = outgoing.get(sourceId) ?? [];
    neighbors.push(targetId);
    outgoing.set(sourceId, neighbors);
  }
  return {
    before: { path: shortestPath(outgoing, from, to) },
    after: { path: shortestPath(outgoing, from, to, removal) },
    ...(removedLinkCount === undefined ? {} : { removedLinkCount }),
  };
}
