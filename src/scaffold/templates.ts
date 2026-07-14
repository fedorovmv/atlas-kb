import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ScaffoldFile = { path: string; content: string };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, "templates");

function loadTemplate(relPath: string): string {
  return readFileSync(path.join(templatesDir, relPath), "utf8");
}

export const MEMORY_GUARD_PLUGIN_TEMPLATE = loadTemplate("plugins/atlas-guard.js");

export const scaffoldFiles: ScaffoldFile[] = [
  { path: ".ai/memory/MEMORY.md", content: loadTemplate("memory/MEMORY.md") },
  { path: ".ai/memory/MODULES.md", content: loadTemplate("memory/MODULES.md") },
  { path: ".ai/memory/DECISIONS.md", content: loadTemplate("memory/DECISIONS.md") },
  { path: ".ai/memory/ARCHITECTURE.md", content: loadTemplate("memory/ARCHITECTURE.md") },
  { path: ".ai/memory/flows/.gitkeep", content: loadTemplate("memory/flows/.gitkeep") },
  { path: ".ai/memory/architecture/.gitkeep", content: loadTemplate("memory/architecture/.gitkeep") },
  { path: ".ai/memory/README.md", content: loadTemplate("memory/README.md") },
  { path: ".ai/memory/ontology.md", content: loadTemplate("memory/ontology.md") },
  { path: ".ai/memory/product-map.md", content: loadTemplate("memory/product-map.md") },
  // Example cards — used by test fixtures. Excluded from init via scaffoldExampleFiles.
  // { path: ".ai/memory/modules/agent-tool-registry.md", content: loadTemplate("memory/modules/agent-tool-registry.md") },
  // { path: ".ai/memory/modules/mcp-gateway.md", content: loadTemplate("memory/modules/mcp-gateway.md") },
  // { path: ".ai/memory/scenarios/a2a-agent-discovery.md", content: loadTemplate("memory/scenarios/a2a-agent-discovery.md") },
  // { path: ".ai/memory/scenarios/mcp-tool-discovery.md", content: loadTemplate("memory/scenarios/mcp-tool-discovery.md") },
  // { path: ".ai/memory/decisions/registry-is-discovery-not-orchestration.md", content: loadTemplate("memory/decisions/registry-is-discovery-not-orchestration.md") },
  { path: ".ai/memory/modules/.gitkeep", content: "" },
  { path: ".ai/memory/scenarios/.gitkeep", content: "" },
  { path: ".ai/memory/decisions/.gitkeep", content: "" },
  { path: ".ai/memory/proposals/.gitkeep", content: loadTemplate("memory/proposals/.gitkeep") },
  { path: ".ai/memory/historical/.gitkeep", content: "" },
  { path: ".ai/memory/reconciliation/conflicts.md", content: loadTemplate("memory/reconciliation/conflicts.md") },
  { path: ".ai/memory/reconciliation/open-questions.md", content: loadTemplate("memory/reconciliation/open-questions.md") },
  { path: ".ai/atlas/config/source-priority.yaml", content: loadTemplate("config/source-priority.yaml") },
  { path: ".ai/atlas/config/model-routing.yaml", content: loadTemplate("config/model-routing.yaml") },
  { path: ".ai/atlas/config/code-map.yaml", content: loadTemplate("config/code-map.yaml") },
  { path: ".ai/docs/.gitkeep", content: loadTemplate("docs/.gitkeep") },
  { path: ".ai/drafts/.gitkeep", content: loadTemplate("drafts/.gitkeep") },
  { path: ".opencode/skills/atlas-bank/SKILL.md", content: loadTemplate("skills/atlas-bank.md") },
  { path: ".opencode/skills/atlas-ingest/SKILL.md", content: loadTemplate("skills/atlas-ingest.md") },
  { path: ".opencode/skills/atlas-reconcile/SKILL.md", content: loadTemplate("skills/atlas-reconcile.md") },
  { path: ".opencode/skills/atlas-bootstrap/SKILL.md", content: loadTemplate("skills/atlas-bootstrap.md") },
  { path: ".opencode/commands/atlas-bootstrap.md", content: loadTemplate("commands/atlas-bootstrap.md") },
  { path: ".opencode/commands/atlas-recall.md", content: loadTemplate("commands/atlas-recall.md") },
  { path: ".opencode/commands/atlas-ingest.md", content: loadTemplate("commands/atlas-ingest.md") },
  { path: ".opencode/commands/atlas-reconcile.md", content: loadTemplate("commands/atlas-reconcile.md") },
  { path: ".opencode/agents/atlas-extractor.md", content: loadTemplate("agents/atlas-extractor.md") },
  { path: ".opencode/agents/atlas-coder.md", content: loadTemplate("agents/atlas-coder.md") },
  { path: ".opencode/agents/atlas-reviewer.md", content: loadTemplate("agents/atlas-reviewer.md") },
  { path: ".opencode/agents/atlas-analyst.md", content: loadTemplate("agents/atlas-analyst.md") },
  { path: ".opencode/tools/atlas.ts", content: loadTemplate("tools/atlas.ts") },
  { path: ".opencode/plugins/atlas-guard.js", content: MEMORY_GUARD_PLUGIN_TEMPLATE },
  { path: "AGENTS.md", content: loadTemplate("AGENTS.md") },
];

export function getHookTemplates(): ScaffoldFile[] {
  return [
    { path: ".git/hooks/pre-commit", content: loadTemplate("githooks/pre-commit") },
    { path: ".git/hooks/pre-push", content: loadTemplate("githooks/pre-push") },
    { path: ".git/hooks/post-checkout", content: loadTemplate("githooks/post-checkout") },
    { path: ".git/hooks/post-merge", content: loadTemplate("githooks/post-merge") },
  ];
}

export function getCiTemplate(): ScaffoldFile {
  return {
    path: ".github/workflows/memory-bank.yml",
    content: loadTemplate(".github/workflows/memory-bank.yml"),
  };
}
