import path from "node:path";
import type { RepoMemoryOptions } from "./types.js";

export function resolveRoot(options: RepoMemoryOptions = {}) {
  return path.resolve(options.root ?? process.cwd());
}

export function resolveMemoryRoot(options: RepoMemoryOptions = {}) {
  const root = resolveRoot(options);
  return path.resolve(root, options.memoryRoot ?? ".ai/memory");
}

export function toPosixPath(value: string) {
  return value.split(path.sep).join("/");
}
