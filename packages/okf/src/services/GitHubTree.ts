import {
  Context,
  Data,
  type Effect,
  type PlatformError,
  type Schema,
} from "effect";
import type { HttpClientError } from "effect/http";
import type { BundleDirectory, BundleNotFound } from "./BundleDirectory";

export class GitHubTreeError extends Data.TaggedError("GitHubTreeError")<{
  readonly reason: string;
  readonly cause?: unknown;
}> {
  override get message() {
    return this.reason;
  }
}

export interface GitHubTreeSnapshot extends BundleDirectory {
  readonly commit: string;
}

export interface GitHubTreeShape {
  readonly open: (
    url: URL,
  ) => Effect.Effect<
    GitHubTreeSnapshot,
    | GitHubTreeError
    | BundleNotFound
    | HttpClientError.HttpClientError
    | Schema.SchemaError
    | PlatformError.PlatformError
  >;
}

export class GitHubTree extends Context.Service<GitHubTree, GitHubTreeShape>()(
  "@repo/GitHubTree",
) {}

export const isGitHubTreeUrl = (url: URL) =>
  (url.protocol === "https:" || url.protocol === "http:") &&
  url.hostname === "github.com" &&
  /^\/[^/]+\/[^/]+\/tree\/[^/]+\/[^/]/.test(url.pathname);
