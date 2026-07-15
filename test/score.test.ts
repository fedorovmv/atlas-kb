import { describe, expect, it } from "vitest";
import { cardHaystack, scoreCard } from "../src/core/score.js";
import type { MemoryCard } from "../src/core/types.js";

function makeCard(overrides: { meta?: Record<string, unknown>, body?: string } = {}): MemoryCard {
  const meta = {
    id: "test-card",
    title: "Test Card",
    entity_type: "module" as const,
    status: "current" as const,
    authority: "reviewed_memory" as const,
    evidence_level: "reviewed_doc" as const,
    stability: "stable" as const,
    knowledge_types: ["design_rationale"],
    product_areas: [],
    aliases: [],
    related_modules: [],
    related_scenarios: [],
    related_decisions: [],
    affects_modules: [],
    affects_scenarios: [],
    affects_decisions: [],
    code_refs: [],
    test_refs: [],
    source_confidence: "medium" as const,
    last_reviewed: "2026-07-15",
    review_required: false,
    ...overrides.meta,
  };
  return {
    path: "/tmp/test-card.md",
    relativePath: "test-card.md",
    meta: meta as typeof meta,
    body: overrides.body ?? "Some body content for the test card.",
    raw: "---\n...\n---\nSome body content for the test card.",
  } as MemoryCard;
}

describe("cardHaystack", () => {
  it("includes agent_summary text when present", () => {
    const card = makeCard({
      meta: { agent_summary: "Agent facing summary text" },
    });
    const haystack = cardHaystack(card);
    expect(haystack).toContain("agent facing summary text");
  });

  it("does not contain literal 'undefined' when agent_summary is missing", () => {
    const card = makeCard();
    const haystack = cardHaystack(card);
    expect(haystack).not.toContain("undefined");
  });

  it("produces same haystack for a card without agent_summary as baseline fields", () => {
    const card = makeCard();
    const haystack = cardHaystack(card);
    expect(haystack).toContain("test-card");
    expect(haystack).toContain("test card");
    expect(haystack).toContain("design_rationale");
    expect(haystack).toContain("some body content");
  });
});

describe("scoreCard", () => {
  it("scores > 0 when query matches only agent_summary words", () => {
    const card = makeCard({
      meta: { agent_summary: "Unique agent summary keyword" },
    });
    const score = scoreCard(card, "unique keyword");
    expect(score).toBeGreaterThan(0);
  });

  it("scores higher when agent_summary matches than when it doesn't for same query", () => {
    const cardWithSummary = makeCard({
      meta: { agent_summary: "Unique agent summary keyword" },
    });
    const cardWithoutSummary = makeCard();
    const scoreWith = scoreCard(cardWithSummary, "unique keyword");
    const scoreWithout = scoreCard(cardWithoutSummary, "unique keyword");
    expect(scoreWith).toBeGreaterThan(scoreWithout);
  });
});
