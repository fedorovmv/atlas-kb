import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ScaffoldFile = { path: string; content: string };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, "templates");

function loadTemplate(relPath: string): string {
  return readFileSync(path.join(templatesDir, relPath), "utf8");
}

export const MEMORY_GUARD_PLUGIN_TEMPLATE = loadTemplate("plugins/memory-guard.js");

export const scaffoldFiles: ScaffoldFile[] = [
  { path: ".ai/memory/README.md", content: loadTemplate("memory/README.md") },
  { path: ".ai/memory/ontology.md", content: loadTemplate("memory/ontology.md") },
  { path: ".ai/memory/product-map.md", content: loadTemplate("memory/product-map.md") },
  { path: ".ai/memory/modules/agent-tool-registry.md", content: loadTemplate("memory/modules/agent-tool-registry.md") },
  { path: ".ai/memory/modules/mcp-gateway.md", content: loadTemplate("memory/modules/mcp-gateway.md") },
  { path: ".ai/memory/scenarios/a2a-agent-discovery.md", content: loadTemplate("memory/scenarios/a2a-agent-discovery.md") },
  { path: ".ai/memory/scenarios/mcp-tool-discovery.md", content: loadTemplate("memory/scenarios/mcp-tool-discovery.md") },
  { path: ".ai/memory/decisions/registry-is-discovery-not-orchestration.md", content: loadTemplate("memory/decisions/registry-is-discovery-not-orchestration.md") },
  { path: ".ai/memory/proposals/.gitkeep", content: loadTemplate("memory/proposals/.gitkeep") },
  { path: ".ai/memory/reconciliation/conflicts.md", content: loadTemplate("memory/reconciliation/conflicts.md") },
  { path: ".ai/memory/reconciliation/open-questions.md", content: loadTemplate("memory/reconciliation/open-questions.md") },
  { path: ".ai/memory-tool/config/source-priority.yaml", content: loadTemplate("config/source-priority.yaml") },
  { path: ".ai/memory-tool/config/model-routing.yaml", content: loadTemplate("config/model-routing.yaml") },
  { path: ".ai/memory-tool/config/code-map.yaml", content: loadTemplate("config/code-map.yaml") },
  { path: ".opencode/skills/memory-bank/SKILL.md", content: loadTemplate("skills/memory-bank.md") },
  { path: ".opencode/skills/memory-ingest-spec/SKILL.md", content: loadTemplate("skills/memory-ingest-spec.md") },
  { path: ".opencode/skills/memory-reconcile/SKILL.md", content: loadTemplate("skills/memory-reconcile.md") },
  { path: ".opencode/skills/memory-bootstrap/SKILL.md", content: loadTemplate("skills/memory-bootstrap.md") },
  { path: ".opencode/commands/memory-bootstrap.md", content: loadTemplate("commands/memory-bootstrap.md") },
  { path: ".opencode/commands/memory-context.md", content: loadTemplate("commands/memory-context.md") },
  { path: ".opencode/commands/memory-ingest-spec.md", content: loadTemplate("commands/memory-ingest-spec.md") },
  { path: ".opencode/commands/memory-reconcile.md", content: loadTemplate("commands/memory-reconcile.md") },
  { path: ".opencode/agents/memory-extractor.md", content: loadTemplate("agents/memory-extractor.md") },
  { path: ".opencode/agents/memory-coder.md", content: loadTemplate("agents/memory-coder.md") },
  { path: ".opencode/agents/memory-reviewer.md", content: loadTemplate("agents/memory-reviewer.md") },
  { path: ".opencode/agents/memory-analyst.md", content: loadTemplate("agents/memory-analyst.md") },
  { path: ".opencode/tools/memory.ts", content: loadTemplate("tools/memory.ts") },
  { path: ".opencode/plugins/memory-guard.js", content: MEMORY_GUARD_PLUGIN_TEMPLATE },
  { path: "AGENTS.md", content: loadTemplate("AGENTS.md") },
];
