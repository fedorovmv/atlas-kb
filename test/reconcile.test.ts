import { describe, it, expect } from "vitest";
import { mkdir, writeFile, rm, mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { bootstrapMemory } from "../src/core/bootstrapMemory.js";
import { reconcileMemory } from "../src/core/reconcile.js";
import { initMemory } from "../src/commands/init.js";
import { ingestSpecCommand } from "../src/commands/ingestSpec.js";

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

  it("reconcile detects changed claim evidence after code deletion", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-claim-"));
    await initMemory({ root: dest });

    // Create a Go source file
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(
      path.join(dest, "internal/registry/access_filter.go"),
      "package registry\n\nfunc FilterCardsForCaller(caller string) {}\n",
      "utf8",
    );
    // Create a test file to ensure confirmed_by_code status
    await mkdir(path.join(dest, "tests/agent-registry"), { recursive: true });
    await writeFile(
      path.join(dest, "tests/agent-registry/access_filter_test.go"),
      "package registry_test\n\nfunc TestFilterCardsForCaller() {}\n",
      "utf8",
    );

    // Create a spec that will generate claims referencing the filter
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

    // Ingest the spec — creates a card with claims
    await ingestSpecCommand("specs/access-filter.md", { root: dest, force: true });

    // Verify claims were created with confirmed status
    {
      const report = await reconcileMemory({ root: dest });
      const changed = report.changedClaimEvidence ?? [];
      // Before deletion, claims should match — no changes expected
      expect(changed).toEqual([]);
    }

    // Delete the Go file — evidence should now show not_found
    await rm(path.join(dest, "internal/registry/access_filter.go"));
    await rm(path.join(dest, "tests/agent-registry/access_filter_test.go"));
    await rm(path.join(dest, "tests/agent-registry"), { recursive: true });

    const report = await reconcileMemory({ root: dest });
    const changed = report.changedClaimEvidence ?? [];
    expect(changed.length).toBeGreaterThan(0);
    const firstChange = changed[0];
    expect(firstChange.oldStatus).toEqual("confirmed_by_code");
    // After deleting code+test files, spec still matches → documented_only (not not_found)
    expect(["documented_only", "not_found"]).toContain(firstChange.newStatus);

    await rm(dest, { recursive: true, force: true });
  });

  it("reconcile skips cards without claims", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-no-claims-"));
    await bootstrapMemory({ root: dest });
    const report = await reconcileMemory({ root: dest });
    expect(report.changedClaimEvidence).toEqual([]);
    await rm(dest, { recursive: true, force: true });
  });

  it("reconcile detects broken supersedes link", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-broken-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");
    await bootstrapMemory({ root: dest });

    // Read the generated card, inject a broken supersedes link
    const modulesDir = path.join(dest, ".ai/memory/modules");
    const files = await readdir(modulesDir);
    const cardPath = path.join(modulesDir, files[0]);
    let cardContent = await readFile(cardPath, "utf8");

    // Inject supersedes field into frontmatter (right after the first ---)
    cardContent = cardContent.replace(/^---\n/m, "---\nsupersedes:\n  - nonexistent-id-123\n");
    await writeFile(cardPath, cardContent, "utf8");

    const report = await reconcileMemory({ root: dest });
    expect(report.brokenRelations).toBeDefined();
    expect(report.brokenRelations!.length).toBeGreaterThan(0);
    expect(report.brokenRelations![0].targetId).toBe("nonexistent-id-123");
    expect(report.brokenRelations![0].field).toBe("supersedes");

    await rm(dest, { recursive: true, force: true });
  });

  it("reconcile no broken relations when links are valid", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-valid-rel-"));
    await mkdir(path.join(dest, ".ai/memory/modules"), { recursive: true });

    // Create two cards that reference each other via related_specs
    const today = new Date().toISOString().slice(0, 10);
    const cardA = `---
entity_type: module
id: mod-alpha
title: Module Alpha
status: current
authority: source_of_truth
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: ${today}
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: false
related_specs:
  - mod-beta
---

# Module Alpha

Description of alpha.
`;
    const cardB = `---
entity_type: module
id: mod-beta
title: Module Beta
status: current
authority: source_of_truth
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: ${today}
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: false
related_specs:
  - mod-alpha
---

# Module Beta

Description of beta.
`;
    await writeFile(path.join(dest, ".ai/memory/modules/alpha.md"), cardA, "utf8");
    await writeFile(path.join(dest, ".ai/memory/modules/beta.md"), cardB, "utf8");

    const report = await reconcileMemory({ root: dest });
    expect(report.brokenRelations).toBeDefined();
    expect(report.brokenRelations!.length).toBe(0);

    await rm(dest, { recursive: true, force: true });
  });

  it("reconcile detects cross-card duplicate claims", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-dup-"));
    await initMemory({ root: dest });

    const today = new Date().toISOString().slice(0, 10);

    // Card A with a claim
    const cardA = `---
entity_type: module
id: mod-alpha
title: Module Alpha
status: current
authority: source_of_truth
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: ${today}
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: false
claims:
  - id: claim-001
    text: "The registry MUST filter cards by caller service identity"
    type: current_behavior
    evidence_required: true
---

# Module Alpha

Description of alpha.
`;
    // Card B with same canonical claim text
    const cardB = `---
entity_type: module
id: mod-beta
title: Module Beta
status: current
authority: source_of_truth
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: ${today}
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: false
claims:
  - id: claim-001
    text: "Registry must filter cards by caller service identity"
    type: current_behavior
    evidence_required: true
---

# Module Beta

Description of beta.
`;
    await mkdir(path.join(dest, ".ai/memory/modules"), { recursive: true });
    await writeFile(path.join(dest, ".ai/memory/modules/alpha.md"), cardA, "utf8");
    await writeFile(path.join(dest, ".ai/memory/modules/beta.md"), cardB, "utf8");

    const report = await reconcileMemory({ root: dest });
    expect(report.duplicateClaims).toBeDefined();
    expect(report.duplicateClaims!.length).toBeGreaterThan(0);
    const dup = report.duplicateClaims![0];
    expect(dup.canonicalText).toBe("registry filter cards caller service identity");
    expect([dup.cardIdA, dup.cardIdB]).toContain("mod-alpha");
    expect([dup.cardIdA, dup.cardIdB]).toContain("mod-beta");

    await rm(dest, { recursive: true, force: true });
  });

  it("reconcile no duplicates when claims differ", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-unique-"));
    await mkdir(path.join(dest, ".ai/memory/modules"), { recursive: true });

    const today = new Date().toISOString().slice(0, 10);

    // Card A with a unique claim
    const cardA = `---
entity_type: module
id: mod-unique-a
title: Module Unique A
status: current
authority: source_of_truth
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: ${today}
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: false
claims:
  - id: claim-001
    text: "The authentication layer validates JWT tokens"
    type: current_behavior
    evidence_required: true
---

# Module Unique A
`;
    // Card B with a different claim (completely different semantics)
    const cardB = `---
entity_type: module
id: mod-unique-b
title: Module Unique B
status: current
authority: source_of_truth
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: ${today}
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: false
claims:
  - id: claim-001
    text: "The load balancer distributes requests round robin"
    type: current_behavior
    evidence_required: true
---

# Module Unique B
`;
    await writeFile(path.join(dest, ".ai/memory/modules/unique-a.md"), cardA, "utf8");
    await writeFile(path.join(dest, ".ai/memory/modules/unique-b.md"), cardB, "utf8");

    const report = await reconcileMemory({ root: dest });
    expect(report.duplicateClaims).toBeDefined();
    expect(report.duplicateClaims!.length).toBe(0);

    await rm(dest, { recursive: true, force: true });
  });

  it("reconcile detects broken claim links", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-claim-link-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\nfunc Filter() {}\n", "utf8");
    await bootstrapMemory({ root: dest });

    // Create a card with claim containing broken module link
    const brokenCard = `---
entity_type: module
id: test-broken-links
title: Test Broken Links
status: needs_review
authority: reviewed_memory
evidence_level: unknown
stability: evolving
source_confidence: low
last_reviewed: '2026-07-09'
review_required: true
knowledge_types:
  - current_behavior
claims:
  - id: claim-001
    text: Test claim
    type: current_behavior
    evidence_required: true
    module: nonexistent-module-id
    evidence:
      claim_id: claim-001
      status: not_checked
      confidence: unknown
      files: []
      notes: []
    last_checked: '2026-07-09'
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Test Broken Links
`;
    await writeFile(path.join(dest, ".ai/memory/modules/test-broken.md"), brokenCard, "utf8");

    const report = await reconcileMemory({ root: dest });
    expect(report.brokenClaimLinks).toBeDefined();
    expect(report.brokenClaimLinks!.length).toBeGreaterThan(0);
    expect(report.brokenClaimLinks![0].targetId).toBe("nonexistent-module-id");
    expect(report.brokenClaimLinks![0].field).toBe("module");

    await rm(dest, { recursive: true, force: true });
  });
});
