import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTempProject } from "./helpers.js";

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
});
