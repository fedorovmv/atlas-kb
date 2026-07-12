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
    const claimTokens = new Set(claimCanon.split(/\s+/).filter((t) => t.length >= 3));

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

        // product_areas token overlap
        for (const area of card.meta.product_areas ?? []) {
          const areaCanon = canonicalClaimText(area);
          if (areaCanon.length > 0 && claimCanon.includes(areaCanon)) { score += 1; break; }
        }

        // code_refs overlap — claim references same code file as card
        if (claim.source_path) {
          const claimBasename = claim.source_path.split("/").pop()?.replace(/\.\w+$/, "").toLowerCase() ?? "";
          for (const ref of card.meta.code_refs ?? []) {
            const refBasename = ref.path.split("/").pop()?.replace(/\.\w+$/, "").toLowerCase() ?? "";
            if (claimBasename && refBasename && (claimBasename.includes(refBasename) || refBasename.includes(claimBasename))) {
              score += 1;
              break;
            }
          }
        }

        // product_areas token set overlap (fallback: claim tokens vs area tokens)
        if (score === 0) {
          const areaTokens = new Set((card.meta.product_areas ?? []).flatMap((a) => canonicalClaimText(a).split(/\s+/).filter((t) => t.length >= 3)));
          const overlap = [...claimTokens].filter((t) => areaTokens.has(t)).length;
          if (overlap >= 2) score += 1;
        }

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
