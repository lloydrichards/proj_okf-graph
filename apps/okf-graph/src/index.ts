#!/usr/bin/env bun

import { BunRuntime, BunServices } from "@effect/platform-bun";
import { MarkdownService, OkfService } from "@repo/okf";
import { Cause, Console, Effect, Layer, Option, Runtime } from "effect";
import { Command } from "effect/unstable/cli";
import { Ansi, Box } from "effect-boxes";
import packageJson from "../package.json" with { type: "json" };
import { bundle } from "./commands/bundle";
import { concept } from "./commands/concept";
import { evaluate } from "./commands/eval";
import { graph, GraphConceptNotFound } from "./commands/graph";
import { validate, ValidateCommandFailed } from "./commands/validate";
import { DevToolsLive } from "./observability/DevTools";

const root = Command.make("okf-graph");

const AllCommands = Command.withSubcommands([
  concept,
  bundle,
  graph,
  validate,
  evaluate,
]);

const RuntimeLayers = Layer.mergeAll(
  OkfService.layer,
  MarkdownService.layer,
).pipe(Layer.provideMerge(Layer.mergeAll(BunServices.layer, DevToolsLive)));

root.pipe(
  AllCommands,
  Command.run({ version: packageJson.version }),
  Effect.provide(RuntimeLayers),
  Effect.catchCause((cause) =>
    Effect.gen(function* () {
      const failure = Cause.findErrorOption(cause);
      if (
        Option.isSome(failure) &&
        failure.value instanceof GraphConceptNotFound
      ) {
        process.exitCode = failure.value[Runtime.errorExitCode];
        return;
      }
      if (
        Option.isSome(failure) &&
        failure.value instanceof ValidateCommandFailed
      ) {
        return yield* Effect.failCause(cause);
      }
      if (Cause.hasInterruptsOnly(cause)) {
        const message = Box.vsep(
          [
            Box.text("Interrupted.").pipe(
              Box.annotate(Ansi.combine(Ansi.bold, Ansi.yellow)),
            ),
            Box.text("Goodbye! Come back when you're ready to stack."),
          ],
          1,
          Box.center1,
        ).pipe(
          Box.pad(0, 1),
          Box.border("rounded", { annotation: Ansi.yellow }),
          Box.moveDown(1),
        );
        yield* Console.error(`\n${Box.renderPrettySync(message)}`);
        return yield* Effect.failCause(cause);
      }
      yield* Console.error(
        `\n${Box.renderPrettySync(Box.text(Cause.pretty(cause)))}`,
      );
      return yield* Effect.failCause(cause);
    }),
  ),
  BunRuntime.runMain,
);
