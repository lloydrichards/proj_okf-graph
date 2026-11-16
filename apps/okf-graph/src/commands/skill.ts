import { Console, Effect, FileSystem, Option, Path } from "effect";
import { Argument, Command, Flag } from "effect/cli";

const skillNames = ["okf", "okf-validate", "okf-dream"] as const;
const name = Argument.Literals("name", skillNames).pipe(
  Argument.optional,
  Argument.withDescription("Select one skill (defaults to all three)"),
);

type SkillName = (typeof skillNames)[number];
const selectedSkills = (name: Option.Option<SkillName>): readonly SkillName[] =>
  Option.isSome(name) ? [name.value] : skillNames;

const loadSkill = Effect.fn("loadSkill")(function* (skillName: SkillName) {
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
    const documents = yield* Effect.forEach(selectedSkills(name), loadSkill);
    yield* Effect.sync(() => process.stdout.write(documents.join("\n")));
  }),
).pipe(
  Command.withDescription(
    "Print all bundled skills or one named skill as Markdown",
  ),
);

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
      const skillsDir = path.join(repository, ".agents", "skills");
      const destinations = selectedSkills(name).map((skillName) => ({
        skillName,
        directory: path.join(skillsDir, skillName),
        file: path.join(skillsDir, skillName, "SKILL.md"),
      }));
      const directories = [
        path.dirname(skillsDir),
        skillsDir,
        ...destinations.map(({ directory }) => directory),
      ];

      for (const installPath of [
        ...directories,
        ...destinations.map(({ file }) => file),
      ]) {
        if (
          Option.isSome(yield* fs.readLink(installPath).pipe(Effect.option))
        ) {
          yield* Console.error(`Skill path contains a symlink: ${installPath}`);
          process.exitCode = 1;
          return;
        }
      }
      for (const directory of directories) {
        if (
          (yield* fs.exists(directory)) &&
          (yield* fs.stat(directory)).type !== "Directory"
        ) {
          yield* Console.error(`Not a directory: ${directory}`);
          process.exitCode = 1;
          return;
        }
      }
      for (const { file } of destinations) {
        if (!(yield* fs.exists(file))) continue;
        if (!force || (yield* fs.stat(file)).type !== "File") {
          yield* Console.error(
            force
              ? `Not a regular file: ${file}`
              : `Skill already exists: ${file}. Use --force to replace it.`,
          );
          process.exitCode = 1;
          return;
        }
      }

      const installs = yield* Effect.forEach(
        destinations,
        ({ skillName, directory, file }) =>
          loadSkill(skillName).pipe(
            Effect.map((markdown) => ({ directory, file, markdown })),
          ),
      );
      for (const { directory, file, markdown } of installs) {
        yield* fs.makeDirectory(directory, { recursive: true });
        yield* fs.writeFileString(file, markdown, { flag: force ? "w" : "wx" });
        yield* Console.log(`Installed OKF skill: ${file}`);
      }
    }),
).pipe(
  Command.withDescription(
    "Install all bundled skills or one named skill in a repository",
  ),
);

export const skill = Command.make("skill").pipe(
  Command.withSubcommands([readSkill, writeSkill]),
  Command.withDescription("Read or install bundled OKF skills"),
);
