import { describe, expect, it } from "vitest";
import { MemoryFrontmatterSchema } from "../src/schemas/frontmatter.js";

const baseFrontmatter = {
  entity_type: "module" as const,
  id: "test-module",
  title: "Test Module",
  status: "current" as const,
  authority: "reviewed_memory" as const,
  evidence_level: "code_confirmed" as const,
  stability: "stable" as const,
  source_confidence: "high" as const,
  last_reviewed: "2026-07-09",
  review_required: false,
  knowledge_types: ["current_behavior"] as const,
  usage_policy: {
    can_answer_current_behavior: true,
    can_generate_code_from: true,
    can_use_as_rationale: true,
    can_use_as_example: false,
    requires_code_check_before_change: true,
  },
};

describe("MemoryFrontmatterSchema claims", () => {
  it("parses card without claims field → claims defaults to []", () => {
    const result = MemoryFrontmatterSchema.parse(baseFrontmatter);
    expect(result.claims).toEqual([]);
  });

  it("parses card with claims field → structured claims with evidence", () => {
    const result = MemoryFrontmatterSchema.parse({
      ...baseFrontmatter,
      claims: [
        {
          id: "claim-001",
          text: "Registry filters cards",
          type: "current_behavior",
          evidence_required: true,
          evidence: {
            claim_id: "claim-001",
            status: "confirmed_by_code",
            confidence: "high",
            files: ["internal/registry/access_filter.go"],
            notes: [],
          },
          last_checked: "2026-07-09",
        },
      ],
    });
    expect(result.claims[0].id).toBe("claim-001");
    expect(result.claims[0].evidence.status).toBe("confirmed_by_code");
    expect(result.claims[0].last_checked).toBe("2026-07-09");
  });

  it("rejects invalid claim missing id", () => {
    const invalid = {
      ...baseFrontmatter,
      claims: [
        {
          text: "Bad claim",
          type: "current_behavior",
          evidence_required: true,
        },
      ],
    };
    const result = MemoryFrontmatterSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain("id");
    }
  });
});
