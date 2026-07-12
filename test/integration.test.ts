import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

async function copySynapseMiniWithoutMemory(dest: string) {
  const src = path.resolve(repoRoot, "examples/synapse-mini");
  // copy project files but skip .ai and .opencode (we want clean bootstrap)
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

describe("E2E integration on synapse-mini", () => {
  it("full pipeline: discover → bootstrap → validate → context → ingest-spec → validate → reconcile", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "e2e-integration-"));
    await copySynapseMiniWithoutMemory(dest);

    // 1. discover
    const discoverOut = runCli(dest, ["discover", "--json"]);
    const discovery = JSON.parse(discoverOut);
    expect(discovery.files.length).toBeGreaterThan(0);

    // 2. bootstrap
    const bootstrapOut = runCli(dest, ["bootstrap"]);
    expect(bootstrapOut).toContain("Written");

    // 3. validate (no errors after bootstrap)
    const validateOut = runCli(dest, ["validate", "--json"]);
    const validateReport = JSON.parse(validateOut);
    expect(validateReport.ok).toBe(true);
    expect(validateReport.errors.length).toBe(0);

    // 4. context for agent registry
    const contextOut = runCli(dest, ["context", "agent registry filtering", "--json"]);
    const contextPack = JSON.parse(contextOut);
    expect(contextPack.selected.length).toBeGreaterThan(0);
    expect(contextPack.codeRefs.length).toBeGreaterThan(0);

    // 5. ingest-spec (legacy → historical)
    const ingestOut = runCli(dest, ["ingest-spec", "specs/legacy/2025-agent-routing.md", "--json"]);
    const ingestResults = JSON.parse(ingestOut);
    expect(ingestResults.length).toBe(1);
    expect(ingestResults[0].actuality).toBe("historical_context");

    // 6. validate again (still no errors after ingest)
    const validateOut2 = runCli(dest, ["validate", "--json"]);
    const validateReport2 = JSON.parse(validateOut2);
    expect(validateReport2.ok).toBe(true);

    // 7. reconcile (read-only report)
    const reconcileOut = runCli(dest, ["reconcile", "--json"]);
    const reconcileReport = JSON.parse(reconcileOut);
    expect(reconcileReport).toHaveProperty("staleRefs");
    expect(reconcileReport).toHaveProperty("orphanModules");

    await rm(dest, { recursive: true, force: true });
  }, 10000);

  it("demo file is not production evidence after bootstrap", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "e2e-demo-"));
    await copySynapseMiniWithoutMemory(dest);

    runCli(dest, ["bootstrap", "--json"]);
    const contextOut = runCli(dest, ["context", "demo agent", "--json"]);
    const contextPack = JSON.parse(contextOut);
    // demo file should NOT appear in codeRefs as production evidence
    const demoInCodeRefs = contextPack.codeRefs.some((r: string) => r.includes("demo-agent/main.go"));
    expect(demoInCodeRefs).toBe(false);

    await rm(dest, { recursive: true, force: true });
  });
});
