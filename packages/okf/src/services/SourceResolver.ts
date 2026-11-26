import { createHash } from "node:crypto";
import { OkfSourceInput, ResolvedOkfSource } from "@repo/domain/Okf";
import {
  Array as Arr,
  Config,
  Context,
  Data,
  Effect,
  FileSystem,
  Layer,
  Match,
  Option,
  Path,
  pipe,
  Schema,
  String as Str,
} from "effect";
import { GitHubTree, isGitHubTreeUrl } from "./GitHubTree";
import { GitService } from "./GitService";

export class SourceParseError extends Data.TaggedError("SourceParseError")<{
  readonly input: string;
  readonly reason: string;
}> {}

export class SourceResolveError extends Data.TaggedError("SourceResolveError")<{
  readonly input: string;
  readonly reason: string;
}> {}

const gitFragmentPattern = /^(.+?)(?:#([^:]+):(.+))$/;

export const parseOkfSourceInput = Effect.fn("parseOkfSourceInput")(function* (
  input: string,
) {
  const trimmed = Str.trim(input);

  if (Str.isEmpty(trimmed)) {
    return yield* new SourceParseError({
      input,
      reason: "Input cannot be empty",
    });
  }

  const url = URL.parse(trimmed);
  if (url && isGitHubTreeUrl(url))
    return OkfSourceInput.cases.GitHubTree.make({ input: trimmed, url });

  const gitUrl = yield* parseGitUrlFragment(trimmed);
  if (Option.isSome(gitUrl)) {
    return gitUrl.value;
  }

  if (looksLikeRemoteUrl(trimmed)) {
    return yield* new SourceParseError({
      input,
      reason:
        "Remote Git inputs must use a GitHub /tree/<ref>/<path> URL or a git URL fragment like <repo>#<ref>:<path>",
    });
  }

  return OkfSourceInput.cases.Local.make({
    input: trimmed,
    path: trimmed,
  });
});

const parseGitUrlFragment = Effect.fn("parseGitUrlFragment")((input: string) =>
  Effect.succeed(
    pipe(
      Option.fromNullishOr(gitFragmentPattern.exec(input)),
      Option.flatMap((match) =>
        Option.all({
          repoUrl: Arr.get(match, 1),
          ref: Arr.get(match, 2),
          subpath: Arr.get(match, 3),
        }),
      ),
      Option.filter(
        ({ repoUrl, ref, subpath }) =>
          looksLikeGitRepo(repoUrl) &&
          Str.isNonEmpty(ref) &&
          Str.isNonEmpty(subpath),
      ),
      Option.map(({ repoUrl, ref, subpath }) =>
        OkfSourceInput.cases.Git.make({
          input,
          repoUrl,
          ref,
          subpath,
        }),
      ),
    ),
  ),
);

const looksLikeRemoteUrl = (input: string) =>
  /^https?:\/\//.test(input) || input.startsWith("git@");

const looksLikeGitRepo = (input: string) =>
  /^https?:\/\//.test(input) ||
  input.startsWith("git@") ||
  input.endsWith(".git");

export class SourceResolverConfig extends Context.Service<SourceResolverConfig>()(
  "@repo/SourceResolverConfig",
  {
    make: Effect.gen(function* () {
      const path = yield* Path.Path;
      const configuredBaseDir = yield* Config.String(
        "OKF_SOURCE_BASE_DIR",
      ).pipe(Config.option);
      const baseDir = pipe(
        configuredBaseDir,
        Option.getOrElse(() => path.resolve(globalThis.process.cwd())),
      );
      const configuredCacheRoot = yield* Config.String(
        "OKF_SOURCE_CACHE_DIR",
      ).pipe(Config.option);
      const cacheRoot = pipe(
        configuredCacheRoot,
        Option.getOrElse(() => path.join(baseDir, ".cache/okf-sources")),
      );

      return { baseDir, cacheRoot } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}

const cacheKey = (source: Extract<OkfSourceInput, { readonly _tag: "Git" }>) =>
  createHash("sha256")
    .update(`${source.repoUrl}#${source.ref}:${source.subpath}`)
    .digest("base64url");

export class SourceResolver extends Context.Service<SourceResolver>()(
  "@repo/SourceResolver",
  {
    make: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const git = yield* GitService;
      const github = yield* GitHubTree;
      const config = yield* SourceResolverConfig;

      const ensureDirectory = Effect.fn("ensureDirectory")(function* (
        input: string,
        dir: string,
      ) {
        const exists = yield* fs.exists(dir);
        if (!exists) {
          return yield* new SourceResolveError({
            input,
            reason: `Resolved bundle path does not exist: ${dir}`,
          });
        }

        const stat = yield* fs.stat(dir);
        if (stat.type !== "Directory") {
          return yield* new SourceResolveError({
            input,
            reason: `Resolved bundle path is not a directory: ${dir}`,
          });
        }
      });

      const resolveGit = Effect.fn("resolveGit")(function* (
        source: Extract<OkfSourceInput, { readonly _tag: "Git" }>,
      ) {
        const checkoutPath = path.resolve(
          config.cacheRoot,
          cacheKey(source),
          "repo",
        );
        const checkoutExists = yield* fs.exists(checkoutPath);

        if (!checkoutExists) {
          yield* fs.makeDirectory(path.dirname(checkoutPath), {
            recursive: true,
          });
          yield* git.clone({ ...source, checkoutPath });
        } else {
          yield* git.refresh({ ref: source.ref, checkoutPath });
        }

        const commit = yield* git
          .revParseHead(checkoutPath)
          .pipe(Effect.option);
        const bundlePath = path.join(checkoutPath, source.subpath);
        const resolvedBundlePath = path.resolve(bundlePath);
        const relativeBundlePath = path.relative(
          checkoutPath,
          resolvedBundlePath,
        );
        if (
          relativeBundlePath.startsWith("..") ||
          path.isAbsolute(relativeBundlePath)
        ) {
          return yield* new SourceResolveError({
            input: source.input,
            reason: "Remote bundle path must remain within its checkout",
          });
        }
        yield* ensureDirectory(source.input, resolvedBundlePath);
        const realCheckoutPath = yield* fs.realPath(checkoutPath);
        const realBundlePath = yield* fs.realPath(resolvedBundlePath);
        const realRelativeBundlePath = path.relative(
          realCheckoutPath,
          realBundlePath,
        );
        if (
          realRelativeBundlePath.startsWith("..") ||
          path.isAbsolute(realRelativeBundlePath)
        ) {
          return yield* new SourceResolveError({
            input: source.input,
            reason: "Remote bundle path must remain within its checkout",
          });
        }

        const resolved = yield* Schema.decodeEffect(ResolvedOkfSource)({
          input: source.input,
          bundlePath: realBundlePath,
          source,
          checkoutPath,
          ...(Option.isSome(commit) ? { commit: commit.value } : {}),
        });
        return { ...resolved, fileSystem: fs, displayRoot: realBundlePath };
      });

      const resolveLocalPath = (localPath: string) => {
        if (path.isAbsolute(localPath)) {
          return path.resolve(localPath);
        }

        return path.resolve(config.baseDir, localPath);
      };

      const resolveParsed = Effect.fn("resolveParsed")(function* (
        source: OkfSourceInput,
      ) {
        return yield* pipe(
          Match.value(source),
          Match.tag("Local", (source) =>
            Effect.gen(function* () {
              const localPath = source.path;
              const bundlePath = resolveLocalPath(localPath);
              yield* ensureDirectory(localPath, bundlePath);
              const resolved = yield* Schema.decodeEffect(ResolvedOkfSource)({
                input: localPath,
                bundlePath,
                source: { ...source, path: bundlePath },
              });
              return { ...resolved, fileSystem: fs, displayRoot: bundlePath };
            }),
          ),
          Match.tag("Git", resolveGit),
          Match.tag("GitHubTree", (source) => github.open(source.url)),
          Match.exhaustive,
        );
      });

      return {
        parse: parseOkfSourceInput,
        resolve: Effect.fn("SourceResolver.resolve")(function* (input: string) {
          const parsed = yield* parseOkfSourceInput(input);
          return yield* resolveParsed(parsed);
        }),
        resolveParsed,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide([GitService.layer, SourceResolverConfig.layer]),
  );
}
