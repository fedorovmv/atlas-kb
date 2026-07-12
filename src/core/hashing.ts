import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ContextPack } from "./types.js";

export function shaBytes(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function fileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return shaBytes(content);
}

export async function treeHash(paths: string[]): Promise<string> {
  const sorted = [...paths].sort();
  const hashes: string[] = [];
  for (const p of sorted) {
    try {
      const h = await fileHash(p);
      hashes.push(`${p}:${h}`);
    } catch {
      hashes.push(`${p}:MISSING`);
    }
  }
  return shaBytes(Buffer.from(hashes.join("\n"), "utf8"));
}

const execFileAsync = promisify(execFile);

export async function checkContextFreshness(
  pack: ContextPack,
  root: string,
): Promise<{ fresh: boolean; staleFiles: string[]; reason?: string }> {
  const staleFiles: string[] = [];

  // Check git HEAD if available
  if (pack.repositoryHead) {
    try {
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root });
      const currentHead = stdout.trim();
      if (currentHead !== pack.repositoryHead) {
        return {
          fresh: false,
          staleFiles: [],
          reason: `git HEAD changed: ${pack.repositoryHead.slice(0, 8)} → ${currentHead.slice(0, 8)}`,
        };
      }
    } catch {
      // Not a git repo — skip HEAD check
    }
  }

  // Check source hashes if available
  if (pack.sourceHashes) {
    for (const [filePath, expectedHash] of Object.entries(pack.sourceHashes)) {
      const fullPath = path.resolve(root, filePath);
      try {
        const actualHash = await fileHash(fullPath);
        if (actualHash !== expectedHash) {
          staleFiles.push(filePath);
        }
      } catch {
        staleFiles.push(`${filePath} (missing)`);
      }
    }
  }

  return {
    fresh: staleFiles.length === 0,
    staleFiles,
    reason: staleFiles.length > 0 ? `${staleFiles.length} files changed` : undefined,
  };
}
