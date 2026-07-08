import { reconcileMemory } from "../core/reconcile.js";
import type { RepoMemoryOptions } from "../core/types.js";

export async function reconcileMemoryCommand(options: RepoMemoryOptions & { json?: boolean } = {}) {
  const report = await reconcileMemory(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log("# Memory reconciliation report");
  console.log(`\n## Stale references (${report.staleRefs.length})`);
  if (report.staleRefs.length) for (const r of report.staleRefs) console.log(`- ${r}`); else console.log("- none");
  console.log(`\n## Weak current claims (${report.weakCurrentClaims.length})`);
  if (report.weakCurrentClaims.length) for (const c of report.weakCurrentClaims) console.log(`- ${c}`); else console.log("- none");
  console.log(`\n## Realizable proposals (${report.realizableProposals.length})`);
  if (report.realizableProposals.length) for (const p of report.realizableProposals) console.log(`- ${p}`); else console.log("- none");
  console.log(`\n## Orphan modules (${report.orphanModules.length})`);
  if (report.orphanModules.length) for (const m of report.orphanModules) console.log(`- ${m}`); else console.log("- none");
}
