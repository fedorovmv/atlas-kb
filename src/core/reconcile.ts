import path from "node:path";
import { existsSync } from "node:fs";
import { loadMemoryCards } from "./loadMemory.js";
import { discoverProject } from "./discoverProject.js";
import { resolveRoot } from "./paths.js";
import type { RepoMemoryOptions } from "./types.js";
import type { Claim } from "../schemas/claim.js";
import { checkEvidence } from "./specClassification.js";

export type ReconcileReport = {
  staleRefs: string[];
  weakCurrentClaims: string[];
  realizableProposals: string[];
  orphanModules: string[];
  staleRefsDetailed?: { cardId: string; refPath: string }[];
  weakCurrentClaimsDetailed?: { cardId: string; evidenceLevel: string }[];
  realizableProposalsDetailed?: { cardId: string }[];
  staleProposals?: { cardId: string; lastReviewed: string; daysSinceReview: number }[];
  changedClaimEvidence?: { cardId: string; claimId: string; oldStatus: string; newStatus: string }[];
};

export async function reconcileMemory(options: RepoMemoryOptions = {}): Promise<ReconcileReport> {
  const root = resolveRoot(options);
  const staleProposalDays = options.staleProposalDays ?? 90;
  const cards = await loadMemoryCards(options);
  const discovery = await discoverProject(options);
  const discoveredPaths = new Set(discovery.files.map((f) => f.path));

  const staleRefs: string[] = [];
  const weakCurrentClaims: string[] = [];
  const realizableProposals: string[] = [];
  const orphanModules: string[] = [];
  const staleRefsDetailed: { cardId: string; refPath: string }[] = [];
  const weakCurrentClaimsDetailed: { cardId: string; evidenceLevel: string }[] = [];
  const realizableProposalsDetailed: { cardId: string }[] = [];
  const staleProposals: { cardId: string; lastReviewed: string; daysSinceReview: number }[] = [];
  const changedClaimEvidence: { cardId: string; claimId: string; oldStatus: string; newStatus: string }[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const card of cards) {
    for (const ref of [...card.meta.code_refs, ...card.meta.test_refs]) {
      if (ref.path.includes("*")) continue;
      const resolved = path.resolve(root, ref.path);
      if (!existsSync(resolved) && !discoveredPaths.has(ref.path)) {
        staleRefs.push(`${card.meta.id}: ${ref.path}`);
        staleRefsDetailed.push({ cardId: card.meta.id, refPath: ref.path });
      }
    }
    if (card.meta.status === "current" && ["spec_only", "inferred", "unknown"].includes(card.meta.evidence_level)) {
      weakCurrentClaims.push(`${card.meta.id}: ${card.meta.evidence_level}`);
      weakCurrentClaimsDetailed.push({ cardId: card.meta.id, evidenceLevel: card.meta.evidence_level });
    }
    if (card.meta.entity_type === "proposal") {
      const codeMatch = discovery.files.some((f) => f.kind === "code" && card.body.toLowerCase().includes(f.basename.toLowerCase().replace(/\.\w+$/, "")));
      if (codeMatch) {
        realizableProposals.push(card.meta.id);
        realizableProposalsDetailed.push({ cardId: card.meta.id });
      }
      // Stale proposal detection
      if (["spec_only", "inferred", "unknown"].includes(card.meta.evidence_level)) {
        const lastReviewedDate = parseDate(card.meta.last_reviewed);
        if (lastReviewedDate) {
          const diffMs = today.getTime() - lastReviewedDate.getTime();
          const daysSinceReview = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (daysSinceReview > staleProposalDays) {
            staleProposals.push({ cardId: card.meta.id, lastReviewed: card.meta.last_reviewed, daysSinceReview });
          }
        }
      }
    }
    // Claim evidence re-check
    if (card.meta.claims && card.meta.claims.length > 0) {
      const freshEvidence = checkEvidence(card.meta.claims as Claim[], discovery);
      for (let i = 0; i < card.meta.claims.length; i++) {
        const stored = card.meta.claims[i];
        const fresh = freshEvidence.find((e) => e.claim_id === stored.id);
        if (fresh && stored.evidence && fresh.status !== stored.evidence.status) {
          changedClaimEvidence.push({
            cardId: card.meta.id,
            claimId: stored.id,
            oldStatus: stored.evidence.status,
            newStatus: fresh.status,
          });
        }
      }
    }
  }

  const moduleIds = new Set(cards.filter((c) => c.meta.entity_type === "module").map((c) => c.meta.id));
  for (const mod of discovery.candidateModules) {
    if (mod.confidence !== "low") {
      const modSuffix = mod.id.split("-").pop() ?? mod.id;
      const hasCard = [...moduleIds].some((id) => id.includes(modSuffix) || mod.id.includes(id.split("-").pop() ?? id));
      if (!hasCard) orphanModules.push(mod.id);
    }
  }

  return { staleRefs, weakCurrentClaims, realizableProposals, orphanModules, staleRefsDetailed, weakCurrentClaimsDetailed, realizableProposalsDetailed, staleProposals, changedClaimEvidence };
}

function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  d.setHours(0, 0, 0, 0);
  // Validate the date parsed correctly (handles invalid dates like Feb 30)
  if (d.getFullYear() !== Number(year) || d.getMonth() !== Number(month) - 1 || d.getDate() !== Number(day)) {
    return null;
  }
  return d;
}
