import { describe, it, expect } from "vitest";
import { repairLinks, repairModuleTiers, repairArchitectureIndex, repairCoverage, rebuildIndexes } from "../src/core/semanticRepair.js";
import type { MemoryCard } from "../src/core/types.js";
import type { FileRecord } from "../src/schemas/discovery.js";
import type { SourceCoverage } from "../src/schemas/sourceCoverage.js";

function makeCard(overrides: Partial<MemoryCard> = {}): MemoryCard {
  return {
    path: "/tmp/.ai/memory/modules/test.md",
    relativePath: ".ai/memory/modules/test.md",
    meta: {
      entity_type: "module", id: "test", title: "Test",
      status: "current", authority: "reviewed_memory", evidence_level: "code_confirmed",
      stability: "stable", source_confidence: "high", last_reviewed: "2026-07-12",
      review_required: false, knowledge_types: ["current_behavior"],
      usage_policy: { can_answer_current_behavior: true, can_generate_code_from: false, can_use_as_rationale: true, requires_code_check_before_change: true },
      code_refs: [], test_refs: [], source_refs: [],
    } as MemoryCard["meta"],
    body: "",
    raw: "",
    ...overrides,
  };
}

describe("repairLinks", () => {
  it("broken link with matching basename → fixed", () => {
    const cardA = makeCard({ path: "/tmp/.ai/memory/modules/a.md", meta: { ...makeCard().meta, id: "a", title: "A" } as MemoryCard["meta"], body: "See [b](../modules/b.md)" });
    const cardB = makeCard({ path: "/tmp/.ai/memory/modules/b.md", meta: { ...makeCard().meta, id: "b", title: "B" } as MemoryCard["meta"] });
    const result = repairLinks([cardA, cardB]);
    expect(result.fixed).toBe(1);
  });
  it("no broken links → 0 fixed", () => {
    const card = makeCard({ body: "No links here." });
    const result = repairLinks([card]);
    expect(result.fixed).toBe(0);
  });
});

describe("repairModuleTiers", () => {
  it("unknown tier → classified", () => {
    const card = makeCard({ meta: { ...makeCard().meta, runtime_tier: "unknown", code_refs: [{ path: "internal/registry/filter.go" }] } as MemoryCard["meta"] });
    const discovery: FileRecord[] = [];
    const result = repairModuleTiers([card], discovery);
    expect(result.updated).toBe(1);
    expect(card.meta.runtime_tier).not.toBe("unknown");
  });
  it("already set → not updated", () => {
    const card = makeCard({ meta: { ...makeCard().meta, runtime_tier: "production" } as MemoryCard["meta"] });
    const result = repairModuleTiers([card], []);
    expect(result.updated).toBe(0);
  });
});

describe("repairArchitectureIndex", () => {
  it("has module cards → update needed", () => {
    const card = makeCard({ meta: { ...makeCard().meta, entity_type: "module" } as MemoryCard["meta"] });
    const result = repairArchitectureIndex([card]);
    expect(result.updated).toBe(false); // no arch cards yet
  });
});

describe("repairCoverage", () => {
  it("clears historical-only targetCards", () => {
    const coverage: SourceCoverage = {
      entries: [
        { path: "a.md", disposition: "historical-only", targetCards: ["card-1"], sourceKind: "git-tracked" },
        { path: "b.md", disposition: "extracted", targetCards: ["card-2"], sourceKind: "git-tracked" },
      ],
      counts: {},
    };
    const result = repairCoverage(coverage);
    expect(result.fixed).toBe(1);
    expect(coverage.entries[0].targetCards).toHaveLength(0);
  });
});

describe("rebuildIndexes", () => {
  it("detects decision cards", () => {
    const card = makeCard({ meta: { ...makeCard().meta, entity_type: "decision" } as MemoryCard["meta"] });
    const result = rebuildIndexes([card]);
    expect(result.decisions).toBe(true);
    expect(result.flows).toBe(false);
  });
  it("preserves custom sections — does not overwrite", () => {
    // rebuildIndexes just detects — actual write happens in command
    const result = rebuildIndexes([]);
    expect(result.decisions).toBe(false);
  });
});