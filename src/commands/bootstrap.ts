import { bootstrapMemory } from "../core/bootstrapMemory.js";
import type { RepoMemoryOptions } from "../core/types.js";

export async function bootstrapMemoryCommand(options: RepoMemoryOptions & { force?: boolean; dryRun?: boolean; json?: boolean } = {}) {
  const result = await bootstrapMemory(options);
  if (options.json) {
    console.log(JSON.stringify({ written: result.written, skipped: result.skipped, moduleCount: result.report.candidateModules.length }, null, 2));
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

  if (result.written.length > 0 && !options.dryRun) {
    console.log("\n## Next steps — LLM enrichment required");
    console.log("Cards are created with `needs_review` status and `heuristic_match` evidence level.");
    console.log("To promote cards to `current`, dispatch LLM agents (see AGENTS.md):");
    console.log("  1. memory-extractor — fills card content from code reading");
    console.log("  2. memory-coder — verifies code evidence, promotes to `code_confirmed`");
    console.log("  3. memory-reviewer — quality gate, promotes `needs_review` → `current`");
    console.log("Without LLM enrichment, `validate` will reject `heuristic_match` cards as `current`.");
  }
}
