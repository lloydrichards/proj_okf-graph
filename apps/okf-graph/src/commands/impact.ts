import { analyzeGraphImpact, OkfService } from "@repo/okf";
import { Console, Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { bundlePath, conceptId } from "../args";
import { json } from "../flags";

function skipLogLevel(args: ReadonlyArray<string>, start: number): number {
  let index = start;
  while (index < args.length) {
    const arg = args[index];
    if (arg === "--log-level") index += 2;
    else if (arg?.startsWith("--log-level=")) index++;
    else break;
  }
  return index;
}

// Expand the two-ID shorthand into the single-value flags used by the wizard.
export function impactArgs(args: ReadonlyArray<string>): ReadonlyArray<string> {
  const graphIndex = skipLogLevel(args, 0);
  const impactIndex = skipLogLevel(args, graphIndex + 1);
  if (args[graphIndex] !== "graph" || args[impactIndex] !== "impact")
    return args;
  const normalized = args.slice(0, impactIndex + 1);
  for (let i = impactIndex + 1; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--") {
      normalized.push(...args.slice(i));
      break;
    }
    const source = args[i + 1];
    const target = args[i + 2];
    if (
      arg !== "--without-link" ||
      source === undefined ||
      target === undefined ||
      source.startsWith("--") ||
      target.startsWith("--") ||
      source === "-h" ||
      target === "-h"
    ) {
      normalized.push(arg);
      continue;
    }
    normalized.push(`--without-link=${source}`, `--link-target=${target}`);
    i += 2;
  }
  return normalized;
}

export const impact = Command.make(
  "impact",
  {
    bundlePath,
    from: conceptId,
    to: conceptId,
    link: Flag.String("without-link").pipe(
      Flag.atMost(1),
      Flag.withDescription(
        "Source ID for link removal. Pass TARGET next or use --link-target.",
      ),
    ),
    linkTarget: Flag.String("link-target").pipe(
      Flag.atMost(1),
      Flag.withDescription(
        "Target ID for link removal. Use = for IDs that look like flags.",
      ),
    ),
    concept: Flag.String("without-concept").pipe(
      Flag.atMost(1),
      Flag.withDescription("Simulate removing an intermediate concept"),
    ),
    json,
  },
  ({ bundlePath, from, to, link, linkTarget, concept, json }) =>
    Effect.gen(function* () {
      const fail = (message: string) =>
        Effect.gen(function* () {
          yield* Console.error(message);
          process.exitCode = 1;
        });

      if (link.length + concept.length !== 1) {
        return yield* fail(
          "Specify exactly one of --without-link SOURCE TARGET or --without-concept ID.",
        );
      }
      const [source] = link;
      const [target] = linkTarget;
      if ((source === undefined) !== (target === undefined)) {
        return yield* fail(
          "--without-link requires SOURCE and TARGET. Pass TARGET next or use --link-target.",
        );
      }
      const removal =
        source !== undefined && target !== undefined
          ? ({ kind: "link", source, target } as const)
          : ({ kind: "concept", id: concept[0]! } as const);
      const okf = yield* OkfService;
      const { graph } = yield* okf.make(bundlePath);
      const result = analyzeGraphImpact(graph, from, to, removal);
      if (result.error !== undefined) return yield* fail(result.error);
      if (json) {
        yield* Console.log(JSON.stringify(result, null, 2));
        return;
      }

      const { before, after, removedLinkCount } = result;
      const edit =
        removal.kind === "link"
          ? `Removed ${removedLinkCount} authored link occurrence(s) from ${removal.source} to ${removal.target}.`
          : `Removed concept ${removal.id}.`;
      const outcome =
        before.path === null
          ? "Destination was already unreachable."
          : after.path === null
            ? "Edit blocks the route."
            : "Destination remains reachable.";
      yield* Console.log(
        [
          `Simulated edit: ${edit}`,
          `Before: ${before.path?.join(" → ") ?? "unreachable"}`,
          `After:  ${after.path?.join(" → ") ?? "unreachable"}`,
          outcome,
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Preview how one edit affects an authored concept route",
  ),
);
