import type { StoredClaim } from "../schemas/claim.js";
import type { MemoryCard } from "./types.js";

const STOPWORDS = new Set([
  "the", "a", "an", "must", "shall", "should", "will", "is", "are", "be",
  "of", "to", "in", "for", "on", "by", "this", "that", "with", "from", "as", "at", "it"
]);

export function canonicalClaimText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")  // replace non-letter/non-digit with spaces
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
    .join(" ")
    .trim();
}

export function dedupClaims(claims: StoredClaim[]): StoredClaim[] {
  const groups = new Map<string, StoredClaim[]>();
  for (const claim of claims) {
    const canon = canonicalClaimText(claim.text);
    if (!groups.has(canon)) groups.set(canon, []);
    groups.get(canon)!.push(claim);
  }

  const result: StoredClaim[] = [];
  for (const group of groups.values()) {
    const first = { ...group[0] };
    // Merge evidence from duplicates
    if (!first.evidence || first.evidence.status === "not_checked") {
      for (const dup of group.slice(1)) {
        if (dup.evidence && dup.evidence.status !== "not_checked") {
          first.evidence = { ...dup.evidence, claim_id: first.id };
          break;
        }
      }
    }
    result.push(first);
  }
  return result;
}

export function findCrossCardDuplicates(cards: MemoryCard[]): {
  cardIdA: string; claimIdA: string; cardIdB: string; claimIdB: string; canonicalText: string
}[] {
  const duplicates: { cardIdA: string; claimIdA: string; cardIdB: string; claimIdB: string; canonicalText: string }[] = [];
  const cardsWithClaims = cards.filter(c => c.meta.claims && c.meta.claims.length > 0);

  for (let i = 0; i < cardsWithClaims.length; i++) {
    for (let j = i + 1; j < cardsWithClaims.length; j++) {
      const cardA = cardsWithClaims[i];
      const cardB = cardsWithClaims[j];
      for (const claimA of cardA.meta.claims!) {
        const canonA = canonicalClaimText(claimA.text);
        for (const claimB of cardB.meta.claims!) {
          const canonB = canonicalClaimText(claimB.text);
          if (canonA === canonB && canonA.length > 0) {
            duplicates.push({
              cardIdA: cardA.meta.id, claimIdA: claimA.id,
              cardIdB: cardB.meta.id, claimIdB: claimB.id,
              canonicalText: canonA,
            });
          }
        }
      }
    }
  }
  return duplicates;
}
