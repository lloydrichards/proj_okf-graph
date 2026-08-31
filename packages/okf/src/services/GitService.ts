import { Context, Data, Effect, Layer, String as Str, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";

export class GitCommandError extends Data.TaggedError("GitCommandError")<{
  readonly command: ReadonlyArray<string>;
  readonly exitCode?: number;
  readonly output: string;
}> {}

export class GitService extends Context.Service<GitService>()(
  "@repo/GitService",
  {
    make: Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner;

      const runRaw = Effect.fn("GitService.run")(function* (
        args: ReadonlyArray<string>,
        options?: { readonly cwd?: string },
      ) {
        const { exitCode, output } = yield* Effect.scoped(
          Effect.gen(function* () {
            const command = ChildProcess.make("git", args, {
              cwd: options?.cwd,
              stderr: "pipe",
              stdout: "pipe",
            });

            const handle = yield* command;
            const output = yield* Stream.decodeText(handle.all).pipe(
              Stream.runCollect,
              Effect.map((chunks) => chunks.join("")),
            );
            const exitCode = yield* handle.exitCode;

            return { exitCode, output };
          }),
        );

        if (exitCode !== 0) {
          return yield* new GitCommandError({
            command: ["git", ...args],
            exitCode,
            output,
          });
        }

        return Str.trim(output);
      });

      const run = (
        args: ReadonlyArray<string>,
        options?: { readonly cwd?: string },
      ) =>
        runRaw(args, options).pipe(
          Effect.provideService(ChildProcessSpawner, spawner),
        );

      const clone = Effect.fn("GitService.clone")(function* (options: {
        readonly repoUrl: string;
        readonly ref: string;
        readonly checkoutPath: string;
      }) {
        yield* run([
          "clone",
          "--depth",
          "1",
          "--branch",
          options.ref,
          options.repoUrl,
          options.checkoutPath,
        ]);
      });

      const revParseHead = Effect.fn("GitService.revParseHead")(function* (
        cwd: string,
      ) {
        return yield* run(["rev-parse", "HEAD"], { cwd });
      });

      const branchExists = Effect.fn("GitService.branchExists")(function* (
        repoUrl: string,
        ref: string,
      ) {
        return yield* run([
          "ls-remote",
          "--exit-code",
          repoUrl,
          `refs/heads/${ref}`,
          `refs/tags/${ref}`,
        ]).pipe(
          Effect.as(true),
          Effect.catchTag("GitCommandError", () => Effect.succeed(false)),
        );
      });

      const refresh = Effect.fn("GitService.refresh")(function* (options: {
        readonly ref: string;
        readonly checkoutPath: string;
      }) {
        yield* run(["fetch", "--depth", "1", "origin", options.ref], {
          cwd: options.checkoutPath,
        });
        yield* run(["checkout", "--detach", "FETCH_HEAD"], {
          cwd: options.checkoutPath,
        });
      });

      return { branchExists, clone, refresh, revParseHead, run } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
