import { mkdtemp, mkdir, writeFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initMemory } from "../src/commands/init.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(__dirname, "..", "src", "scaffold", "templates");

export async function createTempProject() {
  const root = await mkdtemp(path.join(tmpdir(), "repo-memory-test-"));
  await initMemory({ root });

  // Copy example scaffold cards (not in default scaffold, used as test fixtures)
  await copyFile(
    path.join(templatesDir, "memory/modules/agent-tool-registry.md"),
    path.join(root, ".ai/memory/modules/agent-tool-registry.md"),
  );
  await copyFile(
    path.join(templatesDir, "memory/modules/mcp-gateway.md"),
    path.join(root, ".ai/memory/modules/mcp-gateway.md"),
  );
  await copyFile(
    path.join(templatesDir, "memory/scenarios/a2a-agent-discovery.md"),
    path.join(root, ".ai/memory/scenarios/a2a-agent-discovery.md"),
  );
  await copyFile(
    path.join(templatesDir, "memory/scenarios/mcp-tool-discovery.md"),
    path.join(root, ".ai/memory/scenarios/mcp-tool-discovery.md"),
  );
  await copyFile(
    path.join(templatesDir, "memory/decisions/registry-is-discovery-not-orchestration.md"),
    path.join(root, ".ai/memory/decisions/registry-is-discovery-not-orchestration.md"),
  );

  await mkdir(path.join(root, "internal/registry"), { recursive: true });
  await mkdir(path.join(root, "pkg/agentcard"), { recursive: true });
  await mkdir(path.join(root, "internal/mcp"), { recursive: true });
  await mkdir(path.join(root, "tests/agent-registry"), { recursive: true });

  await writeFile(
    path.join(root, "internal/registry/access_filter.go"),
    `package registry\n\nfunc FilterCardsForCaller(caller string) []string { return []string{caller} }\n`,
    "utf8",
  );
  await writeFile(
    path.join(root, "tests/agent-registry/access_filter_test.go"),
    `package registry_test\n\nfunc TestFilterCardsForCaller() {}\n`,
    "utf8",
  );

  return root;
}

export function loadSynapseMini(): string {
  return path.resolve(__dirname, "..", "examples", "synapse-mini");
}
