import { describe, it, expect } from "vitest";
import { mkdir, writeFile, rm, mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { bootstrapMemory } from "../src/core/bootstrapMemory.js";
import { reconcileMemory } from "../src/core/reconcile.js";

describe("reconcile", () => {
  it("reports stale references after file deletion", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-stale-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");
    await bootstrapMemory({ root: dest });
    await rm(path.join(dest, "internal/registry/access_filter.go"));
    const report = await reconcileMemory({ root: dest });
    expect(report.staleRefs.length).toBeGreaterThan(0);
    await rm(dest, { recursive: true, force: true });
  });

  it("reports no stale refs when files exist", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-clean-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");
    await bootstrapMemory({ root: dest });
    const report = await reconcileMemory({ root: dest });
    expect(report.staleRefs.length).toBe(0);
    await rm(dest, { recursive: true, force: true });
  });

  it("is read-only — does not modify memory", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-readonly-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");
    await bootstrapMemory({ root: dest });
    const before = await readdir(path.join(dest, ".ai/memory/modules/"));
    await reconcileMemory({ root: dest });
    const after = await readdir(path.join(dest, ".ai/memory/modules/"));
    expect(after).toEqual(before);
    await rm(dest, { recursive: true, force: true });
  });

  it("reports stale proposals older than 90 days", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-stale-proposal-"));
    await mkdir(path.join(dest, ".ai/memory/proposals"), { recursive: true });
    // Write a proposal card with spec_only evidence and last_reviewed 100 days ago
    const daysAgo = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().slice(0, 10);
    };
    const proposalCard = `---
entity_type: proposal
id: proposal-test-feature
title: Test Feature
status: proposed
authority: proposed
evidence_level: spec_only
stability: experimental
source_confidence: low
last_reviewed: ${daysAgo(100)}
review_required: true
knowledge_types:
  - proposed_behavior
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Test Feature (proposal)

Proposed behavior — requires evidence.
`;
    await writeFile(path.join(dest, ".ai/memory/proposals/test-feature.md"), proposalCard, "utf8");
    const report = await reconcileMemory({ root: dest });
    expect(report.staleProposals).toBeDefined();
    expect(report.staleProposals!.length).toBeGreaterThan(0);
    expect(report.staleProposals![0].cardId).toBe("proposal-test-feature");
    expect(report.staleProposals![0].daysSinceReview).toBeGreaterThanOrEqual(99);
    await rm(dest, { recursive: true, force: true });
  });

  it("does not flag recent proposals as stale", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-recent-proposal-"));
    await mkdir(path.join(dest, ".ai/memory/proposals"), { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const proposalCard = `---
entity_type: proposal
id: proposal-recent-feature
title: Recent Feature
status: proposed
authority: proposed
evidence_level: spec_only
stability: experimental
source_confidence: low
last_reviewed: ${today}
review_required: true
knowledge_types:
  - proposed_behavior
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Recent Feature (proposal)

Recently reviewed proposal.
`;
    await writeFile(path.join(dest, ".ai/memory/proposals/recent-feature.md"), proposalCard, "utf8");
    const report = await reconcileMemory({ root: dest });
    expect(report.staleProposals).toBeDefined();
    expect(report.staleProposals!.length).toBe(0);
    await rm(dest, { recursive: true, force: true });
  });
});
