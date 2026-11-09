import { Flag } from "effect/cli";

export const json = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print machine-readable JSON output"),
);

export const interactive = Flag.Boolean("interactive").pipe(
  Flag.withDefault(false),
  Flag.withAlias("i"),
  Flag.withDescription("Enable interactive mode"),
);

export const schema = Flag.Boolean("schema").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Include the evaluation JSON Schema"),
);

export const output = Flag.String("output").pipe(
  Flag.withAlias("o"),
  Flag.optional,
  Flag.withDescription("Write the evaluation report to a JSON file"),
);
