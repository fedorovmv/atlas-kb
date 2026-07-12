import path from "node:path";
import { appendFile, mkdir } from "node:fs/promises";
import type { ReconcileReport } from "./reconcile.js";
import { updateMemoryCard } from "./updateMemory.js";
import { loadMemoryCards, findCardById } from "./loadMemory.js";
import { resolveMemoryRoot } from "./paths.js";
import { today, readFileIfExists } from "./utils.js";
import type { RepoMemoryOptions } from "./types.js";
import type { Claim } from "../schemas/claim.js";
import { checkEvidence } from "./specClassification.js";
import { discoverProject } from "./discoverProject.js";
import type { DiscoveryReport } from "../schemas/discovery.js";

export type AppliedFixes = {
  conflictsAppended: string[];
  openQuestionsAppended: string[];
  proposalCardsUpdated: string[];
  claimsUpdated: string[];
};

export async function applyReconcileFixes(
  report: ReconcileReport,
  options: RepoMemoryOptions = {},
  discovery?: DiscoveryReport,
): Promise<AppliedFixes> {
  const memoryRoot = resolveMemoryRoot(options);
  const todayStr = today();
  const reconciliationDir = path.join(memoryRoot, "reconciliation");
  await mkdir(reconciliationDir, { recursive: true });

  const result: AppliedFixes = {
    conflictsAppended: [],
    openQuestionsAppended: [],
    proposalCardsUpdated: [],
    claimsUpdated: [],
  };

  // ── 1. open-questions.md — stale refs + orphan modules ──────────────────

  const openQuestionsPath = path.join(reconciliationDir, "open-questions.md");
  const existingOpenQ = await readFileIfExists(openQuestionsPath);
  const openQNewLines: string[] = [];

  for (const ref of report.staleRefsDetailed || []) {
    const line = `- [reconcile ${todayStr}] Stale ref: card=${ref.cardId}, path=${ref.refPath}`;
    if (!existingOpenQ.includes(line)) {
      openQNewLines.push(`\n${line}\n`);
      result.openQuestionsAppended.push(ref.cardId);
    }
  }

  for (const modId of report.orphanModules || []) {
    const line = `- [reconcile ${todayStr}] Orphan module: ${modId} — discovery found module without memory card`;
    if (!existingOpenQ.includes(line)) {
      openQNewLines.push(`\n${line}\n`);
      result.openQuestionsAppended.push(modId);
    }
  }

  if (openQNewLines.length > 0) {
    await appendFile(openQuestionsPath, openQNewLines.join(""), "utf8");
  }

  // ── 2. conflicts.md — weak current claims ────────────────────────────────

  const conflictsPath = path.join(reconciliationDir, "conflicts.md");
  const existingConflicts = await readFileIfExists(conflictsPath);
  const conflictNewLines: string[] = [];

  for (const claim of report.weakCurrentClaimsDetailed || []) {
    const line = `- [reconcile ${todayStr}] Weak current evidence: card=${claim.cardId}, evidence_level=${claim.evidenceLevel}`;
    if (!existingConflicts.includes(line)) {
      conflictNewLines.push(`\n${line}\n`);
      result.conflictsAppended.push(claim.cardId);
    }
  }

  if (conflictNewLines.length > 0) {
    await appendFile(conflictsPath, conflictNewLines.join(""), "utf8");
  }

  // ── 3. proposal card updates — stale proposals ───────────────────────────

  const cards = await loadMemoryCards(options);
  const noteMarker = `Stale proposal — flagged by reconcile on ${todayStr}. Evidence insufficient; review required.`;

  for (const proposal of report.staleProposals || []) {
    const card = findCardById(cards, proposal.cardId);
    if (!card) continue;
    // Idempotency: skip if note already present
    if (card.body.includes(noteMarker)) continue;

    const newBody = card.body + `\n\n${noteMarker}\n`;
    await updateMemoryCard(proposal.cardId, {
      ...options,
      fields: { status: "needs_review", last_reviewed: todayStr },
      body: newBody,
    });
    result.proposalCardsUpdated.push(proposal.cardId);
  }

  // ── 4. Claim evidence update — changed claim evidence ──────────────────
  const changedEvidence = report.changedClaimEvidence ?? [];
  if (changedEvidence.length > 0) {
    const discoveryReport = discovery ?? await discoverProject(options);
    // Deduplicate by cardId — multiple claims can share the same card
    const updatedCardIds = new Set<string>();

    for (const change of changedEvidence) {
      if (updatedCardIds.has(change.cardId)) continue; // already updated
      const idx = cards.findIndex((c) => c.meta.id === change.cardId);
      if (idx === -1 || !cards[idx].meta.claims || cards[idx].meta.claims.length === 0) continue;

      const card = cards[idx];
      const freshEvidence = checkEvidence(card.meta.claims as Claim[], discoveryReport);
      const updatedClaims = card.meta.claims.map((sc) => {
        const fresh = freshEvidence.find((e) => e.claim_id === sc.id);
        if (fresh && sc.evidence && fresh.status !== sc.evidence.status) {
          return { ...sc, evidence: { ...fresh, claim_id: sc.id }, last_checked: todayStr };
        }
        return sc;
      });

      await updateMemoryCard(change.cardId, { ...options, fields: { claims: updatedClaims } });
      result.claimsUpdated.push(change.cardId);
      updatedCardIds.add(change.cardId);
    }
  }

  return result;
}
