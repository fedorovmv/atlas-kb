import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildCompaction } from "../src/core/compaction.js";

let tmpDir: string;
beforeEach(async () => { tmpDir = await mkdtemp(path.join(os.tmpdir(), "f2-test-")); });
afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

async function createMemoryWithCards(root: string, count: number) {
  const memDir = path.join(root, ".ai", "memory");
  await mkdir(memDir, { recursive: true });
  for (let i = 0; i < count; i++) {
    const fm = `---
entity_type: module
id: module-${i}
title: Module ${i}
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
---
# Module ${i}
## Responsibilities
Module ${i} does things.
`;
    await writeFile(path.join(memDir, `module-${i}.md`), fm, "utf8");
  }
}

describe("buildCompaction", () => {
  it("output ≤ maxChars", async () => {
    await createMemoryWithCards(tmpDir, 3);
    const result = await buildCompaction({ root: tmpDir, maxChars: 5000 });
    expect(result.charCount).toBeLessThanOrEqual(5000);
  });

  it("includes all required sections", async () => {
    await createMemoryWithCards(tmpDir, 2);
    const result = await buildCompaction({ root: tmpDir });
    expect(result.content).toContain("# Memory Compaction");
    expect(result.content).toContain("## Topic");
    expect(result.content).toContain("## HEAD");
    expect(result.content).toContain("## Route reasons");
    expect(result.content).toContain("## Active lane");
    expect(result.content).toContain("## Approvals");
    expect(result.content).toContain("## Unresolved items");
    expect(result.content).toContain("## Relevant files");
    expect(result.content).toContain("## Canonical KB");
  });

  it("truncation marker when exceeding", async () => {
    await createMemoryWithCards(tmpDir, 50);
    const result = await buildCompaction({ root: tmpDir, maxChars: 500 });
    expect(result.truncated).toBe(true);
    expect(result.content).toContain("TRUNCATED");
  });

  it("--no-truncate throws when exceeding", async () => {
    await createMemoryWithCards(tmpDir, 50);
    await expect(buildCompaction({ root: tmpDir, maxChars: 500, noTruncate: true })).rejects.toThrow();
  });

  it("custom maxChars=5000", async () => {
    await createMemoryWithCards(tmpDir, 3);
    const result = await buildCompaction({ root: tmpDir, maxChars: 5000 });
    expect(result.maxChars).toBe(5000);
  });

  it("empty memory → sections show N/A", async () => {
    const result = await buildCompaction({ root: tmpDir });
    expect(result.content).toContain("N/A");
  });
});