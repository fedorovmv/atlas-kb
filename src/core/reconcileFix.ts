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
  claimsUpdated: string[];
  relationsFixed: string[];
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
    claimsUpdated: [],
    relationsFixed: [],
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

  const cards = await loadMemoryCards(options);

  // ── 3. Claim evidence update — changed claim evidence ──────────────────
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

  // ── 4. Broken relations — flag & log (non-destructive) ────────────────
  const brokenRelations = report.brokenRelations ?? [];
  if (brokenRelations.length > 0) {
    // Group by cardId to batch the has_broken_relations flag update
    const byCard = new Map<string, { fields: Set<string>; targets: Set<string>; entries: typeof brokenRelations }>();
    for (const br of brokenRelations) {
      if (!byCard.has(br.cardId)) byCard.set(br.cardId, { fields: new Set(), targets: new Set(), entries: [] });
      const cardData = byCard.get(br.cardId)!;
      cardData.fields.add(br.field);
      cardData.targets.add(br.targetId);
      cardData.entries.push(br);
    }

    // Append each broken relation to open-questions.md
    const existingBQ = await readFileIfExists(openQuestionsPath);
    const brNewLines: string[] = [];
    for (const br of brokenRelations) {
      // Idempotency: dedup by content (cardId+field+targetId), not by date — prevents duplicates across daily runs
      const dedupKey = `card=${br.cardId}, field=${br.field}, target=${br.targetId}`;
      const alreadyLogged = existingBQ.includes(`card=${br.cardId}, field=${br.field}, target=${br.targetId}`);
      if (!alreadyLogged) {
        const line = `- [reconcile ${todayStr}] Broken relation: ${dedupKey} (target does not exist)`;
        brNewLines.push(`\n${line}\n`);
        result.openQuestionsAppended.push(br.cardId);
      }
    }

    if (brNewLines.length > 0) {
      await appendFile(openQuestionsPath, brNewLines.join(""), "utf8");
    }

    // Set has_broken_relations flag on affected cards (do NOT delete IDs from frontmatter)
    for (const [cardId] of byCard) {
      const card = findCardById(cards, cardId);
      if (!card) continue;
      // Skip if already flagged (idempotency)
      if (card.meta.has_broken_relations) continue;
      await updateMemoryCard(cardId, { ...options, fields: { has_broken_relations: true } });
      result.relationsFixed.push(cardId);
    }
  }

  return result;
}
