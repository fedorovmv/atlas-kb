import { bootstrapMemory } from "../core/bootstrapMemory.js";
import { loadMemoryCardsBestEffort } from "../core/loadMemory.js";
import type { RepoMemoryOptions } from "../core/types.js";

const PLACEHOLDER_PATTERNS = [
  /Требует ревью/,
  /Не задокументировано в спецификации/,
  /Не задокументировано в коде/,
  /^Needs review/i,
  /^TBD/i,
  /^TODO/i,
];

function countNeedsEnrichment(cards: { meta: { status: string; evidence_level: string; review_required?: boolean }; body: string }[]): number {
  return cards.filter((card) => {
    const weakEvidence = ["inferred", "spec_only", "unknown", "heuristic_match"].includes(card.meta.evidence_level);
    const needsReview = card.meta.status === "needs_review" || card.meta.review_required === true;
    const hasPlaceholder = PLACEHOLDER_PATTERNS.some((pat) => pat.test(card.body));
    return weakEvidence || needsReview || hasPlaceholder;
  }).length;
}

export async function bootstrapMemoryCommand(options: RepoMemoryOptions & { force?: boolean; dryRun?: boolean; json?: boolean } = {}) {
  const result = await bootstrapMemory(options);

  // Always check needs-enrichment count
  const allCards = await loadMemoryCardsBestEffort({ root: options.root });
  const needsEnrichmentCount = countNeedsEnrichment(allCards);

  if (options.json) {
    console.log(JSON.stringify({ written: result.written, skipped: result.skipped, moduleCount: result.report.candidateModules.length, needsEnrichment: needsEnrichmentCount }, null, 2));
    return;
  }
  console.log(`# Memory bootstrap ${options.dryRun ? "plan" : "complete"}`);
  if (result.written.length) {
    console.log("\n## Written");
    for (const p of result.written) console.log(`- ${p}`);
  }
  if (result.skipped.length) {
    console.log("\n## Skipped existing");
    for (const p of result.skipped) console.log(`- ${p}`);
  }
  console.log(`\n## Summary`);
  console.log(`- Modules discovered: ${result.report.candidateModules.length}`);
  console.log(`- Files written: ${result.written.length}`);
  console.log(`- Files skipped: ${result.skipped.length}`);
  if (!options.force && result.skipped.length) console.log("\nUse --force to overwrite existing memory cards.");

  // ALWAYS show enrichment status — even if all cards were skipped
  if (needsEnrichmentCount > 0) {
    console.log(`\n## ⚠️ ${needsEnrichmentCount} cards need LLM enrichment — BOOTSTRAP INCOMPLETE`);
    console.log("Bootstrap is NOT complete. You MUST dispatch subagents to enrich these cards.");
    console.log("Do NOT ask the user. Do NOT offer options. Proceed to Phase 2 now.");
    console.log("\nTo see which cards need work:");
    console.log("  .ai/atlas/bin/atlas ls --needs-enrichment --json");
    console.log("\nThen dispatch subagents per card type:");
    console.log("  module/scenario cards → atlas-extractor → atlas-coder → atlas-reviewer");
    console.log("  decision/proposal/historical cards → atlas-analyst → atlas-reviewer");
    console.log("  architecture cards → atlas-analyst → atlas-reviewer");
    console.log("  reference cards → atlas-analyst → atlas-reviewer");
    console.log("\nAfter all subagents complete, run:");
    console.log("  .ai/atlas/bin/atlas ls --needs-enrichment --json");
    console.log("  .ai/atlas/bin/atlas validate");
    console.log("If needs-enrichment returns [] — bootstrap is complete.");
    // Signal incomplete via exit code only in JSON mode (for programmatic use)
    if (options.json) process.exitCode = 1;
  } else {
    console.log("\n## ✅ All cards enriched — no LLM enrichment needed");
  }

  if (result.written.length > 0 && !options.dryRun) {
    console.log("\n## Next steps — LLM enrichment required");
    console.log("Cards are created with `needs_review` status and `heuristic_match` evidence level.");
    console.log("To promote cards to `current`, dispatch LLM agents (see AGENTS.md):");
    console.log("  1. atlas-extractor — fills card content from code reading");
    console.log("  2. atlas-coder — verifies code evidence, promotes to `code_confirmed`");
    console.log("  3. atlas-reviewer — quality gate, promotes `needs_review` → `current`");
    console.log("Without LLM enrichment, `validate` will reject `heuristic_match` cards as `current`.");
  }
}
