import type { StoredClaim } from "../schemas/claim.js";
import type { MemoryCard } from "./types.js";
import { canonicalClaimText } from "./claimDedup.js";

export function linkClaimsToCards(
  claims: StoredClaim[],
  cards: MemoryCard[]
): StoredClaim[] {
  return claims.map((claim) => {
    const result = { ...claim };
    const claimCanon = canonicalClaimText(claim.text);

    for (const type of ["module", "scenario", "decision"] as const) {
      const candidates = cards.filter((c) => c.meta.entity_type === type);
      let bestId: string | null = null;
      let bestScore = 0;

      for (const card of candidates) {
        let score = 0;
        // source_path match
        if (claim.source_path) {
          for (const ref of card.meta.source_refs ?? []) {
            if (ref.path === claim.source_path) { score += 3; break; }
          }
        }
        // title canonical match
        const titleCanon = canonicalClaimText(card.meta.title);
        if (titleCanon.length > 0 && claimCanon.includes(titleCanon)) score += 2;
        // aliases match
        for (const alias of card.meta.aliases ?? []) {
          const aliasCanon = canonicalClaimText(alias);
          if (aliasCanon.length > 0 && claimCanon.includes(aliasCanon)) { score += 1; break; }
        }
        // id in claim text
        if (claim.text.toLowerCase().includes(card.meta.id.toLowerCase())) score += 1;

        if (score > bestScore) { bestScore = score; bestId = card.meta.id; }
      }

      if (bestScore >= 2 && bestId) {
        if (type === "module") result.module = bestId;
        else if (type === "scenario") result.scenario = bestId;
        else if (type === "decision") result.decision = bestId;
      }
    }
    return result;
  });
}
