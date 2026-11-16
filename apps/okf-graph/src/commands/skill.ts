import { Console, Effect, FileSystem, Option, Path } from "effect";
import { Argument, Command, Flag } from "effect/cli";

const skillNames = ["okf", "okf-validate", "okf-dream"] as const;
const name = Argument.Literals("name", skillNames).pipe(
  Argument.withDefault("okf"),
  Argument.withDescription(
    "Use okf for writing, okf-validate for validation, or okf-dream for consolidation",
  ),
);

const loadSkill = Effect.fn("loadSkill")(function* (
  skillName: (typeof skillNames)[number],
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entryArgument = process.argv[1];
  if (entryArgument === undefined) {
    return yield* Effect.die(new Error("CLI entry path is unavailable"));
  }
  const entry = yield* fs.realPath(path.resolve(entryArgument));
  return yield* fs.readFileString(
    path.join(path.dirname(entry), "skills", skillName, "SKILL.md"),
    "utf-8",
  );
});

const target = Flag.String("path").pipe(
  Flag.optional,
  Flag.withDescription(
    "Repository directory (defaults to the current directory)",
  ),
);

const force = Flag.Boolean("force").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Replace an existing skill file"),
);

const readSkill = Command.make("read", { name }, ({ name }) =>
  Effect.gen(function* () {
    const markdown = yield* loadSkill(name);
    yield* Effect.sync(() => process.stdout.write(markdown));
  }),
).pipe(Command.withDescription("Print a bundled skill as Markdown"));

const writeSkill = Command.make(
  "write",
  { name, target, force },
  ({ name, target, force }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repository = path.resolve(
        Option.getOrElse(target, () => process.cwd()),
      );
      const repositoryInfo = yield* fs.stat(repository);
      if (repositoryInfo.type !== "Directory") {
        yield* Console.error(`Not a directory: ${repository}`);
        process.exitCode = 1;
        return;
      }
      const destination = path.join(
        repository,
        ".agents",
        "skills",
        name,
        "SKILL.md",
      );

      for (const installPath of [
        path.join(repository, ".agents"),
        path.join(repository, ".agents", "skills"),
        path.dirname(destination),
        destination,
      ]) {
        if (
          Option.isSome(yield* fs.readLink(installPath).pipe(Effect.option))
        ) {
          yield* Console.error(`Skill path contains a symlink: ${installPath}`);
          process.exitCode = 1;
          return;
        }
      }

      if (!force && (yield* fs.exists(destination))) {
        yield* Console.error(
          `Skill already exists: ${destination}. Use --force to replace it.`,
        );
        process.exitCode = 1;
        return;
      }

      const markdown = yield* loadSkill(name);
      yield* fs.makeDirectory(path.dirname(destination), { recursive: true });
      yield* fs.writeFileString(destination, markdown, {
        flag: force ? "w" : "wx",
      });
      yield* Console.log(`Installed OKF skill: ${destination}`);
    }),
).pipe(Command.withDescription("Install a bundled skill in a repository"));

export const skill = Command.make("skill").pipe(
  Command.withSubcommands([readSkill, writeSkill]),
  Command.withDescription("Read or install bundled OKF skills"),
);
