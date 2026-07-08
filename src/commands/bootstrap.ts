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
}
