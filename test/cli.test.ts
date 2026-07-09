import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTempProject, loadSynapseMini } from "./helpers.js";

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

  it("ingests a spec", () => {
    const root = loadSynapseMini();
    const output = runCli(root, ["ingest-spec", "specs/legacy/2025-agent-routing.md", "--force", "--json"]);
    const results = JSON.parse(output);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].actuality).toBe("historical_context");
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
    const newBody = "# Updated title\n\n## Responsibility\n\nThis module handles agent card filtering by caller identity.\n";
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
});
