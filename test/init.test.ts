import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initMemory } from "../src/commands/init.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "init-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("initMemory", () => {
  it("creates memory-contract.json", async () => {
    await initMemory({ root: tmpDir });
    const contractPath = path.join(tmpDir, ".ai", "memory", "memory-contract.json");
    expect(existsSync(contractPath)).toBe(true);
  });

  it("memory-contract.json contains requiredTopLevel with 10 files", async () => {
    await initMemory({ root: tmpDir });
    const contractPath = path.join(tmpDir, ".ai", "memory", "memory-contract.json");
    const content = await readFile(contractPath, "utf-8");
    const contract = JSON.parse(content);
    expect(contract.requiredTopLevel).toHaveLength(10);
    expect(contract.requiredTopLevel).toContain("MEMORY.md");
    expect(contract.requiredTopLevel).toContain("DECISIONS.md");
    expect(contract.requiredTopLevel).toContain("PROJECT.md");
    expect(contract.requiredTopLevel).toContain("MODULES.md");
    expect(contract.requiredTopLevel).toContain("ARCHITECTURE.md");
    expect(contract.requiredTopLevel).toContain("FLOWS.md");
    expect(contract.requiredTopLevel).toContain("TESTING.md");
    expect(contract.requiredTopLevel).toContain("OPS.md");
    expect(contract.requiredTopLevel).toContain("GOTCHAS.md");
    expect(contract.requiredTopLevel).toContain("TASK_ROUTING.md");
  });

  it("memory-contract.json contains dispositions with 7 values", async () => {
    await initMemory({ root: tmpDir });
    const contractPath = path.join(tmpDir, ".ai", "memory", "memory-contract.json");
    const content = await readFile(contractPath, "utf-8");
    const contract = JSON.parse(content);
    expect(contract.dispositions).toHaveLength(7);
    expect(contract.dispositions).toContain("extracted");
    expect(contract.dispositions).toContain("rejected");
    expect(contract.dispositions).toContain("unknown");
    expect(contract.dispositions).toContain("rationale-only");
    expect(contract.dispositions).toContain("superseded");
    expect(contract.dispositions).toContain("historical-only");
    expect(contract.dispositions).toContain("deferred");
  });

  it("memory-contract.json contains requiredSubdirs", async () => {
    await initMemory({ root: tmpDir });
    const contractPath = path.join(tmpDir, ".ai", "memory", "memory-contract.json");
    const content = await readFile(contractPath, "utf-8");
    const contract = JSON.parse(content);
    expect(contract.requiredSubdirs).toContain("modules");
    expect(contract.requiredSubdirs).toContain("flows");
    expect(contract.requiredSubdirs).toContain("decisions");
    expect(contract.requiredSubdirs).toContain("architecture");
    expect(contract.requiredSubdirs).not.toContain("reference");
  });

  it("memory-contract.json contains specialistPhases", async () => {
    await initMemory({ root: tmpDir });
    const contractPath = path.join(tmpDir, ".ai", "memory", "memory-contract.json");
    const content = await readFile(contractPath, "utf-8");
    const contract = JSON.parse(content);
    expect(contract.specialistPhases).toContain("discovery-semantic");
    expect(contract.specialistPhases).toContain("code-evidence");
    expect(contract.specialistPhases).toContain("rationale-extraction");
    expect(contract.specialistPhases).toContain("quality-review");
  });

  it("memory-contract.json has version 2 and language ru", async () => {
    await initMemory({ root: tmpDir });
    const contractPath = path.join(tmpDir, ".ai", "memory", "memory-contract.json");
    const content = await readFile(contractPath, "utf-8");
    const contract = JSON.parse(content);
    expect(contract.version).toBe(2);
    expect(contract.language).toBe("ru");
  });

  it("dryRun does not create files", async () => {
    await initMemory({ root: tmpDir, dryRun: true });
    const contractPath = path.join(tmpDir, ".ai", "memory", "memory-contract.json");
    expect(existsSync(contractPath)).toBe(false);
  });

  it("force=true overwrites existing memory-contract.json", async () => {
    // First create the contract
    await initMemory({ root: tmpDir });
    const contractPath = path.join(tmpDir, ".ai", "memory", "memory-contract.json");
    const original = await readFile(contractPath, "utf-8");

    // Create a modified contract by writing directly
    await writeFile(contractPath, '"not valid json for overwrite test"', "utf-8");

    // Re-init with force
    await initMemory({ root: tmpDir, force: true });
    const updated = await readFile(contractPath, "utf-8");
    expect(updated).not.toBe('"not valid json for overwrite test"');
    expect(updated).toContain("requiredTopLevel");
  });

  it("generates .ai/memory-tool/bin/memory wrapper script", async () => {
    await initMemory({ root: tmpDir });
    const wrapperPath = path.join(tmpDir, ".ai", "memory-tool", "bin", "memory");
    expect(existsSync(wrapperPath)).toBe(true);
    const content = await readFile(wrapperPath, "utf-8");
    expect(content).toContain("#!/usr/bin/env bash");
    // Wrapper должен вызывать cli.js (dist) или cli.ts (src via tsx) из кита
    expect(content).toMatch(/cli\.(js|ts)"/);
    expect(content).toMatch(/exec (node|npx)/);
  });

  it("wrapper script is executable", async () => {
    await initMemory({ root: tmpDir });
    const wrapperPath = path.join(tmpDir, ".ai", "memory-tool", "bin", "memory");
    const st = await stat(wrapperPath);
    // Owner execute bit must be set (0o755)
    expect(st.mode & 0o100).toBeTruthy();
  });

  it("dryRun does not create wrapper script", async () => {
    await initMemory({ root: tmpDir, dryRun: true });
    const wrapperPath = path.join(tmpDir, ".ai", "memory-tool", "bin", "memory");
    expect(existsSync(wrapperPath)).toBe(false);
  });
});
