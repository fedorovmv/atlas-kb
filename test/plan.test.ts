import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { generatePlan } from "../src/core/plan.js";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { initMemory } from "../src/commands/init.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");
const cli = path.join(repoRoot, "src/cli.ts");

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "plan-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("generatePlan", () => {
  it("creates card-plan.md", async () => {
    await mkdir(path.join(tmpDir, "internal", "foo"), { recursive: true });
    await writeFile(path.join(tmpDir, "internal", "foo", "bar.ts"), "export const x = 1;\n");

    const result = await generatePlan({ root: tmpDir });
    expect(existsSync(result.planPath)).toBe(true);
    const content = await readFile(result.planPath, "utf-8");
    expect(content).toContain("# Card Plan");
  });

  it("plan contains 10 required top-level cards", async () => {
    await mkdir(path.join(tmpDir, "src"), { recursive: true });
    await writeFile(path.join(tmpDir, "src", "index.ts"), "export {};\n");

    const result = await generatePlan({ root: tmpDir });
    expect(result.requiredCards).toHaveLength(10);
    expect(result.requiredCards).toContain("MEMORY.md");
    expect(result.requiredCards).toContain("DECISIONS.md");
    // Also verify some other known required cards
    expect(result.requiredCards).toContain("PROJECT.md");
    expect(result.requiredCards).toContain("MODULES.md");
    expect(result.requiredCards).toContain("ARCHITECTURE.md");
    expect(result.requiredCards).toContain("FLOWS.md");
    expect(result.requiredCards).toContain("TESTING.md");
    expect(result.requiredCards).toContain("OPS.md");
    expect(result.requiredCards).toContain("GOTCHAS.md");
    expect(result.requiredCards).toContain("TASK_ROUTING.md");
  });

  it("plan contains candidate module cards", async () => {
    await mkdir(path.join(tmpDir, "internal", "registry"), { recursive: true });
    await writeFile(path.join(tmpDir, "internal", "registry", "filter.ts"), "export const filter = () => {};\n");
    await mkdir(path.join(tmpDir, "tests", "registry"), { recursive: true });
    await writeFile(path.join(tmpDir, "tests", "registry", "filter.test.ts"), "test('x', () => {});\n");

    const result = await generatePlan({ root: tmpDir });
    expect(result.candidateModuleCards.length).toBeGreaterThan(0);
    // Each candidate module card should have an id and runtimeTier
    for (const card of result.candidateModuleCards) {
      expect(card.id).toBeDefined();
      expect(card.runtimeTier).toBeDefined();
    }
  });

  it("plan file contains candidate module entries in markdown", async () => {
    await mkdir(path.join(tmpDir, "internal", "registry"), { recursive: true });
    await writeFile(path.join(tmpDir, "internal", "registry", "filter.ts"), "export const filter = () => {};\n");

    const result = await generatePlan({ root: tmpDir });
    const content = await readFile(result.planPath, "utf-8");
    expect(content).toContain("## Candidate module cards");
    expect(content).toContain("internal-registry");
  });

  it("scaffoldModules creates stub files", async () => {
    await mkdir(path.join(tmpDir, "internal", "registry"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "internal", "registry", "access_filter.go"),
      "package registry\n\nfunc FilterCardsForCaller(caller string) []string { return []string{caller} }\n",
    );

    const result = await generatePlan({ root: tmpDir, scaffoldModules: true });
    expect(result.candidateModuleCards.length).toBeGreaterThan(0);

    // Check that stub files were created in the modules directory
    const modulesDir = path.join(tmpDir, ".ai", "memory", "modules");
    expect(existsSync(modulesDir)).toBe(true);

    // Verify at least one stub has valid frontmatter
    const stubFile = path.join(modulesDir, `${result.candidateModuleCards[0].id}.md`);
    expect(existsSync(stubFile)).toBe(true);
    const stubContent = await readFile(stubFile, "utf-8");
    expect(stubContent).toContain("entity_type: module");
    expect(stubContent).toContain("id: ");
    expect(stubContent).toContain("## Responsibilities");
  });

  it("buildDir option places plan in custom directory", async () => {
    const customBuildDir = path.join(tmpDir, "custom-build");
    await mkdir(path.join(tmpDir, "internal", "foo"), { recursive: true });
    await writeFile(path.join(tmpDir, "internal", "foo", "bar.ts"), "export const x = 1;\n");

    const result = await generatePlan({ root: tmpDir, buildDir: customBuildDir });
    expect(result.planPath).toContain("custom-build");
    expect(existsSync(result.planPath)).toBe(true);
  });
});

describe("CLI plan", () => {
  it("--json outputs valid JSON", async () => {
    // Create a minimal project with code files that will be discovered as modules
    await mkdir(path.join(tmpDir, "internal", "registry"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "internal", "registry", "access_filter.go"),
      "package registry\n\nfunc FilterCardsForCaller(caller string) []string { return []string{caller} }\n",
    );

    const output = execFileSync(tsxBin, [cli, "--root", tmpDir, "plan", "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    const parsed = JSON.parse(output);
    expect(parsed.planPath).toBeDefined();
    expect(parsed.requiredCards).toHaveLength(10);
    expect(parsed.candidateModuleCards).toBeDefined();
    expect(Array.isArray(parsed.candidateModuleCards)).toBe(true);
  });

  it("--scaffold-modules creates stub files via CLI", async () => {
    await mkdir(path.join(tmpDir, "internal", "mcp"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "internal", "mcp", "gateway.go"),
      "package mcp\n\nfunc StartGateway() {}\n",
    );

    execFileSync(tsxBin, [cli, "--root", tmpDir, "plan", "--scaffold-modules"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const modulesDir = path.join(tmpDir, ".ai", "memory", "modules");
    expect(existsSync(modulesDir)).toBe(true);
  });
});
