import { semanticRepairCard, repairLinks, repairModuleTiers, repairArchitectureIndex, repairCoverage, rebuildIndexes } from "../core/semanticRepair.js";
import { buildAllContentMaps } from "../core/contentMap.js";
import { discoverProject } from "../core/discoverProject.js";
import { loadMemoryCards } from "../core/loadMemory.js";
import { validateMemory } from "../core/validate.js";
import { resolveRoot, resolveMemoryRoot } from "../core/paths.js";
import { readFile } from "node:fs/promises";
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

  for (const card of cards) {
    const result = semanticRepairCard(card, contentMaps);
    if (result.repaired) repaired++;
    if (result.quarantined) quarantined++;
  }

  const linksResult = repairLinks(cards);
  const tiersResult = repairModuleTiers(cards, discovery.files);
  const archResult = repairArchitectureIndex(cards);
  const indexResult = rebuildIndexes(cards);

  const summary = {
    cardsTotal: cards.length,
    repaired,
    quarantined,
    linksFixed: linksResult.fixed,
    linksUnfixed: linksResult.unfixed.length,
    tiersUpdated: tiersResult.updated,
    architectureUpdated: archResult.updated,
    decisionsIndex: indexResult.decisions,
    flowsIndex: indexResult.flows,
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
    console.log(`Links: ${summary.linksFixed} fixed, ${summary.linksUnfixed} unfixed`);
    console.log(`Module tiers: ${summary.tiersUpdated} updated`);
    console.log(`Architecture index: ${summary.architectureUpdated ? "updated" : "no change"}`);
    console.log(`Index tables: decisions=${summary.decisionsIndex}, flows=${summary.flowsIndex}`);
    if (checkResult) {
      console.log(`\nValidate: ${checkResult.ok ? "OK" : "FAIL"} (${checkResult.errors.length} errors, ${checkResult.warnings.length} warnings)`);
    }
  }
}