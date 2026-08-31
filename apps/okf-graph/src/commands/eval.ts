import { EvaluationReport } from "@repo/domain/Evaluation";
import { EvaluationService } from "@repo/okf";
import {
  Console,
  Effect,
  FileSystem,
  Option,
  Path,
  Schema,
  Terminal,
} from "effect";
import { Command } from "effect/unstable/cli";
import { Box } from "effect-boxes";
import { bundlePath } from "../args";
import { EvaluationReportBox } from "../component/ui/EvaluationReport";
import { json, output, schema } from "../flags";

export const evaluate = Command.make(
  "eval",
  { bundlePath, json, output, schema },
  ({ bundlePath, json, output, schema }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const terminal = yield* Terminal.Terminal;
      const evaluation = yield* EvaluationService;
      const report = yield* evaluation.evaluate(bundlePath);

      // NOTE: JSON Schema generation, serialization, output-file handling, and
      // stdout are CLI projections. Keep the existing report and { report, schema }
      // payloads until the separate evaluation-profile work begins.
      const payload = schema
        ? {
            report,
            schema: Schema.toJsonSchemaDocument(EvaluationReport),
          }
        : report;
      const jsonOutput = JSON.stringify(payload, null, 2);

      yield* Option.match(output, {
        onNone: () => Effect.void,
        onSome: (outputPath) =>
          Effect.gen(function* () {
            yield* fs.makeDirectory(path.dirname(outputPath), {
              recursive: true,
            });
            yield* fs.writeFileString(outputPath, jsonOutput);
          }),
      });

      if (json || schema) {
        yield* Console.log(jsonOutput);
      } else {
        const terminalWidth = yield* terminal.columns;
        const width = terminalWidth > 20 ? terminalWidth : 120;
        yield* Console.log(
          yield* Box.renderPretty(
            EvaluationReportBox(report, bundlePath, width),
          ),
        );
      }
    }).pipe(Effect.provide(EvaluationService.Live)),
).pipe(
  Command.withDescription("Explore an OKF bundle's structural properties"),
);
