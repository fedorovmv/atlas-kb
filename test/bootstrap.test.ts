import { describe, it, expect } from "vitest";
import { mkdir, writeFile, rm, mkdtemp, copyFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { bootstrapMemory } from "../src/core/bootstrapMemory.js";
import { validateMemory } from "../src/core/validate.js";
import { loadMemoryCards } from "../src/core/loadMemory.js";

async function copyProjectWithoutMemory(src: string, dest: string) {
  await mkdir(dest, { recursive: true });
  for (const dir of ["internal/registry", "internal/mcp", "docs", "specs/legacy", "examples/demo-agent", "pkg/agentcard"]) {
    await mkdir(path.join(dest, dir), { recursive: true });
  }
  await copyFile(path.join(src, "internal/registry/access_filter.go"), path.join(dest, "internal/registry/access_filter.go"));
  await copyFile(path.join(src, "internal/registry/access_filter_test.go"), path.join(dest, "internal/registry/access_filter_test.go"));
  await copyFile(path.join(src, "internal/mcp/gateway.go"), path.join(dest, "internal/mcp/gateway.go"));
  await copyFile(path.join(src, "docs/agent-registry.md"), path.join(dest, "docs/agent-registry.md"));
  await copyFile(path.join(src, "specs/2027-agent-tool-registry.md"), path.join(dest, "specs/2027-agent-tool-registry.md"));
  await copyFile(path.join(src, "specs/legacy/2025-agent-routing.md"), path.join(dest, "specs/legacy/2025-agent-routing.md"));
  await copyFile(path.join(src, "examples/demo-agent/main.go"), path.join(dest, "examples/demo-agent/main.go"));
  await copyFile(path.join(src, "pkg/agentcard/card.go"), path.join(dest, "pkg/agentcard/card.go"));
}

describe("bootstrap", () => {
  it("generates memory cards from discovered project", async () => {
    const src = path.resolve("examples/synapse-mini");
    const dest = await mkdtemp(path.join(tmpdir(), "bootstrap-test-"));
    await copyProjectWithoutMemory(src, dest);

    const result = await bootstrapMemory({ root: dest });
    expect(result.written.length).toBeGreaterThan(0);
    // module card for registry generated
    const moduleCard = result.written.find((p) => p.startsWith(".ai/memory/modules/"));
    expect(moduleCard).toBeDefined();

    // code_refs should point to real discovered files
    const cards = await loadMemoryCards({ root: dest });
    const registryMod = cards.find((c) => c.meta.entity_type === "module" && c.meta.code_refs.some((r) => r.path.includes("access_filter.go")));
    expect(registryMod).toBeDefined();
    expect(registryMod!.meta.code_refs.some((r) => r.path.includes("access_filter.go"))).toBe(true);
    expect(registryMod!.meta.test_refs.some((r) => r.path.includes("access_filter_test.go"))).toBe(true);

    // demo file should NOT be in any module's code_refs
    const allCodeRefs = cards.filter((c) => c.meta.entity_type === "module").flatMap((c) => c.meta.code_refs.map((r) => r.path));
    expect(allCodeRefs.some((p) => p.includes("demo-agent/main.go"))).toBe(false);

    await rm(dest, { recursive: true, force: true });
  });

  it("creates reconciliation directory", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "bootstrap-recon-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");

    const result = await bootstrapMemory({ root: dest });
    expect(result.written.some((p) => p.includes("reconciliation/conflicts.md"))).toBe(true);
    expect(result.written.some((p) => p.includes("reconciliation/open-questions.md"))).toBe(true);

    await rm(dest, { recursive: true, force: true });
  });

  it("is idempotent without force", async () => {
    const src = path.resolve("examples/synapse-mini");
    const dest = await mkdtemp(path.join(tmpdir(), "bootstrap-idem-"));
    await copyProjectWithoutMemory(src, dest);

    await bootstrapMemory({ root: dest });
    const result2 = await bootstrapMemory({ root: dest });
    expect(result2.skipped.length).toBeGreaterThan(0);
    expect(result2.written.length).toBe(0);

    await rm(dest, { recursive: true, force: true });
  });

  it("generated memory validates", async () => {
    const src = path.resolve("examples/synapse-mini");
    const dest = await mkdtemp(path.join(tmpdir(), "bootstrap-valid-"));
    await copyProjectWithoutMemory(src, dest);

    await bootstrapMemory({ root: dest });
    const result = await validateMemory({ root: dest });
    expect(result.errors.length).toBe(0);

    await rm(dest, { recursive: true, force: true });
  });

  it("creates decision card from doc with rationale topic", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "bootstrap-decision-"));
    await mkdir(path.join(dest, "docs"), { recursive: true });
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");
    await writeFile(path.join(dest, "docs/rationale.md"), "# Decision\n## Rationale\nWe chose this approach because it is simple.\n## Alternatives\n### Option A\nStatus: rejected\nReason: too complex\n", "utf8");

    const result = await bootstrapMemory({ root: dest });
    const decisionCard = result.written.find((p) => p.includes("decisions/"));
    expect(decisionCard).toBeDefined();

    await rm(dest, { recursive: true, force: true });
  });

  // --- Epic A1: index card tests ---

  it("creates 4 index cards (MEMORY.md, MODULES.md, DECISIONS.md, ARCHITECTURE.md)", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "bootstrap-index-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");

    const result = await bootstrapMemory({ root: dest });
    const indexCards = result.written.filter((p) =>
      p.includes("MEMORY.md") || p.includes("MODULES.md") || p.includes("DECISIONS.md") || p.includes("ARCHITECTURE.md")
    );
    expect(indexCards.length).toBe(4);
    expect(result.written.some((p) => p.includes("MEMORY.md"))).toBe(true);
    expect(result.written.some((p) => p.includes("MODULES.md"))).toBe(true);
    expect(result.written.some((p) => p.includes("DECISIONS.md"))).toBe(true);
    expect(result.written.some((p) => p.includes("ARCHITECTURE.md"))).toBe(true);

    // Verify index cards have valid frontmatter
    const cards = await loadMemoryCards({ root: dest });
    const indexCardsById = cards.filter((c) =>
      c.meta.id === "memory-index" || c.meta.id === "modules-index" ||
      c.meta.id === "decisions-index" || c.meta.id === "architecture-index"
    );
    expect(indexCardsById.length).toBe(4);

    await rm(dest, { recursive: true, force: true });
  });

  it("creates flows/, architecture/, reference/ subdirectories with .gitkeep", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "bootstrap-subdirs-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");

    const result = await bootstrapMemory({ root: dest });

    // Check subdirectories were created
    expect(result.subdirsCreated).toBeDefined();
    expect(result.subdirsCreated.length).toBe(3);

    // Verify actual filesystem
    const flowsGitkeep = path.join(dest, ".ai/memory/flows/.gitkeep");
    const archGitkeep = path.join(dest, ".ai/memory/architecture/.gitkeep");
    const refGitkeep = path.join(dest, ".ai/memory/reference/.gitkeep");
    expect(existsSync(flowsGitkeep)).toBe(true);
    expect(existsSync(archGitkeep)).toBe(true);
    expect(existsSync(refGitkeep)).toBe(true);
    expect(existsSync(path.join(dest, ".ai/memory/flows"))).toBe(true);
    expect(existsSync(path.join(dest, ".ai/memory/architecture"))).toBe(true);
    expect(existsSync(path.join(dest, ".ai/memory/reference"))).toBe(true);

    await rm(dest, { recursive: true, force: true });
  });

  it("bootstrap does not overwrite enriched top-level cards", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "bootstrap-skip-enriched-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");

    // First bootstrap creates everything
    const first = await bootstrapMemory({ root: dest });
    expect(first.topLevelCreated.length).toBe(4);

    // Second bootstrap should skip everything (including index cards)
    const second = await bootstrapMemory({ root: dest });
    expect(second.written.length).toBe(0);
    expect(second.skipped.length).toBeGreaterThan(0);

    await rm(dest, { recursive: true, force: true });
  });

  it("BootstrapResult.topLevelCreated contains created files", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "bootstrap-topLevel-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");

    const result = await bootstrapMemory({ root: dest });

    expect(result.topLevelCreated).toBeDefined();
    expect(result.topLevelCreated).toContain("MEMORY.md");
    expect(result.topLevelCreated).toContain("MODULES.md");
    expect(result.topLevelCreated).toContain("DECISIONS.md");
    expect(result.topLevelCreated).toContain("ARCHITECTURE.md");

    await rm(dest, { recursive: true, force: true });
  });

  // --- Epic B1: source coverage tests ---

  it("bootstrap creates source-coverage.json", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "bootstrap-coverage-"));
    await mkdir(path.join(dest, "docs"), { recursive: true });
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");
    await writeFile(path.join(dest, "docs/README.md"), "# Project\nDeploy with docker.\nAPI docs.\n", "utf8");

    const result = await bootstrapMemory({ root: dest });
    expect(result.coverageCreated).toBe("source-coverage.json");

    // Verify file exists on disk
    const coveragePath = path.join(dest, ".ai/memory", "source-coverage.json");
    expect(existsSync(coveragePath)).toBe(true);

    // Verify content is valid JSON with expected structure
    const content = await readFile(coveragePath, "utf8");
    const parsed = JSON.parse(content);
    expect(parsed.entries).toBeDefined();
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(parsed.counts).toBeDefined();

    await rm(dest, { recursive: true, force: true });
  });

  it("bootstrap returns triageUpdated > 0", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "bootstrap-triage-"));
    await mkdir(path.join(dest, "docs"), { recursive: true });
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");
    await writeFile(path.join(dest, "docs/deployment.md"), "## Deploy\nDeploy the API to production.\n", "utf8");

    const result = await bootstrapMemory({ root: dest });
    expect(result.triageUpdated).toBeGreaterThan(0);
    expect(result.triageStillUnknown).toBeDefined();
    expect(typeof result.triageStillUnknown).toBe("number");

    await rm(dest, { recursive: true, force: true });
  });
});
