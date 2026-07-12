import { reconcileMemory } from "../core/reconcile.js";
import { applyReconcileFixes } from "../core/reconcileFix.js";
import { discoverProject } from "../core/discoverProject.js";
import type { AppliedFixes } from "../core/reconcileFix.js";
import type { RepoMemoryOptions } from "../core/types.js";

export async function reconcileMemoryCommand(options: RepoMemoryOptions & { json?: boolean; fix?: boolean } = {}) {
  const discovery = await discoverProject(options);
  const report = await reconcileMemory(options, discovery);

  let appliedFixes: AppliedFixes | undefined;
  if (options.fix) {
    appliedFixes = await applyReconcileFixes(report, options, discovery);
  }

  if (options.json) {
    const output = { ...report };
    if (appliedFixes !== undefined) {
      Object.assign(output, { appliedFixes });
    }
    console.log(JSON.stringify(output, null, 2));
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
  console.log(`\n## Duplicate claims (${report.duplicateClaims?.length ?? 0})`);
  if (report.duplicateClaims?.length) for (const d of report.duplicateClaims) console.log(`- ${d.cardIdA}/${d.claimIdA} == ${d.cardIdB}/${d.claimIdB}: "${d.canonicalText.slice(0, 50)}"`); else console.log("- none");
  console.log(`\n## Broken claim links (${report.brokenClaimLinks?.length ?? 0})`);
  if (report.brokenClaimLinks?.length) for (const l of report.brokenClaimLinks) console.log(`- ${l.cardId}/${l.claimId} ${l.field} → ${l.targetId}`); else console.log("- none");

  if (appliedFixes !== undefined) {
    const total = appliedFixes.conflictsAppended.length + appliedFixes.openQuestionsAppended.length + appliedFixes.proposalCardsUpdated.length;
    console.log(`\n## Applied fixes (${total})`);
    console.log(`- conflicts: ${appliedFixes.conflictsAppended.length}`);
    console.log(`- open-questions: ${appliedFixes.openQuestionsAppended.length}`);
    console.log(`- proposals updated: ${appliedFixes.proposalCardsUpdated.length}`);
  }
}
