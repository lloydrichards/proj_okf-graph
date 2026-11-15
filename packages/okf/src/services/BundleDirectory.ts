import { Data, type FileSystem } from "effect";

export interface BundleDirectory {
  readonly fileSystem: FileSystem.FileSystem;
  readonly bundlePath: string;
  readonly displayRoot: string;
}

export class BundleNotFound extends Data.TaggedError("BundleNotFound")<{
  path: string;
}> {}
