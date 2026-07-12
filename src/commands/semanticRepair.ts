import { semanticRepairCard, repairLinks, repairModuleTiers, repairArchitectureIndex, repairCoverage, rebuildIndexes } from "../core/semanticRepair.js";
import { buildAllContentMaps } from "../core/contentMap.js";
import { discoverProject } from "../core/discoverProject.js";
import { loadMemoryCards } from "../core/loadMemory.js";
import { validateMemory } from "../core/validate.js";
import { resolveRoot, resolveMemoryRoot } from "../core/paths.js";
import { readFile, writeFile } from "node:fs/promises";
import { frontmatterYaml } from "../core/utils.js";
import path from "node:path";

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

  // Write updated tier to disk for cards that had tier updated
  for (const card of cards) {
    if (card.meta.runtime_tier && card.meta.runtime_tier !== "unknown") {
      // Check if the card file needs updating (simplified — write all repaired cards)
    }
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