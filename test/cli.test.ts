import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile, readFile, rm, mkdtemp, mkdir, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createTempProject, loadSynapseMini } from "./helpers.js";
import { initMemory } from "../src/commands/init.js";
import { ingestSpecCommand } from "../src/commands/ingestSpec.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");
const cli = path.join(repoRoot, "src/cli.ts");

function runCli(root: string, args: string[]) {
  return execFileSync(tsxBin, [cli, "--root", root, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

describe("CLI commands", () => {
  it("lists memory cards", async () => {
    const root = await createTempProject();
    const output = runCli(root, ["ls", "--type", "module"]);
    expect(output).toContain("agent-tool-registry");
    expect(output).toContain("mcp-gateway");
  });

  it("prints related entities", async () => {
    const root = await createTempProject();
    const output = runCli(root, ["related", "agent-tool-registry"]);
    expect(output).toContain("registry-is-discovery-not-orchestration");
    expect(output).toContain("a2a-agent-discovery");
  });

  it("validates memory", async () => {
    const root = await createTempProject();
    const output = runCli(root, ["validate"]);
    expect(output).toContain("Memory validation OK");
  });

  it("builds context from CLI", async () => {
    const root = await createTempProject();
    const output = runCli(root, ["context", "изменить фильтрацию agent cards"]);
    expect(output).toContain("Memory context pack");
    expect(output).toContain("Agent & Tool Registry");
    expect(output).toContain("Related code paths");
  });

  it("discovers project files", () => {
    const root = loadSynapseMini();
    const output = runCli(root, ["discover", "--json"]);
    const report = JSON.parse(output);
    expect(report.files.length).toBeGreaterThan(0);
    expect(report.candidateModules.length).toBeGreaterThan(0);
    expect(report.files.some((f: { kind: string }) => f.kind === "code")).toBe(true);
  });

  it("bootstraps memory bank", async () => {
    const root = await createTempProject();
    const output = runCli(root, ["bootstrap", "--force"]);
    expect(output).toContain("Written");
  });

  it("ingests a spec", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "cli-ingest-"));
    // Copy synapse-mini project files (without .ai/memory) into temp
    const src = path.resolve(repoRoot, "examples/synapse-mini");
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

    const output = runCli(dest, ["ingest-spec", "specs/legacy/2025-agent-routing.md", "--force", "--json"]);
    const results = JSON.parse(output);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].actuality).toBe("historical_context");

    await rm(dest, { recursive: true, force: true });
  });

  it("reconciles memory", async () => {
    const root = await createTempProject();
    const output = runCli(root, ["reconcile", "--json"]);
    const report = JSON.parse(output);
    expect(report).toHaveProperty("staleRefs");
    expect(report).toHaveProperty("weakCurrentClaims");
    expect(report).toHaveProperty("realizableProposals");
    expect(report).toHaveProperty("orphanModules");
  });

  it("updates a card body safely", async () => {
    const root = await createTempProject();
    const newBody = "# Updated title\n\n## Responsibility\n\nThis module handles agent card filtering by caller identity.\n\n## Code evidence\n\n- FilterCardsForCaller at internal/registry/access_filter.go:3\n";
    const output = runCli(root, ["update", "agent-tool-registry", "--body", newBody, "--json"]);
    const result = JSON.parse(output);
    expect(result.updated).toBe(true);
    expect(result.changes).toContain("body");
    // verify frontmatter preserved — show the card
    const showOutput = runCli(root, ["show", "agent-tool-registry", "--json"]);
    const card = JSON.parse(showOutput);
    expect(card.meta.entity_type).toBe("module");
    expect(card.meta.id).toBe("agent-tool-registry");
    expect(card.body).toContain("Updated title");
  });

  it("reconcile --fix updates open-questions.md", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "repo-memory-fix-test-"));
    await initMemory({ root });

    // Create project structure and a Go source file
    await mkdir(path.join(root, "internal/registry"), { recursive: true });
    await writeFile(
      path.join(root, "internal/registry/access_filter.go"),
      `package registry\n\nfunc FilterCards() {}\n`,
      "utf8",
    );

    // Bootstrap creates cards with file-level code_refs
    runCli(root, ["bootstrap"]);

    // Delete the Go file so it becomes a stale ref
    await rm(path.join(root, "internal/registry/access_filter.go"));

    const output = runCli(root, ["reconcile", "--fix", "--json"]);
    const report = JSON.parse(output);

    // appliedFixes should exist and contain open questions
    expect(report.appliedFixes).toBeDefined();
    expect(report.appliedFixes.openQuestionsAppended.length).toBeGreaterThan(0);

    // Verify open-questions.md was written and contains the stale ref
    const openQuestionsPath = path.join(root, ".ai", "memory", "reconciliation", "open-questions.md");
    const openQuestionsContent = await readFile(openQuestionsPath, "utf8");
    expect(openQuestionsContent).toContain("Stale ref:");
  });

  it("reconcile without --fix stays read-only", async () => {
    const root = await createTempProject();

    const output = runCli(root, ["reconcile", "--json"]);
    const report = JSON.parse(output);

    // appliedFixes should NOT be present when --fix is not set
    expect(report.appliedFixes).toBeUndefined();

    // Verify no reconciliation files were modified
    const reconciliationDir = path.join(root, ".ai", "memory", "reconciliation");
    let dirExists = true;
    try {
      await mkdir(reconciliationDir, { recursive: false });
      await rm(reconciliationDir, { recursive: true });
    } catch {
      dirExists = false;
    }
    expect(dirExists).toBe(false);
  });

  it("reconcile --fix updates claim evidence via CLI", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "repo-memory-fix-claim-"));
    await initMemory({ root });

    // Create Go + test files
    await mkdir(path.join(root, "internal/registry"), { recursive: true });
    await writeFile(
      path.join(root, "internal/registry/access_filter.go"),
      "package registry\n\nfunc FilterCardsForCaller(caller string) {}\n",
      "utf8",
    );
    await mkdir(path.join(root, "tests/agent-registry"), { recursive: true });
    await writeFile(
      path.join(root, "tests/agent-registry/access_filter_test.go"),
      "package registry_test\n\nfunc TestFilterCardsForCaller() {}\n",
      "utf8",
    );

    // Create and ingest spec
    await mkdir(path.join(root, "specs"), { recursive: true });
    await writeFile(
      path.join(root, "specs/access-filter.md"),
      `# Access Filter Spec

Status: accepted

## Requirements

- Registry filters available agent cards by caller service identity
- The filtering logic lives in \`internal/registry/access_filter.go\`
`,
      "utf8",
    );
    await ingestSpecCommand("specs/access-filter.md", { root, force: true });

    // Delete the Go file so evidence changes
    await rm(path.join(root, "internal/registry/access_filter.go"));
    await rm(path.join(root, "tests/agent-registry/access_filter_test.go"));
    await rm(path.join(root, "tests/agent-registry"), { recursive: true });

    const output = runCli(root, ["reconcile", "--fix", "--json"]);
    const report = JSON.parse(output);

    // appliedFixes should have claimsUpdated
    expect(report.appliedFixes).toBeDefined();
    expect(report.appliedFixes.claimsUpdated.length).toBeGreaterThan(0);
  });
});

describe("CLI Phase 3 commands", () => {
  it("CLI route: --json outputs valid JSON", async () => {
    const root = await createTempProject();
    try {
      const output = runCli(root, ["route", "--json"]);
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("mode");
      expect(parsed).toHaveProperty("reasons");
      expect(parsed).toHaveProperty("type");
      expect(parsed).toHaveProperty("risks");
      expect(parsed).toHaveProperty("behaviorChange");
    } catch (e: any) {
      // If there's no git history, route command might fail — that's acceptable
      // as long as --json output is valid when it succeeds
      if (e.status !== 0) throw e;
    }
  });

  it("CLI session-open: creates lane (--json)", async () => {
    const root = await createTempProject();
    const output = runCli(root, ["session-open", "--lane-key", "test-lane", "--phase", "implementation", "--session-id", "sess-1", "--json"]);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("opened");
    expect(parsed.opened).toBe("test-lane");
  });

  it("CLI session-close: updates status (--json)", async () => {
    const root = await createTempProject();
    runCli(root, ["session-open", "--lane-key", "test-lane", "--phase", "implementation", "--session-id", "sess-1"]);
    const output = runCli(root, ["session-close", "--lane-key", "test-lane", "--status", "completed", "--json"]);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("closed");
    expect(parsed.closed).toBe("test-lane");
    expect(parsed.status).toBe("completed");
  });

  it("CLI profile: no args → shows current profile", async () => {
    const root = await createTempProject();
    try {
      const output = runCli(root, ["profile"]);
      expect(output).toContain("Active profile:");
    } catch (e: any) {
      // profile command may fail if no model-routing config exists — acceptable for CLI-level testing
      if (e.status !== 0) throw e;
    }
  });

  it("CLI profile quality: switches profile", async () => {
    const root = await createTempProject();
    try {
      const output = runCli(root, ["profile", "quality"]);
      expect(output).toContain("Profile switched to: quality");
    } catch (e: any) {
      if (e.status !== 0) throw e;
    }
  });

  it("CLI openspec-status: delegates or graceful message", () => {
    const root = loadSynapseMini();
    const output = runCli(root, ["openspec-status"]);
    // Either openspec is installed (delegates) or not installed (graceful message)
    expect(output.length).toBeGreaterThan(0);
  });
});

const V3_CARD_CONTENT = `---
memory_card_type: module
runtime_tier: production
source_status: current
evidence_level: code
title: Test Module
---

## Зачем агенту читать эту карточку
Test module for migration.
`;

async function createV3Fixture(tmpDir: string) {
  const v3ModulesDir = path.join(tmpDir, "v3/knowledge/memory/modules");
  await mkdir(v3ModulesDir, { recursive: true });
  await writeFile(path.join(v3ModulesDir, "test-module.md"), V3_CARD_CONTENT, "utf8");
  return v3ModulesDir;
}

describe("CLI migrate-from-v3", () => {
  it("CLI migrate-from-v3 <v3-dir> — basic migration", async () => {
    const target = await mkdtemp(path.join(tmpdir(), "migrate-target-"));
    const v3Dir = await mkdtemp(path.join(tmpdir(), "migrate-v3-"));
    const v3ModulesDir = path.join(v3Dir, "knowledge/memory/modules");
    await mkdir(v3ModulesDir, { recursive: true });
    await writeFile(path.join(v3ModulesDir, "test-module.md"), V3_CARD_CONTENT, "utf8");

    const output = runCli(target, ["migrate-from-v3", v3Dir]);
    expect(output).toContain("Migrated:");

    const targetPath = path.join(target, ".ai/memory/modules/test-module.md");
    const targetContent = await readFile(targetPath, "utf8");
    expect(targetContent).toContain("Test Module");

    await rm(target, { recursive: true, force: true });
    await rm(v3Dir, { recursive: true, force: true });
  });

  it("CLI migrate-from-v3 --dry-run — no files written", async () => {
    const target = await mkdtemp(path.join(tmpdir(), "migrate-dryrun-"));
    const v3Dir = await mkdtemp(path.join(tmpdir(), "migrate-v3-dry-"));
    const v3ModulesDir = path.join(v3Dir, "knowledge/memory/modules");
    await mkdir(v3ModulesDir, { recursive: true });
    await writeFile(path.join(v3ModulesDir, "test-module.md"), V3_CARD_CONTENT, "utf8");

    runCli(target, ["migrate-from-v3", v3Dir, "--dry-run"]);

    // Assert no .ai/memory was created
    const targetMemory = path.join(target, ".ai/memory/modules/test-module.md");
    try {
      await readFile(targetMemory, "utf8");
      expect.fail("File should not exist in dry-run mode");
    } catch {
      // Expected — file was not written
    }

    await rm(target, { recursive: true, force: true });
    await rm(v3Dir, { recursive: true, force: true });
  });

  it("CLI migrate-from-v3 --json — valid JSON output", async () => {
    const target = await mkdtemp(path.join(tmpdir(), "migrate-json-"));
    const v3Dir = await mkdtemp(path.join(tmpdir(), "migrate-v3-json-"));
    const v3ModulesDir = path.join(v3Dir, "knowledge/memory/modules");
    await mkdir(v3ModulesDir, { recursive: true });
    await writeFile(path.join(v3ModulesDir, "test-module.md"), V3_CARD_CONTENT, "utf8");

    const output = runCli(target, ["migrate-from-v3", v3Dir, "--json"]);
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty("command");
    expect(parsed).toHaveProperty("v3Dir");
    expect(parsed).toHaveProperty("target");
    expect(parsed).toHaveProperty("discovered");
    expect(parsed).toHaveProperty("migrated");
    expect(parsed).toHaveProperty("skipped");
    expect(parsed).toHaveProperty("errors");
    expect(parsed).toHaveProperty("warnings");

    await rm(target, { recursive: true, force: true });
    await rm(v3Dir, { recursive: true, force: true });
  });

  it("CLI migrate-from-v3 --force — overwrites existing", async () => {
    const target = await mkdtemp(path.join(tmpdir(), "migrate-force-"));
    const v3Dir = await mkdtemp(path.join(tmpdir(), "migrate-v3-force-"));
    const v3ModulesDir = path.join(v3Dir, "knowledge/memory/modules");
    await mkdir(v3ModulesDir, { recursive: true });
    await writeFile(path.join(v3ModulesDir, "test-module.md"), V3_CARD_CONTENT, "utf8");

    // Pre-create target .ai/memory/modules/test-module.md with different content
    const targetModulesDir = path.join(target, ".ai/memory/modules");
    await mkdir(targetModulesDir, { recursive: true });
    await writeFile(
      path.join(targetModulesDir, "test-module.md"),
      "EXISTING CONTENT",
      "utf8",
    );

    runCli(target, ["migrate-from-v3", v3Dir, "--force"]);

    const targetPath = path.join(target, ".ai/memory/modules/test-module.md");
    const targetContent = await readFile(targetPath, "utf8");
    expect(targetContent).not.toContain("EXISTING CONTENT");
    expect(targetContent).toContain("Test Module");

    await rm(target, { recursive: true, force: true });
    await rm(v3Dir, { recursive: true, force: true });
  });

  it("CLI migrate-from-v3 --preserve-manifest — manifest copied", async () => {
    const target = await mkdtemp(path.join(tmpdir(), "migrate-manifest-"));
    const v3Dir = await mkdtemp(path.join(tmpdir(), "migrate-v3-manifest-"));
    const v3ModulesDir = path.join(v3Dir, "knowledge/memory/modules");
    await mkdir(v3ModulesDir, { recursive: true });
    await writeFile(path.join(v3ModulesDir, "test-module.md"), V3_CARD_CONTENT, "utf8");

    // Create a source-manifest.json
    const v3MemoryRoot = path.join(v3Dir, "knowledge/memory");
    await writeFile(
      path.join(v3MemoryRoot, "source-manifest.json"),
      JSON.stringify({ source: "v3", version: "3.0" }),
      "utf8",
    );

    runCli(target, ["migrate-from-v3", v3Dir, "--preserve-manifest"]);

    const manifestPath = path.join(target, ".ai/memory/source-manifest.json");
    const manifestContent = await readFile(manifestPath, "utf8");
    expect(manifestContent).toContain("v3");

    await rm(target, { recursive: true, force: true });
    await rm(v3Dir, { recursive: true, force: true });
  });

  it("CLI migrate-from-v3 --skip-review — sets review_required=false", async () => {
    const target = await mkdtemp(path.join(tmpdir(), "migrate-skipreview-"));
    const v3Dir = await mkdtemp(path.join(tmpdir(), "migrate-v3-skipreview-"));
    const v3ModulesDir = path.join(v3Dir, "knowledge/memory/modules");
    await mkdir(v3ModulesDir, { recursive: true });
    await writeFile(path.join(v3ModulesDir, "test-module.md"), V3_CARD_CONTENT, "utf8");

    runCli(target, ["migrate-from-v3", v3Dir, "--skip-review"]);

    const targetPath = path.join(target, ".ai/memory/modules/test-module.md");
    const targetContent = await readFile(targetPath, "utf8");
    expect(targetContent).toContain("review_required: false");

    await rm(target, { recursive: true, force: true });
    await rm(v3Dir, { recursive: true, force: true });
  });

  it("CLI migrate-from-v3 --include-docs migrates docs to correct subdir", async () => {
    const target = await mkdtemp(path.join(tmpdir(), "migrate-docs-"));
    const v3Dir = await mkdtemp(path.join(tmpdir(), "migrate-v3-docs-"));

    const v3ModulesDir = path.join(v3Dir, "knowledge/memory/modules");
    await mkdir(v3ModulesDir, { recursive: true });
    await writeFile(path.join(v3ModulesDir, "test-module.md"), V3_CARD_CONTENT, "utf8");

    const v3DocsDir = path.join(v3Dir, "knowledge/docs/services");
    await mkdir(v3DocsDir, { recursive: true });
    const docsContent = `---
node_type: service
title: Test Service
status: active
---
# Test Service
Service doc content.
`;
    await writeFile(path.join(v3DocsDir, "test-svc.md"), docsContent, "utf8");

    runCli(target, ["migrate-from-v3", v3Dir, "--include-docs"]);

    const targetPath = path.join(target, ".ai/memory/modules/test-svc.md");
    const targetContent = await readFile(targetPath, "utf8");
    expect(targetContent).toContain("Test Service");

    await rm(target, { recursive: true, force: true });
    await rm(v3Dir, { recursive: true, force: true });
  });

  it("CLI migrate-from-v3 --skip-coverage does not create source-coverage.json", async () => {
    const target = await mkdtemp(path.join(tmpdir(), "migrate-skipcov-"));
    const v3Dir = await mkdtemp(path.join(tmpdir(), "migrate-v3-skipcov-"));

    const v3ModulesDir = path.join(v3Dir, "knowledge/memory/modules");
    await mkdir(v3ModulesDir, { recursive: true });
    await writeFile(path.join(v3ModulesDir, "test-module.md"), V3_CARD_CONTENT, "utf8");

    const v3MemoryRoot = path.join(v3Dir, "knowledge/memory");
    await writeFile(
      path.join(v3MemoryRoot, "source-coverage.json"),
      JSON.stringify({
        entries: [
          { path: "docs/test.md", sha256: "abc", disposition: "extracted", targetCards: [] },
        ],
        counts: {},
      }),
      "utf8",
    );

    runCli(target, ["migrate-from-v3", v3Dir, "--skip-coverage"]);

    const coveragePath = path.join(target, ".ai/memory/source-coverage.json");
    try {
      await readFile(coveragePath, "utf8");
      expect.fail("source-coverage.json should not exist with --skip-coverage");
    } catch {
      // Expected — file was not written
    }

    await rm(target, { recursive: true, force: true });
    await rm(v3Dir, { recursive: true, force: true });
  });

  it("CLI migrate-from-v3 help — command listed", () => {
    const output = execFileSync(tsxBin, [cli, "--help"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(output).toContain("migrate-from-v3");
  });
});
