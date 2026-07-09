import path from "node:path";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import type { ReconcileReport } from "./reconcile.js";
import { updateMemoryCard } from "./updateMemory.js";
import { loadMemoryCards, findCardById } from "./loadMemory.js";
import { resolveMemoryRoot } from "./paths.js";
import type { RepoMemoryOptions } from "./types.js";

export type AppliedFixes = {
  conflictsAppended: string[];
  openQuestionsAppended: string[];
  proposalCardsUpdated: string[];
};

export async function applyReconcileFixes(
  report: ReconcileReport,
  options: RepoMemoryOptions = {}
): Promise<AppliedFixes> {
  const memoryRoot = resolveMemoryRoot(options);
  const today = new Date().toISOString().slice(0, 10);
  const reconciliationDir = path.join(memoryRoot, "reconciliation");
  await mkdir(reconciliationDir, { recursive: true });

  const result: AppliedFixes = {
    conflictsAppended: [],
    openQuestionsAppended: [],
    proposalCardsUpdated: [],
  };

  // ── 1. open-questions.md — stale refs + orphan modules ──────────────────

  const openQuestionsPath = path.join(reconciliationDir, "open-questions.md");
  const existingOpenQ = await readFileIfExists(openQuestionsPath);
  const openQNewLines: string[] = [];

  for (const ref of report.staleRefsDetailed || []) {
    const line = `- [reconcile ${today}] Stale ref: card=${ref.cardId}, path=${ref.refPath}`;
    if (!existingOpenQ.includes(line)) {
      openQNewLines.push(`\n${line}\n`);
      result.openQuestionsAppended.push(ref.cardId);
    }
  }

  for (const modId of report.orphanModules || []) {
    const line = `- [reconcile ${today}] Orphan module: ${modId} — discovery found module without memory card`;
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
    const line = `- [reconcile ${today}] Weak current evidence: card=${claim.cardId}, evidence_level=${claim.evidenceLevel}`;
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
  const noteMarker = `Stale proposal — flagged by reconcile on ${today}. Evidence insufficient; review required.`;

  for (const proposal of report.staleProposals || []) {
    const card = findCardById(cards, proposal.cardId);
    if (!card) continue;
    // Idempotency: skip if note already present
    if (card.body.includes(noteMarker)) continue;

    const newBody = card.body + `\n\n${noteMarker}\n`;
    await updateMemoryCard(proposal.cardId, {
      ...options,
      fields: { status: "needs_review", last_reviewed: today },
      body: newBody,
    });
    result.proposalCardsUpdated.push(proposal.cardId);
  }

  return result;
}

async function readFileIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}
