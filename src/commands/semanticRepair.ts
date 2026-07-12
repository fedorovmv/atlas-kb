import { semanticRepairCard, repairLinks, repairModuleTiers, repairArchitectureIndex, repairCoverage, rebuildIndexes } from "../core/semanticRepair.js";
import { buildAllContentMaps } from "../core/contentMap.js";
import { discoverProject } from "../core/discoverProject.js";
import { loadMemoryCards } from "../core/loadMemory.js";
import { validateMemory } from "../core/validate.js";
import { resolveRoot, resolveMemoryRoot } from "../core/paths.js";
import { readFile, writeFile } from "node:fs/promises";
import { frontmatterYaml, readFileIfExists } from "../core/utils.js";
import path from "node:path";

/**
 * Build index file content. Preserves frontmatter and custom sections.
 * Finds the target section heading, replaces/inserts the child-card table.
 */
export function buildIndexContent(existing: string, table: string, sectionHeading: string): string {
  // Split out frontmatter if present
  const fmMatch = existing.match(/^---\n[\s\S]*?\n---\n/);
  const frontmatter = fmMatch ? fmMatch[0] : `---
entity_type: index
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: high
knowledge_types:
  - design_rationale
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: false
  requires_warning: false
---

`;
  // Body after frontmatter
  let body = fmMatch ? existing.slice(fmMatch[0].length) : existing;

  const sectionRegex = new RegExp(`## ${sectionHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n(?:[\\s\\S]*?)(?=\\n## |$)`);
  if (sectionRegex.test(body)) {
    // Replace existing section content
    body = body.replace(sectionRegex, `## ${sectionHeading}\n${table}\n`);
  } else {
    // Append new section before any other content or at the end
    body = body.trimEnd() + `\n## ${sectionHeading}\n${table}\n`;
  }

  return `${frontmatter}${body.trimEnd()}\n`;
}

export async function semanticRepairCommand(options: {
  root?: string;
  buildDir?: string;
  runCheck?: boolean;
  json?: boolean;
}): Promise<void> {
  const root = resolveRoot(options);
  const memoryRoot = resolveMemoryRoot(options);

  const cards = await loadMemoryCards({ root, memoryRoot });
  const discovery = await discoverProject({ root, memoryRoot });
  const { maps: contentMaps } = await buildAllContentMaps(discovery, cards, { root, buildDir: options.buildDir });

  let repaired = 0;
  let quarantined = 0;
  let writtenFiles = 0;

  for (const card of cards) {
    const result = semanticRepairCard(card, contentMaps);
    if (result.repaired) {
      repaired++;
      // Write repaired card body to disk
      const fm = frontmatterYaml(card.meta as Record<string, unknown>);
      const content = `---\n${fm}\n---\n\n${card.body.trimStart()}\n`;
      await writeFile(card.path, content, "utf8");
      writtenFiles++;
    }
    if (result.quarantined) quarantined++;
  }

  const linksResult = repairLinks(cards);
  const tiersResult = repairModuleTiers(cards, discovery.files);
  const archResult = repairArchitectureIndex(cards);
  const indexResult = rebuildIndexes(cards);

  // Write cards whose body changed due to link repair
  for (const card of linksResult.changedCards) {
    const fm = frontmatterYaml(card.meta as Record<string, unknown>);
    const content = `---\n${fm}\n---\n\n${card.body.trimStart()}\n`;
    await writeFile(card.path, content, "utf8");
    writtenFiles++;
  }

  // Write cards whose runtime_tier was updated
  for (const card of tiersResult.changedCards) {
    const fm = frontmatterYaml(card.meta as Record<string, unknown>);
    const content = `---\n${fm}\n---\n\n${card.body.trimStart()}\n`;
    await writeFile(card.path, content, "utf8");
    writtenFiles++;
  }

  // Write DECISIONS.md index — preserve frontmatter and custom sections, append child table
  if (indexResult.decisionsTable) {
    const decisionsPath = path.join(memoryRoot, "DECISIONS.md");
    const decisionsContent = await readFileIfExists(decisionsPath);
    const decisionsBody = buildIndexContent(decisionsContent, indexResult.decisionsTable, "Active decisions");
    await writeFile(decisionsPath, decisionsBody, "utf8");
    writtenFiles++;
  }

  // Write FLOWS.md index — preserve frontmatter and custom sections, append child table
  if (indexResult.flowsTable) {
    const flowsPath = path.join(memoryRoot, "FLOWS.md");
    const flowsContent = await readFileIfExists(flowsPath);
    const flowsBody = buildIndexContent(flowsContent, indexResult.flowsTable, "Active flows");
    await writeFile(flowsPath, flowsBody, "utf8");
    writtenFiles++;
  }

  // Repair coverage if source-coverage.json exists
  let coverageFixed = 0;
  const coveragePath = path.join(memoryRoot, "source-coverage.json");
  try {
    const coverageContent = await readFile(coveragePath, "utf8");
    const coverage = JSON.parse(coverageContent);
    const covResult = repairCoverage(coverage);
    coverageFixed = covResult.fixed;
    if (coverageFixed > 0) {
      await writeFile(coveragePath, JSON.stringify(coverage, null, 2), "utf8");
    }
  } catch {
    // No coverage file — skip
  }

  const summary = {
    cardsTotal: cards.length,
    repaired,
    quarantined,
    writtenFiles,
    linksFixed: linksResult.fixed,
    linksUnfixed: linksResult.unfixed.length,
    tiersUpdated: tiersResult.updated,
    architectureUpdated: archResult.updated,
    decisionsIndex: indexResult.decisions,
    flowsIndex: indexResult.flows,
    coverageFixed,
  };

  let checkResult: { ok: boolean; errors: string[]; warnings: string[] } | undefined;
  if (options.runCheck) {
    checkResult = await validateMemory({ root });
  }

  if (options.json) {
    console.log(JSON.stringify({ ...summary, checkResult }, null, 2));
  } else {
    console.log("# Semantic repair complete");
    console.log(`\nCards: ${summary.cardsTotal} total, ${summary.repaired} repaired, ${summary.quarantined} quarantined`);
    console.log(`Files written: ${summary.writtenFiles}`);
    console.log(`Links: ${summary.linksFixed} fixed, ${summary.linksUnfixed} unfixed`);
    console.log(`Module tiers: ${summary.tiersUpdated} updated`);
    console.log(`Coverage fixed: ${summary.coverageFixed}`);
    if (checkResult) {
      console.log(`\nValidate: ${checkResult.ok ? "OK" : "FAIL"} (${checkResult.errors.length} errors, ${checkResult.warnings.length} warnings)`);
    }
  }
}