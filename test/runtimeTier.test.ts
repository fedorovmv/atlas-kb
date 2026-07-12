import { describe, it, expect } from "vitest";
import { classifyRuntimeTier, checkRuntimeTierMismatch } from "../src/core/runtimeTier.js";
import type { MemoryCard } from "../src/core/types.js";

function makeCard(overrides: Partial<MemoryCard>["meta"] = {}): MemoryCard {
  return {
    path: "/tmp/.ai/memory/modules/test.md",
    relativePath: ".ai/memory/modules/test.md",
    meta: {
      entity_type: "module",
      id: "test",
      title: "Test",
      status: "current",
      authority: "reviewed_memory",
      evidence_level: "code_confirmed",
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
      code_refs: [],
      test_refs: [],
      source_refs: [],
      runtime_tier: undefined,
      source_status: undefined,
      claims: [],
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
      ...overrides,
    },
    body: "# Test\n",
    raw: "---\n...\n---\n# Test\n",
  };
}

const discovery: FileRecord[] = [];

function classify(overrides: Partial<MemoryCard>["meta"] = {}): string {
  const card = makeCard(overrides);
  return classifyRuntimeTier(card, discovery);
}

describe("classifyRuntimeTier", () => {
  it("returns demo for card with only demo refs", () => {
    expect(
      classify({
        code_refs: [
          { path: "examples/demo-agent/main.go" },
          { path: "examples/testdata/agent.md" },
        ],
      }),
    ).toBe("demo");
  });

  it("returns production for card with only production refs", () => {
    expect(
      classify({
        code_refs: [
          { path: "internal/registry/access_filter.go" },
          { path: "pkg/agentcard/card.go" },
        ],
      }),
    ).toBe("production");
  });

  it("returns mixed for production + test refs", () => {
    expect(
      classify({
        code_refs: [
          { path: "internal/registry/access_filter.go" },
          { path: "tests/registry/access_filter_test.go" },
        ],
      }),
    ).toBe("mixed");
  });

  it("returns mixed for demo + production refs", () => {
    expect(
      classify({
        code_refs: [
          { path: "examples/demo-agent/main.go" },
          { path: "internal/registry/access_filter.go" },
        ],
      }),
    ).toBe("mixed");
  });

  it("returns historical when status is historical", () => {
    expect(
      classify({
        status: "historical",
        code_refs: [{ path: "internal/old/thing.go" }],
      }),
    ).toBe("historical");
  });

  it("returns historical when source_status is historical-only", () => {
    expect(
      classify({
        source_status: "historical-only",
        code_refs: [{ path: "internal/old/thing.go" }],
      }),
    ).toBe("historical");
  });

  it("returns unknown for empty code_refs", () => {
    expect(classify({ code_refs: [] })).toBe("unknown");
  });

  it("returns shared when path contains /shared/", () => {
    expect(
      classify({
        code_refs: [{ path: "pkg/shared/utils.go" }],
      }),
    ).toBe("shared");
  });

  it("returns shared when path contains /common/", () => {
    expect(
      classify({
        code_refs: [{ path: "internal/common/helpers.ts" }],
      }),
    ).toBe("shared");
  });
});

describe("checkRuntimeTierMismatch", () => {
  it("returns warning for production tier with demo refs", () => {
    const card = makeCard({
      runtime_tier: "production",
      code_refs: [
        { path: "internal/registry/access_filter.go" },
        { path: "examples/demo-agent/main.go" },
      ],
    });
    const warnings = checkRuntimeTierMismatch(card);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("runtime_tier=production");
    expect(warnings[0]).toContain("demo");
  });

  it("returns empty array when runtime_tier is not set", () => {
    const card = makeCard({
      runtime_tier: undefined,
      code_refs: [
        { path: "internal/registry/access_filter.go" },
        { path: "examples/demo-agent/main.go" },
      ],
    });
    expect(checkRuntimeTierMismatch(card)).toEqual([]);
  });

  it("returns empty array for production with no demo refs", () => {
    const card = makeCard({
      runtime_tier: "production",
      code_refs: [
        { path: "internal/registry/access_filter.go" },
        { path: "pkg/agentcard/card.go" },
      ],
    });
    expect(checkRuntimeTierMismatch(card)).toEqual([]);
  });
});
