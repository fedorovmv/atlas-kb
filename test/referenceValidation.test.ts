import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { validateReferenceStudy, validateMemory } from "../src/core/validate.js";
import type { MemoryCard } from "../src/core/types.js";

function makeReferenceCard(overrides: Partial<MemoryCard> = {}): MemoryCard {
  const baseMeta = {
    entity_type: "reference" as const,
    id: "test-ref",
    title: "Test Reference",
    status: "current" as const,
    authority: "reviewed_memory" as const,
    evidence_level: "code_confirmed" as const,
    stability: "stable" as const,
    source_confidence: "high" as const,
    last_reviewed: "2026-07-12",
    review_required: false,
    knowledge_types: ["current_behavior"] as const[],
    usage_policy: {
      can_answer_current_behavior: true,
      can_generate_code_from: false,
      can_use_as_rationale: true,
      requires_code_check_before_change: true,
    },
    code_refs: [] as const[],
    test_refs: [] as const[],
    source_refs: [{ path: "src/index.ts" }],
  };
  return {
    path: "/tmp/.ai/memory/reference/test-ref.md",
    relativePath: ".ai/memory/reference/test-ref.md",
    meta: { ...baseMeta, ...overrides.meta } as MemoryCard["meta"],
    body: `## Behaviors carried over\nContent here.\n\n## Behaviors intentionally not carried over\nContent.\n\n## Invariants and state transitions\nContent.\n\n## Failure/retry/cancellation/recovery\nContent.\n\n## Compatibility/operational constraints\nContent.\n\n## Derived scenarios and tests\nContent.\n`,
    raw: "",
    ...overrides,
  };
}

let tmpDir: string;

beforeEach(async () => { tmpDir = await mkdtemp(path.join(os.tmpdir(), "f5-test-")); });
afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

describe("validateReferenceStudy", () => {
  it("all 6 sections → ok", () => {
    const card = makeReferenceCard();
    const result = validateReferenceStudy(card);
    expect(result.errors).toHaveLength(0);
  });

  it("missing section → error", () => {
    const card = makeReferenceCard({ body: "## Behaviors carried over\nContent.\n" });
    const result = validateReferenceStudy(card);
    expect(result.errors.some(e => e.includes("missing required section"))).toBe(true);
  });

  it("placeholder → error", () => {
    const card = makeReferenceCard({
      body: "## Behaviors carried over\nNeeds review.\n\n## Behaviors intentionally not carried over\nContent.\n\n## Invariants and state transitions\nContent.\n\n## Failure/retry/cancellation/recovery\nContent.\n\n## Compatibility/operational constraints\nContent.\n\n## Derived scenarios and tests\nContent.\n",
    });
    const result = validateReferenceStudy(card);
    expect(result.errors.some(e => e.includes("placeholder"))).toBe(true);
  });

  it("missing source path → warning (unit test, path resolves to cwd)", () => {
    const card = makeReferenceCard({
      meta: { ...makeReferenceCard().meta, source_refs: [{ path: "nonexistent/file.ts" }] } as MemoryCard["meta"],
    });
    const result = validateReferenceStudy(card);
    expect(result.warnings.some(w => w.includes("source path may not exist"))).toBe(true);
  });

  it("existing reference card without treeHash → WARNING (not ERROR)", () => {
    const card = makeReferenceCard();
    const result = validateReferenceStudy(card);
    expect(result.warnings.some(w => w.includes("treeHash"))).toBe(true);
    expect(result.errors.every(e => !e.includes("treeHash"))).toBe(true);
  });

  it("non-reference cards NOT affected", () => {
    const card = makeReferenceCard({
      meta: { ...makeReferenceCard().meta, entity_type: "module" } as MemoryCard["meta"],
    });
    const result = validateReferenceStudy(card);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("validateMemory reference integration", () => {
  it("reference card without sections → errors in validateMemory", async () => {
    const memoryRoot = path.join(tmpDir, ".ai", "memory");
    await mkdir(memoryRoot, { recursive: true });
    const cardContent = `---
entity_type: reference
id: broken-ref
title: Broken Reference
status: current
authority: reviewed_memory
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: "2026-07-12"
review_required: false
knowledge_types: ["current_behavior"]
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
source_refs:
  - path: src/index.ts
---
# Broken Reference
## Only one section
`;
    await writeFile(path.join(memoryRoot, "broken-ref.md"), cardContent, "utf8");

    const result = await validateMemory({ root: tmpDir });
    expect(result.errors.some(e => e.includes("missing required section"))).toBe(true);
  });

  it("non-reference cards NOT affected by reference validation", async () => {
    const memoryRoot = path.join(tmpDir, ".ai", "memory");
    await mkdir(memoryRoot, { recursive: true });
    const cardContent = `---
entity_type: module
id: normal-module
title: Normal Module
status: needs_review
authority: reviewed_memory
evidence_level: inferred
stability: evolving
source_confidence: low
last_reviewed: "2026-07-12"
review_required: true
knowledge_types: ["current_behavior"]
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---
# Normal Module
## Responsibilities
Some content here.
`;
    await writeFile(path.join(memoryRoot, "normal-module.md"), cardContent, "utf8");

    const result = await validateMemory({ root: tmpDir });
    expect(result.errors.every(e => !e.includes("reference study"))).toBe(true);
  });
});