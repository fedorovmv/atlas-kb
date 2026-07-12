import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { triageSources } from "../src/core/sourceCoverage.js";
import { initMemory } from "../src/commands/init.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(__dirname, "..");
const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");
const cli = path.join(repoRoot, "src/cli.ts");

function runCli(root: string, args: string[]) {
  return execFileSync(tsxBin, [cli, "--root", root, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

describe("triageSources", () => {
  it("updates unknown dispositions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "triage-test-"));
    try {
      await initMemory({ root });

      // Create a doc file with architecture signals → should get "extracted" disposition
      await mkdir(path.join(root, "docs"), { recursive: true });
      await writeFile(
        path.join(root, "docs", "architecture-overview.md"),
        "# Architecture Overview\n\nThis document describes the system architecture and runtime flow.\n",
        "utf8"
      );

      // Create a code file → should get "rejected" (code files don't match doc signals)
      await mkdir(path.join(root, "src"), { recursive: true });
      await writeFile(
        path.join(root, "src", "index.ts"),
        "export function main() { console.log('hello'); }\n",
        "utf8"
      );

      const result = await triageSources({ root });

      expect(result.updated).toBeGreaterThan(0);
      expect(result.stillUnknown).toBe(0);

      // At least some files should have been triaged
      const unknownEntries = result.coverage.entries.filter(e => e.disposition === "unknown");
      expect(unknownEntries.length).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates source-content-map.jsonl", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "triage-test-"));
    try {
      await initMemory({ root });

      await mkdir(path.join(root, "docs"), { recursive: true });
      await writeFile(
        path.join(root, "docs", "flow.md"),
        "# Flow\n\nThe deployment flow involves three stages.\n",
        "utf8"
      );

      const result = await triageSources({ root });

      expect(result.contentMapPath).toBeDefined();
      expect(result.contentMapPath).toContain("source-content-map.jsonl");
      expect(result.contentMaps.length).toBeGreaterThan(0);

      // Verify the file was written to disk
      const content = await readFile(result.contentMapPath, "utf8");
      const lines = content.trim().split("\n");
      for (const line of lines) {
        JSON.parse(line); // should not throw
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("saves source-coverage.json", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "triage-test-"));
    try {
      await initMemory({ root });

      await mkdir(path.join(root, "docs"), { recursive: true });
      await writeFile(
        path.join(root, "docs", "notes.md"),
        "# Notes\n\nTODO: add rationale for this design decision.\n",
        "utf8"
      );

      const result = await triageSources({ root });

      const coveragePath = path.join(root, ".ai", "memory", "source-coverage.json");
      const coverageContent = await readFile(coveragePath, "utf8");
      const coverage = JSON.parse(coverageContent);

      expect(coverage.entries).toBeDefined();
      expect(coverage.counts).toBeDefined();
      expect(result.coverage.entries.length).toBeGreaterThan(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("throws when >30% of files remain unknown after triage", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "triage-test-"));
    try {
      await mkdir(path.join(root, ".ai", "memory"), { recursive: true });

      // Inject a dispositionFn that always returns "unknown" so >30% check triggers
      const unknownDisposition = () => ({ disposition: "unknown" as const });

      // Create temp project with enough files to exceed 30%
      await mkdir(path.join(root, "src"), { recursive: true });
      await writeFile(path.join(root, "src", "a.ts"), "export const a = 1;\n");
      await writeFile(path.join(root, "src", "b.ts"), "export const b = 2;\n");
      await writeFile(path.join(root, "src", "c.ts"), "export const c = 3;\n");
      await writeFile(path.join(root, "src", "d.ts"), "export const d = 4;\n");

      await expect(
        triageSources({ root, dryRun: true, dispositionFn: unknownDisposition })
      ).rejects.toThrow(/Triage failed.*unknown/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("CLI triage", () => {
  it("--json outputs valid JSON", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "triage-cli-test-"));
    try {
      await initMemory({ root });

      await mkdir(path.join(root, "docs"), { recursive: true });
      await writeFile(
        path.join(root, "docs", "architecture.md"),
        "# Architecture\n\nThe system architecture consists of multiple services.\n",
        "utf8"
      );

      const output = runCli(root, ["triage", "--json"]);
      const parsed = JSON.parse(output);

      expect(parsed.updated).toBeDefined();
      expect(parsed.stillUnknown).toBeDefined();
      expect(parsed.contentMapPath).toBeDefined();
      expect(parsed.coveragePath).toBe(".ai/memory/source-coverage.json");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
