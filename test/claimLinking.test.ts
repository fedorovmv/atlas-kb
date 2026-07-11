import { describe, expect, it } from "vitest";
import type { StoredClaim } from "../src/schemas/claim.js";
import type { MemoryCard } from "../src/core/types.js";
import type { MemoryFrontmatter } from "../src/schemas/frontmatter.js";
import { linkClaimsToCards } from "../src/core/claimLinking.js";

function makeClaim(overrides: Partial<StoredClaim> = {}): StoredClaim {
  return {
    id: "claim-1",
    text: "The Registry MUST filter cards",
    type: "current_behavior",
    evidence_required: true,
    ...overrides,
  };
}

const baseMeta = {
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
  product_areas: [],
  aliases: [],
  related_modules: [],
  related_scenarios: [],
  related_decisions: [],
  related_specs: [],
  related_tests: [],
  conflicts_with: [],
  supersedes: [],
  superseded_by: [],
  affects_modules: [],
  affects_scenarios: [],
  affects_decisions: [],
  code_refs: [],
  test_refs: [],
  source_refs: [],
  usage_policy: {
    can_answer_current_behavior: true,
    can_generate_code_from: true,
    can_use_as_rationale: true,
    can_use_as_example: false,
    requires_code_check_before_change: false,
    requires_warning: false,
  },
  claims: [],
} satisfies MemoryFrontmatter;

function makeCard(overrides: Partial<MemoryCard> = {}): MemoryCard {
  return {
    path: "/tmp/cards/card.md",
    relativePath: "cards/card.md",
    meta: baseMeta as MemoryFrontmatter,
    body: "# Card 1\nSome content",
    raw: "---\n...\n---\n\n# Card 1\nSome content",
    ...overrides,
  };
}

function makeMeta(overrides: Partial<MemoryFrontmatter> = {}): MemoryFrontmatter {
  return { ...baseMeta, ...overrides } as MemoryFrontmatter;
}

describe("linkClaimsToCards", () => {
  it("links claim to module by title match", () => {
    const claims: StoredClaim[] = [
      makeClaim({ text: "Registry filters cards by caller identity" }),
    ];
    const cards: MemoryCard[] = [
      makeCard({
        meta: makeMeta({
          entity_type: "module",
          id: "agent-tool-registry",
          title: "Registry",
        }),
      }),
    ];

    const result = linkClaimsToCards(claims, cards);
    expect(result[0].module).toBe("agent-tool-registry");
  });

  it("links claim to module by source_path match", () => {
    const claims: StoredClaim[] = [
      makeClaim({
        id: "c-srcpath",
        text: "The spec defines new registry behavior",
        source_path: "specs/2027.md",
      }),
    ];
    const cards: MemoryCard[] = [
      makeCard({
        meta: makeMeta({
          entity_type: "module",
          id: "module-specs",
          title: "Something Unrelated",
          source_refs: [{ path: "specs/2027.md", role: "current_doc" }],
        }),
      }),
    ];

    const result = linkClaimsToCards(claims, cards);
    expect(result[0].module).toBe("module-specs");
  });

  it("links claim to decision by title", () => {
    const claims: StoredClaim[] = [
      makeClaim({ text: "The registry discovery not orchestration approach handles routing" }),
    ];
    const cards: MemoryCard[] = [
      makeCard({
        meta: makeMeta({
          entity_type: "decision",
          id: "decision-discovery",
          title: "Registry is discovery not orchestration",
        }),
      }),
    ];

    const result = linkClaimsToCards(claims, cards);
    expect(result[0].decision).toBe("decision-discovery");
  });

  it("no link when no match", () => {
    const claims: StoredClaim[] = [
      makeClaim({ text: "Quantum computing is the future" }),
    ];
    const cards: MemoryCard[] = [
      makeCard({
        meta: makeMeta({
          entity_type: "module",
          id: "agent-tool-registry",
          title: "Agent & Tool Registry",
        }),
      }),
    ];

    const result = linkClaimsToCards(claims, cards);
    expect(result[0].module).toBeUndefined();
    expect(result[0].scenario).toBeUndefined();
    expect(result[0].decision).toBeUndefined();
  });

  it("links multiple types", () => {
    const claims: StoredClaim[] = [
      makeClaim({ text: "Registry authentication flow scenario" }),
    ];
    const cards: MemoryCard[] = [
      makeCard({
        meta: makeMeta({
          entity_type: "module",
          id: "reg-module",
          title: "Registry",
        }),
      }),
      makeCard({
        meta: makeMeta({
          entity_type: "scenario",
          id: "auth-flow",
          title: "Authentication Flow",
        }),
      }),
    ];

    const result = linkClaimsToCards(claims, cards);
    expect(result[0].module).toBe("reg-module");
    expect(result[0].scenario).toBe("auth-flow");
  });

  it("no link when score < 2", () => {
    // Only id in text gives score 1, which is below threshold of 2
    const claims: StoredClaim[] = [
      makeClaim({ text: "Something about the reg-module component" }),
    ];
    const cards: MemoryCard[] = [
      makeCard({
        meta: makeMeta({
          entity_type: "module",
          id: "reg-module",
          title: "Completely Different Name",
        }),
      }),
    ];

    const result = linkClaimsToCards(claims, cards);
    expect(result[0].module).toBeUndefined();
  });
});
