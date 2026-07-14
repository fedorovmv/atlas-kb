import { describe, it, expect } from "vitest";
import { mkdir, writeFile, rm, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { bootstrapMemory } from "../src/core/bootstrapMemory.js";
import { reconcileMemory } from "../src/core/reconcile.js";
import { applyReconcileFixes } from "../src/core/reconcileFix.js";
import { updateMemoryCard } from "../src/core/updateMemory.js";
import { loadMemoryCards } from "../src/core/loadMemory.js";
import { initMemory } from "../src/commands/init.js";
import { ingestSpecCommand } from "../src/commands/ingestSpec.js";

describe("applyReconcileFixes", () => {
  const daysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };

  it("appends stale refs to open-questions.md", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-fix-stale-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(
      path.join(dest, "internal/registry/access_filter.go"),
      "package registry\n\nfunc Filter() {}\n",
      "utf8"
    );
    await bootstrapMemory({ root: dest });

    // Delete the Go file to create a stale ref
    await rm(path.join(dest, "internal/registry/access_filter.go"));

    const report = await reconcileMemory({ root: dest });
    expect(report.staleRefsDetailed).toBeDefined();
    expect(report.staleRefsDetailed!.length).toBeGreaterThan(0);

    const result = await applyReconcileFixes(report, { root: dest });
    expect(result.openQuestionsAppended.length).toBeGreaterThan(0);

    const openQ = await readFile(
      path.join(dest, ".ai/memory/reconciliation/open-questions.md"),
      "utf8"
    );
    const cardId = report.staleRefsDetailed![0].cardId;
    expect(openQ).toContain(`Stale ref: card=${cardId}`);

    await rm(dest, { recursive: true, force: true });
  });

  it("appends weak current claims to conflicts.md", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-fix-weak-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(
      path.join(dest, "internal/registry/access_filter.go"),
      "package registry\n\nfunc Filter() {}\n",
      "utf8"
    );
    await bootstrapMemory({ root: dest });

    // Edit module card to status: current + evidence_level: spec_only
    const cards = await loadMemoryCards({ root: dest });
    const moduleCard = cards.find((c) => c.meta.entity_type === "module");
    expect(moduleCard).toBeDefined();
    const moduleId = moduleCard!.meta.id;

    await updateMemoryCard(moduleId, {
      root: dest,
      fields: { status: "current", evidence_level: "spec_only" },
    });

    const report = await reconcileMemory({ root: dest });
    expect(report.weakCurrentClaimsDetailed).toBeDefined();
    expect(report.weakCurrentClaimsDetailed!.length).toBeGreaterThan(0);

    const result = await applyReconcileFixes(report, { root: dest });
    expect(result.conflictsAppended.length).toBeGreaterThan(0);

    const conflicts = await readFile(
      path.join(dest, ".ai/memory/reconciliation/conflicts.md"),
      "utf8"
    );
    expect(conflicts).toContain("Weak current evidence");

    await rm(dest, { recursive: true, force: true });
  });

  it("broken relations — sets flag, preserves IDs, appends to open-questions", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-fix-rel-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(
      path.join(dest, "internal/registry/access_filter.go"),
      "package registry\n\nfunc Filter() {}\n",
      "utf8"
    );
    await bootstrapMemory({ root: dest });

    // Add a broken relation: supersedes → nonexistent-id-123
    const cards = await loadMemoryCards({ root: dest });
    const moduleCard = cards.find((c) => c.meta.entity_type === "module");
    expect(moduleCard).toBeDefined();
    const moduleId = moduleCard!.meta.id;

    await updateMemoryCard(moduleId, {
      root: dest,
      fields: { related_modules: ["nonexistent-id-123"] },
    });

    const report = await reconcileMemory({ root: dest });
    expect(report.brokenRelations).toBeDefined();
    expect(report.brokenRelations!.length).toBeGreaterThan(0);
    expect(report.brokenRelations![0].targetId).toBe("nonexistent-id-123");

    const result = await applyReconcileFixes(report, { root: dest });
    expect(result.relationsFixed.length).toBeGreaterThan(0);
    expect(result.openQuestionsAppended.length).toBeGreaterThan(0);

    // IDs are NOT deleted from frontmatter
    const updatedCards = await loadMemoryCards({ root: dest });
    const updatedCard = updatedCards.find((c) => c.meta.id === moduleId);
    expect(updatedCard).toBeDefined();
    expect(updatedCard!.meta.related_modules).toContain("nonexistent-id-123");

    // has_broken_relations flag is set
    expect(updatedCard!.meta.has_broken_relations).toBe(true);

    // open-questions.md contains broken relation entry
    const openQ = await readFile(
      path.join(dest, ".ai/memory/reconciliation/open-questions.md"),
      "utf8"
    );
    expect(openQ).toContain("Broken relation");
    expect(openQ).toContain("nonexistent-id-123");

    await rm(dest, { recursive: true, force: true });
  });

  it("is idempotent — second run does not duplicate", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-fix-idem-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(
      path.join(dest, "internal/registry/access_filter.go"),
      "package registry\n\nfunc Filter() {}\n",
      "utf8"
    );
    await bootstrapMemory({ root: dest });

    // Delete the Go file
    await rm(path.join(dest, "internal/registry/access_filter.go"));

    const report = await reconcileMemory({ root: dest });
    expect(report.staleRefsDetailed!.length).toBeGreaterThan(0);

    // First run
    await applyReconcileFixes(report, { root: dest });
    const openQ1 = await readFile(
      path.join(dest, ".ai/memory/reconciliation/open-questions.md"),
      "utf8"
    );

    // Second run — should not add any new entries
    const result2 = await applyReconcileFixes(report, { root: dest });
    expect(result2.openQuestionsAppended).toEqual([]);
    const openQ2 = await readFile(
      path.join(dest, ".ai/memory/reconciliation/open-questions.md"),
      "utf8"
    );
    expect(openQ2).toBe(openQ1);

    await rm(dest, { recursive: true, force: true });
  });

  it("does nothing when report is empty", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-fix-empty-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(
      path.join(dest, "internal/registry/access_filter.go"),
      "package registry\n\nfunc Filter() {}\n",
      "utf8"
    );
    await bootstrapMemory({ root: dest });

    const beforeOpenQ = await readFile(
      path.join(dest, ".ai/memory/reconciliation/open-questions.md"),
      "utf8"
    );
    const beforeConflicts = await readFile(
      path.join(dest, ".ai/memory/reconciliation/conflicts.md"),
      "utf8"
    );

    const emptyReport = {
      staleRefs: [],
      weakCurrentClaims: [],
      realizableProposals: [],
      orphanModules: [],
      staleRefsDetailed: [],
      weakCurrentClaimsDetailed: [],
      realizableProposalsDetailed: [],
      staleProposals: [],
    };

    const result = await applyReconcileFixes(emptyReport, { root: dest });
    expect(result.openQuestionsAppended).toEqual([]);
    expect(result.conflictsAppended).toEqual([]);
    expect(result.relationsFixed).toEqual([]);

    const afterOpenQ = await readFile(
      path.join(dest, ".ai/memory/reconciliation/open-questions.md"),
      "utf8"
    );
    const afterConflicts = await readFile(
      path.join(dest, ".ai/memory/reconciliation/conflicts.md"),
      "utf8"
    );

    expect(afterOpenQ).toBe(beforeOpenQ);
    expect(afterConflicts).toBe(beforeConflicts);

    await rm(dest, { recursive: true, force: true });
  });

  it("reconcile --fix updates stored claim evidence", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-fix-claim-"));
    await initMemory({ root: dest });

    // Create Go + test files
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(
      path.join(dest, "internal/registry/access_filter.go"),
      "package registry\n\nfunc FilterCardsForCaller(caller string) {}\n",
      "utf8",
    );
    await mkdir(path.join(dest, "tests/agent-registry"), { recursive: true });
    await writeFile(
      path.join(dest, "tests/agent-registry/access_filter_test.go"),
      "package registry_test\n\nfunc TestFilterCardsForCaller() {}\n",
      "utf8",
    );

    // Create and ingest spec
    await mkdir(path.join(dest, "specs"), { recursive: true });
    await writeFile(
      path.join(dest, "specs/access-filter.md"),
      `# Access Filter Spec

Status: accepted

## Requirements

- Registry filters available agent cards by caller service identity
- The filtering logic lives in \`internal/registry/access_filter.go\`
`,
      "utf8",
    );
    await ingestSpecCommand("specs/access-filter.md", { root: dest, force: true });

    // Delete the code files
    await rm(path.join(dest, "internal/registry/access_filter.go"));
    await rm(path.join(dest, "tests/agent-registry/access_filter_test.go"));
    await rm(path.join(dest, "tests/agent-registry"), { recursive: true });

    const report = await reconcileMemory({ root: dest });
    expect((report.changedClaimEvidence?.length ?? 0)).toBeGreaterThan(0);

    const result = await applyReconcileFixes(report, { root: dest });
    expect(result.claimsUpdated.length).toBeGreaterThan(0);

    // Reload the card and verify evidence was updated
    const cards = await loadMemoryCards({ root: dest });
    const updatedCard = cards.find((c) => c.meta.id === report.changedClaimEvidence![0].cardId);
    expect(updatedCard).toBeDefined();
    const claim = updatedCard!.meta.claims?.find((c) => c.text.includes("access_filter.go") || c.text.includes("filtering logic"));
    expect(claim).toBeDefined();
    expect(claim!.evidence.status).toBe("not_found");
    expect(claim!.last_checked).toBeDefined();

    await rm(dest, { recursive: true, force: true });
  });

  it("reconcile --fix claim update is idempotent", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-fix-claim-idem-"));
    await initMemory({ root: dest });

    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(
      path.join(dest, "internal/registry/access_filter.go"),
      "package registry\n\nfunc FilterCardsForCaller(caller string) {}\n",
      "utf8",
    );
    await mkdir(path.join(dest, "tests/agent-registry"), { recursive: true });
    await writeFile(
      path.join(dest, "tests/agent-registry/access_filter_test.go"),
      "package registry_test\n\nfunc TestFilterCardsForCaller() {}\n",
      "utf8",
    );

    await mkdir(path.join(dest, "specs"), { recursive: true });
    await writeFile(
      path.join(dest, "specs/access-filter.md"),
      `# Access Filter Spec

Status: accepted

## Requirements

- Registry filters available agent cards by caller service identity
`,
      "utf8",
    );
    await ingestSpecCommand("specs/access-filter.md", { root: dest, force: true });

    await rm(path.join(dest, "internal/registry/access_filter.go"));
    await rm(path.join(dest, "tests/agent-registry/access_filter_test.go"));
    await rm(path.join(dest, "tests/agent-registry"), { recursive: true });

    const report = await reconcileMemory({ root: dest });
    // First fix
    const result1 = await applyReconcileFixes(report, { root: dest });
    expect(result1.claimsUpdated.length).toBeGreaterThan(0);

    // Reconcile again — statuses are now already updated, so no changedClaimEvidence
    const report2 = await reconcileMemory({ root: dest });
    expect(report2.changedClaimEvidence).toEqual([]);

    // Second fix — should have nothing to do
    const result2 = await applyReconcileFixes(report2, { root: dest });
    expect(result2.claimsUpdated).toEqual([]);

    await rm(dest, { recursive: true, force: true });
  });
});
