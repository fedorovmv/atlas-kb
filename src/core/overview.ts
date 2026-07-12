import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadMemoryCardsBestEffort } from "./loadMemory.js";
import { resolveRoot, resolveMemoryRoot } from "./paths.js";
import { fileHash } from "./hashing.js";
import { loadSessions, getSessionLanesSummary } from "./sessionTracking.js";

export interface OverviewResult {
  overviewPath: string;
  sourcesPath: string;
  sections: string[];
}

export async function renderOverview(options: { root?: string }): Promise<OverviewResult> {
  const root = resolveRoot(options);
  const memoryRoot = resolveMemoryRoot(options);
  const cards = await loadMemoryCardsBestEffort({ root });

  const sections: string[] = [];
  const sources: Record<string, string> = {};

  const routeManifestPath = path.join(root, ".ai/memory-build/latest/route-manifest.json");
  let routeReasons = "N/A";
  if (existsSync(routeManifestPath)) {
    try {
      const manifestContent = await readFile(routeManifestPath, "utf8");
      const manifest = JSON.parse(manifestContent);
      const result = manifest.result;
      routeReasons = `Mode: ${result.mode.toUpperCase()}\n` +
        `Type: ${result.type}\n` +
        `Reasons:\n` +
        result.reasons.map((r: string) => `  - ${r}`).join("\n");
    } catch {
      routeReasons = "N/A (route manifest invalid)";
    }
  }
  sections.push(`## Route reasons\n${routeReasons}`);

  const openspecDir = path.join(root, "openspec");
  sections.push("## OpenSpec\n" + (existsSync(openspecDir) ? "Found openspec directory." : "N/A"));

  const scenarios = cards.filter((c) => c.meta.entity_type === "scenario");
  if (scenarios.length > 0) {
    const lines = scenarios.map((s) => `| ${s.meta.id} | ${s.meta.title} | ${s.meta.status} |`);
    sections.push("## Scenario matrix\n| ID | Title | Status |\n|---|---|---|\n" + lines.join("\n"));
  } else {
    sections.push("## Scenario matrix\nN/A");
  }

  const tests = cards.filter((c) => c.meta.entity_type === "testing");
  sections.push("## Test obligations\n" + (tests.length > 0 ? tests.map((t) => `- ${t.meta.id}`).join("\n") : "N/A"));

  sections.push("## Tasks\nN/A");

  const verified = cards.filter((c) => c.meta.evidence_level === "code_confirmed" || c.meta.evidence_level === "test_confirmed");
  sections.push("## Verification evidence\n" + (verified.length > 0 ? verified.map((v) => `- ${v.meta.id}: ${v.meta.evidence_level}`).join("\n") : "N/A"));

  const reviewed = cards.filter((c) => !c.meta.review_required);
  sections.push("## Reviews\n" + (reviewed.length > 0 ? reviewed.map((r) => `| ${r.meta.id} | ${r.meta.status} |`).join("\n") : "N/A"));

  const sessions = await loadSessions(root);
  const sessionSummary = getSessionLanesSummary(sessions);
  sections.push(`## Session lanes\n${sessionSummary}`);

  const byType: Record<string, number> = {};
  for (const card of cards) {
    byType[card.meta.entity_type] = (byType[card.meta.entity_type] || 0) + 1;
  }
  const impactLines = Object.entries(byType).map(([type, count]) => `- ${type}: ${count}`);
  sections.push("## Knowledge impact\n" + (impactLines.length > 0 ? impactLines.join("\n") : "N/A"));

  const overviewContent = "# Memory Overview\n\n" + sections.join("\n\n");
  const overviewPath = path.join(memoryRoot, "OVERVIEW.md");
  if (!existsSync(path.dirname(overviewPath))) {
    await mkdir(path.dirname(overviewPath), { recursive: true });
  }
  await writeFile(overviewPath, overviewContent, "utf8");

  for (const card of cards) {
    try { sources[card.relativePath] = await fileHash(card.path); } catch { /* skip */ }
  }
  const sourcesPath = path.join(memoryRoot, "overview-sources.json");
  await writeFile(sourcesPath, JSON.stringify({ sources }, null, 2), "utf8");

  return { overviewPath, sourcesPath, sections };
}