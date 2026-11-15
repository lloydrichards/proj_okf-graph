import { GitHubTree } from "./GitHubTree";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import {
  parseOkfSourceInput,
  SourceParseError,
  SourceResolver,
} from "./SourceResolver";

const TestLayer = Layer.mergeAll(SourceResolver.layer).pipe(
  Layer.provideMerge(NodeServices.layer),
);

describe("SourceResolver", () => {
  it.effect("delegates a tree URL to the supplied GitHubTree layer", () =>
    Effect.gen(function* () {
      const input =
        "https://github.com/example/notes/tree/feature/plants/guides";
      const fs = yield* FileSystem.FileSystem;
      const snapshot = {
        fileSystem: fs,
        bundlePath: "/bundle",
        displayRoot: "test snapshot",
        commit: "1".repeat(40),
      };
      const resolver = yield* SourceResolver.pipe(
        Effect.provide(TestLayer),
        Effect.provideService(GitHubTree, {
          open: (url) => {
            expect(url.href).toBe(input);
            return Effect.succeed(snapshot);
          },
        }),
      );
      expect(yield* resolver.resolve(input)).toBe(snapshot);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("should parse a GitHub tree URL when it names a bundle path", () =>
    Effect.gen(function* () {
      const input =
        "https://github.com/lloydrichards/edu_effect-okf/tree/main/house-plants-okf";

      const source = yield* parseOkfSourceInput(input);

      expect(source).toEqual({
        _tag: "GitHubTree",
        input,
        url: new URL(input),
      });
    }),
  );

  it.effect(
    "should parse a Git URL fragment when it names a ref and subpath",
    () =>
      Effect.gen(function* () {
        const input =
          "git@github.com:lloydrichards/edu_effect-okf.git#feature/foo:house-plants-okf";

        const source = yield* parseOkfSourceInput(input);

        expect(source).toEqual({
          _tag: "Git",
          input,
          repoUrl: "git@github.com:lloydrichards/edu_effect-okf.git",
          ref: "feature/foo",
          subpath: "house-plants-okf",
        });
      }),
  );

  it.effect(
    "should reject a remote URL when it does not name a bundle path",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          parseOkfSourceInput(
            "https://github.com/lloydrichards/edu_effect-okf",
          ),
        );

        expect(error).toBeInstanceOf(SourceParseError);
      }),
  );

  it.effect(
    "should resolve an existing local directory to an absolute bundle path",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const resolver = yield* SourceResolver;
        const dir = yield* fs.makeTempDirectoryScoped({
          prefix: "okf-source-local-",
        });

        const source = yield* resolver.resolve(dir);

        expect(source).toEqual({
          input: dir,
          bundlePath: dir,
          displayRoot: dir,
          fileSystem: fs,
          source: {
            _tag: "Local",
            input: dir,
            path: dir,
          },
        });
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
        Effect.provideService(GitHubTree, {
          open: () => Effect.die("unexpected remote lookup"),
        }),
      ),
  );
});
