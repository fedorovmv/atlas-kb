import { validateMemory as validate, checkEnrichmentStatus } from "../core/validate.js";
import { loadMemoryCardsBestEffort } from "../core/loadMemory.js";

export async function validateMemoryCommand(options: { root?: string; json?: boolean; strictWarnings?: boolean; requireSourceCoverage?: boolean; checkDispatch?: boolean; checkContract?: boolean; maxErrors?: number } = {}) {
  const result = await validate({
    root: options.root,
    strictWarnings: options.strictWarnings,
    requireSourceCoverage: options.requireSourceCoverage,
    checkDispatch: options.checkDispatch,
    checkContract: options.checkContract,
    maxErrors: options.maxErrors,
  });

  // Enrichment status check
  const cards = await loadMemoryCardsBestEffort({ root: options.root });
  const enrichment = checkEnrichmentStatus(cards);
  if (!enrichment.enriched && cards.length > 0) {
    result.warnings.push(
      `Memory bank not enriched: ${enrichment.needsReviewCount} cards need review, 0 current. ` +
      `Dispatch LLM agents (see AGENTS.md): memory-extractor → memory-coder → memory-reviewer. ` +
      `${enrichment.heuristicCount} cards have heuristic_match evidence — require memory-coder to promote to code_confirmed.`
    );
  }

  const ok = result.ok && (!options.strictWarnings || result.warnings.length === 0);

  if (options.json) {
    console.log(JSON.stringify({ ...result, ok }, null, 2));
  } else {
    if (ok) {
      console.log("Memory validation OK");
    }
    if (result.errors.length) {
      console.log("\n# Errors");
      for (const error of result.errors) console.log(`- ${error}`);
    }
    if (result.warnings.length) {
      console.log("\n# Warnings");
      for (const warning of result.warnings) console.log(`- ${warning}`);
    }
  }

  if (!ok) process.exitCode = 1;
}
