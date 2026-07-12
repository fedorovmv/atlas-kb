import { describe, it, expect } from "vitest";
import { extractByCategory, writeDecisionCard, writeFlowCard, CATEGORY_KEYWORDS } from "../src/core/semanticRepair.js";
import type { ExtractedSentence } from "../src/schemas/semanticRepair.js";
import type { MemoryCard } from "../src/core/types.js";

function makeSentence(text: string, score = 10): ExtractedSentence {
  return { text, score, sourcePath: "test.md" };
}

function makeCard(overrides: Partial<MemoryCard> = {}): MemoryCard {
  return {
    path: "/tmp/test.md",
    relativePath: ".ai/memory/test.md",
    meta: {
      entity_type: "decision",
      id: "test",
      title: "Test Card",
      status: "current",
      authority: "reviewed_memory",
      evidence_level: "code_confirmed",
      stability: "stable",
      source_confidence: "high",
      last_reviewed: "2026-07-12",
      review_required: false,
      knowledge_types: ["current_behavior"],
      usage_policy: { can_answer_current_behavior: true, can_generate_code_from: false, can_use_as_rationale: true, requires_code_check_before_change: true },
      code_refs: [], test_refs: [], source_refs: [],
    } as MemoryCard["meta"],
    body: "",
    raw: "",
    ...overrides,
  };
}

describe("extractByCategory", () => {
  it("decision keywords → decision category", () => {
    const sentences = [makeSentence("The decision was made to use OAuth2.")];
    const result = extractByCategory(sentences, "decision");
    expect(result.length).toBe(1);
    expect(result[0].category).toBe("decision");
  });

  it("rationale keywords → rationale category", () => {
    const sentences = [makeSentence("The rationale for this approach is performance.")];
    const result = extractByCategory(sentences, "rationale");
    expect(result.length).toBe(1);
    expect(result[0].category).toBe("rationale");
  });

  it("no keyword matches → empty array", () => {
    const sentences = [makeSentence("This is a generic sentence with no category keywords.")];
    const result = extractByCategory(sentences, "decision");
    expect(result.length).toBe(0);
  });
});

describe("writeDecisionCard", () => {
  it("fills sections with category-matched content", () => {
    const card = makeCard();
    const extracted = [
      makeSentence("The mechanism chosen was OAuth2 for authentication flow."),
      makeSentence("The rationale is security and standard compliance."),
      makeSentence("An alternative was basic auth, but it was rejected."),
      makeSentence("The consequence is added complexity but better security."),
    ];
    const body = writeDecisionCard(card, extracted);
    expect(body).toContain("## Context");
    expect(body).toContain("## Rationale");
    expect(body).toContain("OAuth2");
    expect(body).toContain("security");
  });

  it("falls back to placeholder when no extracted content", () => {
    const card = makeCard();
    const body = writeDecisionCard(card, []);
    expect(body).toContain("Needs review");
  });
});

describe("writeFlowCard", () => {
  it("fills sequence and fallback with flow content", () => {
    const card = makeCard({ meta: { ...makeCard().meta, entity_type: "flow", id: "test-flow", title: "Test Flow" } as MemoryCard["meta"] });
    const extracted = [
      makeSentence("The sequence of steps begins with user login then token validation."),
      makeSentence("The fallback is to redirect to login page on failure."),
    ];
    const body = writeFlowCard(card, extracted);
    expect(body).toContain("## Sequence");
    expect(body).toContain("## Fallback");
    expect(body).toContain("token validation");
  });
});