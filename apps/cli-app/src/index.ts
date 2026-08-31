import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { hello } from "./commands/hello";
import { DevToolsLive } from "./observability/DevTools";

const root = Command.make("cli-app");

// NOTE: Modules inject additional subcommands through Command.withSubcommands.
const AllCommands = Command.withSubcommands([hello]);

// NOTE: Modules append additional runtime layers through Layer.mergeAll.
const RuntimeLayers = Layer.mergeAll(BunServices.layer, DevToolsLive);

root.pipe(
  AllCommands,
  Command.run({ version: "0.0.0" }),
  Effect.provide(RuntimeLayers),
  BunRuntime.runMain,
);
