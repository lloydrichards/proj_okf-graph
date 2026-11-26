import { Console, Effect, FileSystem, Option, Path, Schema } from "effect";
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

class SkillWriteRejected extends Schema.TaggedError<SkillWriteRejected>()(
  "SkillWriteRejected",
  {
    path: Schema.String,
    reason: Schema.Literals(["Symlink", "NotDirectory", "NotFile", "Exists"]),
  },
) {
  override get message() {
    switch (this.reason) {
      case "Symlink":
        return `Skill path contains a symlink: ${this.path}`;
      case "NotDirectory":
        return `Not a directory: ${this.path}`;
      case "NotFile":
        return `Not a regular file: ${this.path}`;
      case "Exists":
        return `Skill already exists: ${this.path}. Use --force to replace it.`;
    }
  }
}

const inspectDestination = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: string,
) {
  const entry = yield* fs.lstat(path).pipe(
    Effect.map(Option.some),
    Effect.catchReason("PlatformError", "NotFound", () =>
      Effect.succeed(Option.none()),
    ),
  );
  if (Option.isSome(entry) && entry.value.type === "SymbolicLink") {
    return yield* new SkillWriteRejected({ path, reason: "Symlink" });
  }

  return entry;
});

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
        return yield* new SkillWriteRejected({
          path: repository,
          reason: "NotDirectory",
        });
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

      const blocked = new Set<string>();
      let firstNonDirectory: string | undefined;
      for (const directory of directories) {
        if (blocked.has(path.dirname(directory))) {
          blocked.add(directory);
          continue;
        }

        const entry = yield* inspectDestination(fs, directory);
        if (Option.isSome(entry) && entry.value.type !== "Directory") {
          firstNonDirectory ??= directory;
          blocked.add(directory);
        }
      }

      // Check reachable siblings for symlinks before reporting other conflicts.
      const files = yield* Effect.forEach(
        destinations.filter(({ directory }) => !blocked.has(directory)),
        ({ file }) =>
          inspectDestination(fs, file).pipe(
            Effect.map((entry) => ({ file, entry })),
          ),
      );
      if (firstNonDirectory !== undefined) {
        return yield* new SkillWriteRejected({
          path: firstNonDirectory,
          reason: "NotDirectory",
        });
      }

      for (const { file, entry } of files) {
        if (Option.isNone(entry)) continue;
        if (!force || entry.value.type !== "File") {
          return yield* new SkillWriteRejected({
            path: file,
            reason: force ? "NotFile" : "Exists",
          });
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
    }).pipe(
      Effect.catchTag("SkillWriteRejected", (error) =>
        Effect.gen(function* () {
          yield* Console.error(error.message);
          process.exitCode = 1;
        }),
      ),
    ),
).pipe(
  Command.withDescription(
    "Install all bundled skills or one named skill in a repository",
  ),
);

export const skill = Command.make("skill").pipe(
  Command.withSubcommands([readSkill, writeSkill]),
  Command.withDescription("Read or install bundled OKF skills"),
);
