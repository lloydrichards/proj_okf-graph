import type { ConceptEdge, ConceptNode } from "@repo/domain/Okf";
import { OkfService } from "@repo/okf";
import {
  Array as Arr,
  Console,
  Data,
  Effect,
  Graph,
  Option,
  pipe,
  Runtime,
  Terminal,
} from "effect";

import { Command } from "effect/unstable/cli";
import { Box } from "effect-boxes";
import { bundlePath, conceptId } from "../args";
import {
  NeighborhoodExplorer,
  NeighborhoodExplorerView,
  type NeighborhoodExplorerOptions,
} from "../component/NeighborhoodExplorer";
import { interactive } from "../flags";

class ConceptNotFound extends Data.TaggedError("ConceptNotFound")<{
  readonly conceptId: string;
}> {
  override readonly [Runtime.errorExitCode] = 1;
  override readonly [Runtime.errorReported] = true;
}

export const concept = Command.make(
  "concept",
  { bundlePath, conceptId, interactive },
  ({ bundlePath, conceptId, interactive }) =>
    Effect.gen(function* () {
      const okf = yield* OkfService;
      const terminal = yield* Terminal.Terminal;
      const terminalWidth = yield* terminal.columns;
      const terminalHeight = yield* terminal.rows;
      const width = terminalWidth > 20 ? terminalWidth : 120;

      const { bundle, graph } = yield* okf.make(bundlePath);

      const concept = pipe(
        bundle.concepts,
        Arr.findFirst((c) => c.id === conceptId),
      );
      if (Option.isNone(concept)) {
        yield* Console.log(`Concept not found: ${conceptId}`);
        return yield* new ConceptNotFound({ conceptId });
      }
      let selectedConcept = concept.value;
      const conceptsById = new Map(
        bundle.concepts.map((concept) => [concept.id, concept]),
      );
      const explorerOptions: NeighborhoodExplorerOptions<
        ConceptNode,
        ConceptEdge
      > = {
        graph: graph.graph,
        nodeIndex: graph.nodeIndex.get(selectedConcept.id) ?? 0,
        radius: 2,
        nodeLabel: (node) => node.title ?? node.id,
        nodeView: (node) => {
          const concept = conceptsById.get(node.id);
          return {
            title: node.title ?? node.id,
            reference: node.path,
            type: node.type,
            description: node.description,
            tags: node.tags,
            document: concept?.document ?? { blocks: [] },
          };
        },
      };
      if (interactive) {
        const selectedNodeIndex = yield* NeighborhoodExplorer(explorerOptions);

        selectedConcept = pipe(
          Graph.getNode(graph.graph, selectedNodeIndex),
          Option.flatMap((node) =>
            pipe(
              bundle.concepts,
              Arr.findFirst((concept) => concept.id === node.id),
            ),
          ),
          Option.getOrElse(() => selectedConcept),
        );
      }
      const selectedNodeIndex = graph.nodeIndex.get(selectedConcept.id) ?? 0;
      const card = NeighborhoodExplorerView(
        explorerOptions,
        {
          center: selectedNodeIndex,
          direction: "self",
          path: [],
          cursor: 0,
          history: [selectedNodeIndex],
          historyCursor: 0,
        },
        false,
        width,
        terminalHeight,
        "static",
      );

      yield* Console.log(yield* Box.renderPretty(card));
    }),
).pipe(Command.withDescription("Print a concept from a bundle"));
