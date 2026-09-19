import { Console, Effect, FileSystem, Option, Path } from "effect";
import { Command, Flag } from "effect/unstable/cli";

const skillName = "okf";

const loadSkill = Effect.gen(function* () {
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

const target = Flag.string("path").pipe(
  Flag.optional,
  Flag.withDescription(
    "Repository directory (defaults to the current directory)",
  ),
);

const force = Flag.boolean("force").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Replace an existing skill file"),
);

const readSkill = Command.make("read", {}, () =>
  Effect.gen(function* () {
    const markdown = yield* loadSkill;
    yield* Effect.sync(() => process.stdout.write(markdown));
  }),
).pipe(Command.withDescription("Print the OKF skill as Markdown"));

const writeSkill = Command.make(
  "write",
  { target, force },
  ({ target, force }) =>
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
        skillName,
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

      const markdown = yield* loadSkill;
      yield* fs.makeDirectory(path.dirname(destination), { recursive: true });
      yield* fs.writeFileString(destination, markdown, {
        flag: force ? "w" : "wx",
      });
      yield* Console.log(`Installed OKF skill: ${destination}`);
    }),
).pipe(Command.withDescription("Install the OKF skill in a repository"));

export const skill = Command.make("skill").pipe(
  Command.withSubcommands([readSkill, writeSkill]),
  Command.withDescription("Read or install the OKF repository skill"),
);
