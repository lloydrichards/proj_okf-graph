import { Flag } from "effect/unstable/cli";

export const json = Flag.boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print machine-readable JSON output"),
);

export const interactive = Flag.boolean("interactive").pipe(
  Flag.withDefault(false),
  Flag.withAlias("i"),
  Flag.withDescription("Enable interactive mode"),
);

export const schema = Flag.boolean("schema").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Include the evaluation JSON Schema"),
);

export const output = Flag.string("output").pipe(
  Flag.withAlias("o"),
  Flag.optional,
  Flag.withDescription("Write the evaluation report to a JSON file"),
);
