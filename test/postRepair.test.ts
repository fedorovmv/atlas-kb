import { describe, it, expect } from "vitest";
import { repairLinks, repairModuleTiers, repairArchitectureIndex, repairCoverage, rebuildIndexes } from "../src/core/semanticRepair.js";
import { buildIndexContent } from "../src/commands/semanticRepair.js";
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
  it("generates decisions table markdown (R2-1)", () => {
    const d1 = makeCard({ meta: { ...makeCard().meta, entity_type: "decision", id: "d1", title: "Use Go for Backend" } as MemoryCard["meta"] });
    const d2 = makeCard({ meta: { ...makeCard().meta, entity_type: "decision", id: "d2", title: "gRPC over REST" } as MemoryCard["meta"] });
    const f1 = makeCard({ meta: { ...makeCard().meta, entity_type: "flow", id: "f1", title: "Auth Flow" } as MemoryCard["meta"] });
    const result = rebuildIndexes([d1, d2, f1]);
    expect(result.decisions).toBe(true);
    expect(result.flows).toBe(true);
    expect(result.decisionsTable).toContain("Use Go for Backend");
    expect(result.decisionsTable).toContain("d1");
    expect(result.decisionsTable).toContain("gRPC over REST");
    expect(result.decisionsTable).toContain("d2");
    expect(result.flowsTable).toContain("Auth Flow");
    expect(result.flowsTable).toContain("f1");
  });
});

describe("repairLinks — R2-2", () => {
  it("assigns card.body with fixed link and returns changedCards", () => {
    const originalBody = "See [b](../broken/b.md)";
    const cardA = makeCard({
      path: "/tmp/.ai/memory/modules/a.md",
      meta: { ...makeCard().meta, id: "a", title: "A" } as MemoryCard["meta"],
      body: originalBody,
    });
    const cardB = makeCard({ path: "/tmp/.ai/memory/modules/b.md", meta: { ...makeCard().meta, id: "b", title: "B" } as MemoryCard["meta"] });
    const result = repairLinks([cardA, cardB]);
    expect(result.fixed).toBe(1);
    expect(result.changedCards).toHaveLength(1);
    expect(result.changedCards[0].meta.id).toBe("a");
    expect(cardA.body).not.toBe(originalBody);
    expect(cardA.body).not.toContain("../broken/b.md");
  });
});

describe("repairModuleTiers — R2-3", () => {
  it("returns changedCards list for newly classified tiers", () => {
    const card = makeCard({ meta: { ...makeCard().meta, runtime_tier: "unknown", code_refs: [{ path: "internal/registry/filter.go" }] } as MemoryCard["meta"] });
    const discovery: FileRecord[] = [];
    const result = repairModuleTiers([card], discovery);
    expect(result.updated).toBe(1);
    expect(result.changedCards).toHaveLength(1);
    expect(result.changedCards[0].meta.id).toBe(card.meta.id);
    expect(card.meta.runtime_tier).not.toBe("unknown");
  });
  it("changedCards is empty when no tiers were updated", () => {
    const card = makeCard({ meta: { ...makeCard().meta, runtime_tier: "production" } as MemoryCard["meta"] });
    const result = repairModuleTiers([card], []);
    expect(result.updated).toBe(0);
    expect(result.changedCards).toHaveLength(0);
  });
});

describe("buildIndexContent", () => {
  it("replaces existing populated table completely — no orphaned rows", () => {
    const existing = `---
entity_type: index
---

## Active decisions

| ID | Title | Status |
|---|---|---|
| old-1 | Old Decision | current |
| old-2 | Another Old | current |
`;
    const newTable = `| ID | Title | Status |
|---|---|---|
| new-1 | New Decision | current |`;
    const result = buildIndexContent(existing, newTable, "Active decisions");
    expect(result).toContain("new-1");
    expect(result).toContain("New Decision");
    expect(result).not.toContain("old-1");
    expect(result).not.toContain("old-2");
    expect(result).not.toContain("Another Old");
  });

  it("preserves frontmatter and custom sections when replacing target section", () => {
    const existing = `---
entity_type: index
status: reviewed
---

## Custom section

Some custom content that must be preserved.

More content here.

## Active decisions

| ID | Title | Status |
|---|---|---|
| old-1 | Old Decision | current |

## Another section

Footer content.
`;
    const newTable = `| ID | Title | Status |
|---|---|---|
| new-1 | New Decision | current |`;
    const result = buildIndexContent(existing, newTable, "Active decisions");
    // Frontmatter preserved
    expect(result).toContain("entity_type: index");
    expect(result).toContain("status: reviewed");
    // Custom section preserved
    expect(result).toContain("## Custom section");
    expect(result).toContain("Some custom content that must be preserved.");
    expect(result).toContain("More content here.");
    // Another section preserved
    expect(result).toContain("## Another section");
    expect(result).toContain("Footer content.");
    // Old table replaced
    expect(result).not.toContain("old-1");
    expect(result).not.toContain("Old Decision");
    // New table present
    expect(result).toContain("new-1");
    expect(result).toContain("New Decision");
  });

  it("appends new section at end when section does not exist", () => {
    const existing = `---
entity_type: index
---

Some intro paragraph.
`;
    const newTable = `| ID | Title | Status |
|---|---|---|
| new-1 | New Decision | current |`;
    const result = buildIndexContent(existing, newTable, "Active decisions");
    expect(result).toContain("## Active decisions");
    expect(result).toContain("new-1");
    expect(result).toContain("New Decision");
    // Existing content preserved
    expect(result).toContain("Some intro paragraph.");
    // Frontmatter preserved
    expect(result).toContain("entity_type: index");
  });
});