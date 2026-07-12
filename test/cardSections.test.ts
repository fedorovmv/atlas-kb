import { describe, expect, it } from "vitest";
import { extractCardSections, validateCardSections } from "../src/core/cardSections.js";
import type { MemoryCard } from "../src/core/types.js";

function makeCard(meta: Partial<MemoryCard["meta"]>, body: string): MemoryCard {
  return {
    path: "/tmp/test.md",
    relativePath: "test.md",
    meta: {
      entity_type: "module",
      id: "test-card",
      title: "Test Card",
      status: "current",
      authority: "reviewed_memory",
      evidence_level: "reviewed_doc",
      stability: "stable",
      source_confidence: "high",
      last_reviewed: "2026-07-08",
      review_required: false,
      knowledge_types: ["current_behavior"],
      usage_policy: {
        can_answer_current_behavior: true,
        can_generate_code_from: true,
        can_use_as_rationale: true,
        requires_code_check_before_change: true,
      },
      ...meta,
    } as MemoryCard["meta"],
    body,
    raw: "",
  };
}

describe("extractCardSections", () => {
  it("parses H2 headings", () => {
    const body = "# Title\n\n## Section One\n\ncontent\n\n## Section Two\n\nmore content";
    const sections = extractCardSections(body);
    expect(sections).toContain("## Section One");
    expect(sections).toContain("## Section Two");
    expect(sections.length).toBe(2);
  });

  it("ignores H3, H1, and H4 headings", () => {
    const body = "# H1\n## H2 Only\n### H3\n#### H4";
    const sections = extractCardSections(body);
    expect(sections).toEqual(["## H2 Only"]);
  });

  it("ignores ## inside code blocks", () => {
    const body = "```\n## Fake Section\n```\n## Real Section";
    const sections = extractCardSections(body);
    expect(sections).toEqual(["## Real Section"]);
  });

  it("handles indented H2 headings", () => {
    const body = "  ## Indented Section";
    const sections = extractCardSections(body);
    expect(sections).toContain("## Indented Section");
  });

  it("returns empty array for body with no H2 headings", () => {
    const sections = extractCardSections("# No H2 here\n### Only H3");
    expect(sections).toEqual([]);
  });
});

describe("validateCardSections", () => {
  it("module without required sections → missingRequired non-empty", () => {
    const card = makeCard({ entity_type: "module", id: "empty-module" }, "# Empty Module\n\nNo sections.");
    const result = validateCardSections(card);
    expect(result.ok).toBe(false);
    expect(result.missingRequired.length).toBeGreaterThan(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("missing required section");
  });

  it("module with all required sections → ok=true", () => {
    const requiredSections = [
      "## Responsibilities",
      "## Non-responsibilities",
      "## Current behavior",
      "## Related scenarios",
      "## Related decisions",
      "## Code references",
      "## Test references",
      "## Known risks",
      "## Open questions",
      "## Why these boundaries",
    ];
    const body = "# Full Module\n\n" + requiredSections.map((s) => `${s}\n\ncontent`).join("\n");
    const card = makeCard({ entity_type: "module", id: "full-module" }, body);
    const result = validateCardSections(card);
    expect(result.ok).toBe(true);
    expect(result.missingRequired).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("index (no contract) → ok=true, empty arrays", () => {
    const card = makeCard({ entity_type: "index", id: "test-index" }, "# Index\n\ncontent");
    const result = validateCardSections(card);
    expect(result.ok).toBe(true);
    expect(result.missingRequired).toEqual([]);
    expect(result.missingRecommended).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("decision without Rationale → error contains '## Rationale'", () => {
    const body = "# Decision\n\n## Context\n\nSome context\n## Problem\n\nProblem here";
    const card = makeCard({ entity_type: "decision", id: "test-decision" }, body);
    const result = validateCardSections(card);
    expect(result.ok).toBe(false);
    const rationaleErrors = result.errors.filter((e) => e.includes("## Rationale"));
    expect(rationaleErrors.length).toBeGreaterThan(0);
  });

  it("module without recommended sections → warning, ok=true", () => {
    const requiredSections = [
      "## Responsibilities",
      "## Non-responsibilities",
      "## Current behavior",
      "## Related scenarios",
      "## Related decisions",
      "## Code references",
      "## Test references",
      "## Known risks",
      "## Open questions",
      "## Why these boundaries",
    ];
    const body = "# Partial Module\n\n" + requiredSections.map((s) => `${s}\n\ncontent`).join("\n");
    const card = makeCard({ entity_type: "module", id: "partial-module" }, body);
    const result = validateCardSections(card);
    expect(result.ok).toBe(true);
    expect(result.missingRecommended.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
