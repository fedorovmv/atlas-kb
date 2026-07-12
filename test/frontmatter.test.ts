import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MemoryFrontmatterSchema, EntityTypeSchema, RuntimeTierSchema, SourceStatusSchema } from "../src/schemas/frontmatter.js";

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

describe("EntityTypeSchema validates all 20 values", () => {
  const allEntityTypes = [
    // existing 11
    "module", "scenario", "decision", "proposal", "historical",
    "conflict", "open_question", "architecture", "product_map",
    "ontology", "readme",
    // new 9
    "flow", "ops", "gotchas", "task_routing", "testing",
    "reference", "project", "routing", "index",
  ];

  it("validates all 20 entity type values", () => {
    for (const type of allEntityTypes) {
      const result = EntityTypeSchema.safeParse(type);
      expect(result.success, `entity_type "${type}" should be valid`).toBe(true);
      if (result.success) {
        expect(result.data).toBe(type);
      }
    }
  });

  it("rejects invalid entity type", () => {
    const result = EntityTypeSchema.safeParse("invalid_type");
    expect(result.success).toBe(false);
  });
});

describe("RuntimeTierSchema", () => {
  const validTiers = ["production", "demo", "shared", "mixed", "historical", "unknown"];

  it("validates all valid runtime tier values", () => {
    for (const tier of validTiers) {
      const result = RuntimeTierSchema.safeParse(tier);
      expect(result.success, `runtime_tier "${tier}" should be valid`).toBe(true);
    }
  });

  it("rejects invalid runtime tier", () => {
    const result = RuntimeTierSchema.safeParse("invalid_tier");
    expect(result.success).toBe(false);
  });
});

describe("SourceStatusSchema", () => {
  const validStatuses = ["current", "active-rationale", "partially-active", "superseded", "historical-only", "unknown"];

  it("validates all valid source status values", () => {
    for (const status of validStatuses) {
      const result = SourceStatusSchema.safeParse(status);
      expect(result.success, `source_status "${status}" should be valid`).toBe(true);
    }
  });

  it("rejects invalid source status", () => {
    const result = SourceStatusSchema.safeParse("invalid_status");
    expect(result.success).toBe(false);
  });
});

describe("MemoryFrontmatterSchema with runtime_tier", () => {
  it("parses card with runtime_tier valid → ok", () => {
    const result = MemoryFrontmatterSchema.parse({
      ...baseFrontmatter,
      runtime_tier: "production",
    });
    expect(result.runtime_tier).toBe("production");
  });

  it("parses card with runtime_tier invalid → ZodError", () => {
    const result = MemoryFrontmatterSchema.safeParse({
      ...baseFrontmatter,
      runtime_tier: "invalid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(z.ZodError);
    }
  });

  it("parses card without runtime_tier → ok (optional)", () => {
    const result = MemoryFrontmatterSchema.parse(baseFrontmatter);
    expect(result.runtime_tier).toBeUndefined();
  });

  it("parses card with source_status valid → ok", () => {
    const result = MemoryFrontmatterSchema.parse({
      ...baseFrontmatter,
      source_status: "current",
    });
    expect(result.source_status).toBe("current");
  });

  it("parses card without source_status → ok (optional)", () => {
    const result = MemoryFrontmatterSchema.parse(baseFrontmatter);
    expect(result.source_status).toBeUndefined();
  });

  it("parses card with source_status invalid → ZodError", () => {
    const result = MemoryFrontmatterSchema.safeParse({
      ...baseFrontmatter,
      source_status: "invalid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(z.ZodError);
    }
  });

  it("parses card with both runtime_tier and source_status → ok", () => {
    const result = MemoryFrontmatterSchema.parse({
      ...baseFrontmatter,
      runtime_tier: "production",
      source_status: "active-rationale",
    });
    expect(result.runtime_tier).toBe("production");
    expect(result.source_status).toBe("active-rationale");
  });
});
