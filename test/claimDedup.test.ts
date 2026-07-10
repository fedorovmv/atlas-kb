import { describe, expect, it } from "vitest";
import type { StoredClaim } from "../src/schemas/claim.js";
import type { MemoryCard } from "../src/core/types.js";
import type { MemoryFrontmatter } from "../src/schemas/frontmatter.js";
import { canonicalClaimText, dedupClaims, findCrossCardDuplicates } from "../src/core/claimDedup.js";

function makeClaim(overrides: Partial<StoredClaim> = {}): StoredClaim {
  return {
    id: "claim-1",
    text: "The Registry MUST filter cards",
    type: "current_behavior",
    evidence_required: true,
    ...overrides,
  };
}

function makeCard(overrides: Partial<MemoryCard> = {}): MemoryCard {
  return {
    path: "/tmp/cards/card.md",
    relativePath: "cards/card.md",
    meta: {
      entity_type: "module",
      id: "card-1",
      title: "Card 1",
      status: "current",
      authority: "source_of_truth",
      evidence_level: "code_confirmed",
      stability: "stable",
      source_confidence: "high",
      last_reviewed: "2026-07-01",
      review_required: false,
      knowledge_types: ["current_behavior"],
      usage_policy: {
        can_answer_current_behavior: true,
        can_generate_code_from: true,
        can_use_as_rationale: true,
      },
    } as MemoryFrontmatter,
    body: "# Card 1\nSome content",
    raw: "---\n...\n---\n\n# Card 1\nSome content",
    ...overrides,
  };
}

describe("canonicalClaimText", () => {
  it("same text different case → equal", () => {
    expect(canonicalClaimText("The Registry MUST filter cards"))
      .toBe(canonicalClaimText("the registry must filter cards."));
  });

  it("different text → not equal", () => {
    expect(canonicalClaimText("The Registry MUST filter cards"))
      .not.toBe(canonicalClaimText("The Registry SHOULD delete cards"));
  });

  it("removes stopwords", () => {
    const result = canonicalClaimText("The registry must filter");
    expect(result).toBe("registry filter");
  });
});

describe("dedupClaims", () => {
  it("3 claims, 2 identical → 2 result, evidence merged", () => {
    const claims: StoredClaim[] = [
      makeClaim({ id: "c1", text: "The Registry MUST filter cards" }),
      makeClaim({ id: "c2", text: "Something completely different" }),
      makeClaim({
        id: "c3",
        text: "the registry must filter cards.",
        evidence: {
          claim_id: "c3",
          status: "confirmed_by_code",
          confidence: "high",
          files: ["src/registry.ts"],
          notes: [],
        },
      }),
    ];

    const result = dedupClaims(claims);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("c1");
    expect(result[0].evidence).toBeDefined();
    expect(result[0].evidence!.status).toBe("confirmed_by_code");
    expect(result[0].evidence!.claim_id).toBe("c1");
    expect(result[1].id).toBe("c2");
  });

  it("3 unique claims → 3 result", () => {
    const claims: StoredClaim[] = [
      makeClaim({ id: "c1", text: "The Registry MUST filter cards" }),
      makeClaim({ id: "c2", text: "The Cache MUST expire old entries" }),
      makeClaim({ id: "c3", text: "The API must return 200" }),
    ];

    const result = dedupClaims(claims);
    expect(result).toHaveLength(3);
  });

  it("all duplicates → 1 result", () => {
    const claims: StoredClaim[] = [
      makeClaim({ id: "c1", text: "The Registry MUST filter cards" }),
      makeClaim({ id: "c2", text: "the registry must filter cards" }),
      makeClaim({ id: "c3", text: "THE REGISTRY MUST FILTER CARDS!!!" }),
    ];

    const result = dedupClaims(claims);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
  });
});

describe("findCrossCardDuplicates", () => {
  it("2 cards with same claim text → 1 entry", () => {
    const cards: MemoryCard[] = [
      makeCard({
        meta: {
          ...makeCard().meta,
          id: "card-a",
          claims: [makeClaim({ id: "c1", text: "The Registry MUST filter cards" })],
        } as MemoryFrontmatter,
      }),
      makeCard({
        meta: {
          ...makeCard().meta,
          id: "card-b",
          claims: [makeClaim({ id: "c2", text: "the registry must filter cards." })],
        } as MemoryFrontmatter,
      }),
    ];

    const dups = findCrossCardDuplicates(cards);
    expect(dups).toHaveLength(1);
    expect(dups[0].cardIdA).toBe("card-a");
    expect(dups[0].claimIdA).toBe("c1");
    expect(dups[0].cardIdB).toBe("card-b");
    expect(dups[0].claimIdB).toBe("c2");
  });

  it("2 cards different claims → empty", () => {
    const cards: MemoryCard[] = [
      makeCard({
        meta: {
          ...makeCard().meta,
          id: "card-a",
          claims: [makeClaim({ id: "c1", text: "The Registry MUST filter cards" })],
        } as MemoryFrontmatter,
      }),
      makeCard({
        meta: {
          ...makeCard().meta,
          id: "card-b",
          claims: [makeClaim({ id: "c2", text: "The Cache SHOULD delete stale entries" })],
        } as MemoryFrontmatter,
      }),
    ];

    const dups = findCrossCardDuplicates(cards);
    expect(dups).toHaveLength(0);
  });

  it("cards without claims → skipped", () => {
    const cards: MemoryCard[] = [
      makeCard(),
      makeCard(),
    ];

    const dups = findCrossCardDuplicates(cards);
    expect(dups).toHaveLength(0);
  });
});
