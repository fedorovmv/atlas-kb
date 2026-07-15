import { describe, expect, it } from "vitest";
import path from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createTempProject } from "./helpers.js";
import { validateMemory } from "../src/core/validate.js";
import { checkEnrichmentStatus } from "../src/core/validate.js";

const badHistorical = `---
entity_type: historical
id: bad-old-spec
title: Bad Old Spec
status: historical
authority: historical_context
evidence_level: spec_only
stability: deprecated
source_confidence: low
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - historical_context
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Bad
`;

describe("validateMemory", () => {
  it("accepts the generated scaffold and existing referenced code paths", async () => {
    const root = await createTempProject();
    const result = await validateMemory({ root });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects dangerous historical/proposal generation policy", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/historical");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "bad-old-spec.md"), badHistorical, "utf8");

    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("proposal/historical memory cannot be direct code generation source");
  });

  it("rejects broken relations", async () => {
    const root = await createTempProject();
    await writeFile(
      path.join(root, ".ai/memory/modules/broken.md"),
      `---
entity_type: module
id: broken-module
title: Broken Module
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
related_decisions:
  - missing-decision
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Broken
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("broken relation related_decisions: missing-decision");
  });

  it("rejects spec_only evidence claiming current_behavior", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "spec-only-current.md"),
      `---
entity_type: module
id: spec-only-current
title: Spec Only Current
status: current
authority: reviewed_memory
evidence_level: spec_only
stability: stable
source_confidence: low
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Spec Only Current
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("spec-only-current.md");
    expect(result.errors.join("\n")).toContain("spec_only evidence cannot claim current_behavior");
  });

  it("accepts spec_only evidence with proposed_behavior", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/proposals");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "spec-only-proposed.md"),
      `---
entity_type: proposal
id: spec-only-proposed
title: Spec Only Proposed
status: proposed
authority: reviewed_memory
evidence_level: spec_only
stability: experimental
source_confidence: low
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - proposed_behavior
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Spec Only Proposed

## Исходная спецификация
content
## Предлагаемое поведение
content
## Обоснование из спецификации
content
## Затронутые модули
content
## Затронутые сценарии
content
## Затронутые решения
content
## Проверка текущего кода
content
## Утверждения
content
## Решение по ревью
content
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const specOnlyErrors = result.errors.filter((e) => e.includes("spec-only-proposed.md"));
    expect(specOnlyErrors).toEqual([]);
  });

  it("accepts code_confirmed evidence with current_behavior", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "code-confirmed-current.md"),
      `---
entity_type: module
id: code-confirmed-current
title: Code Confirmed Current
status: current
authority: reviewed_memory
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Code Confirmed Current

## Свидетельства из кода

- validateMemory function at src/core/validate.ts:17 implements evidence checks
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const codeConfirmedErrors = result.errors.filter((e) => e.includes("code-confirmed-current.md"));
    expect(codeConfirmedErrors).toEqual([]);
  });

  it("errors: code_confirmed without ## Свидетельства из кода section", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "missing-evidence.md"),
      `---
entity_type: module
id: missing-evidence
title: Missing Evidence
status: current
authority: reviewed_memory
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Missing Evidence

No evidence section here.
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("missing-evidence.md");
    expect(result.errors.join("\n")).toContain("evidence_level=code_confirmed требует секцию ## Свидетельства из кода с записями в формате");
  });

  it("passes: code_confirmed with ## Свидетельства из кода section", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "has-evidence.md"),
      `---
entity_type: module
id: has-evidence
title: Has Evidence
status: current
authority: reviewed_memory
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Has Evidence

## Свидетельства из кода

- FilterCardsForCaller function at internal/registry/access_filter.go:12
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const evErrors = result.errors.filter((e) => e.includes("has-evidence.md"));
    expect(evErrors).toEqual([]);
  });

  it("errors: test_confirmed without ## Свидетельства из тестов section", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "missing-test-evidence.md"),
      `---
entity_type: module
id: missing-test-evidence
title: Missing Test Evidence
status: current
authority: reviewed_memory
evidence_level: test_confirmed
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Missing Test Evidence

No evidence section here.
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("missing-test-evidence.md");
    expect(result.errors.join("\n")).toContain("evidence_level=test_confirmed требует секцию ## Свидетельства из тестов с записями в формате");
  });

  it("passes: reviewed_doc without evidence section", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "reviewed-doc-ok.md"),
      `---
entity_type: module
id: reviewed-doc-ok
title: Reviewed Doc
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Reviewed Doc

No evidence section needed.
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const rdErrors = result.errors.filter((e) => e.includes("reviewed-doc-ok.md"));
    expect(rdErrors).toEqual([]);
  });

  it("validate errors: evidence bullet without file:line pattern", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "bad-evidence-bullet.md"),
      `---
entity_type: module
id: bad-evidence-bullet
title: Bad Evidence Bullet
status: current
authority: reviewed_memory
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Bad Evidence Bullet

## Свидетельства из кода

- TODO
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("bad-evidence-bullet.md");
    expect(result.errors.join("\n")).toContain("с записями в формате 'описание at");
  });

  it("validate errors: evidence bullet generic content", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "generic-evidence.md"),
      `---
entity_type: module
id: generic-evidence
title: Generic Evidence
status: current
authority: reviewed_memory
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Generic Evidence

## Свидетельства из кода

- checked
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("generic-evidence.md");
    expect(result.errors.join("\n")).toContain("с записями в формате 'описание at");
  });

  it("validate passes: proper evidence entry", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "proper-evidence.md"),
      `---
entity_type: module
id: proper-evidence
title: Proper Evidence
status: current
authority: reviewed_memory
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Proper Evidence

## Свидетельства из кода

- Filter at internal/registry/access_filter.go:12 (FilterCardsForCaller)
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const evErrors = result.errors.filter((e) => e.includes("proper-evidence.md"));
    expect(evErrors).toEqual([]);
  });

  it("validate errors: test evidence without file:line", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "bad-test-evidence.md"),
      `---
entity_type: module
id: bad-test-evidence
title: Bad Test Evidence
status: current
authority: reviewed_memory
evidence_level: test_confirmed
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Bad Test Evidence

## Свидетельства из тестов

- checked
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("bad-test-evidence.md");
    expect(result.errors.join("\n")).toContain("с записями в формате 'описание at");
  });

  it("validate passes: proper test evidence", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "proper-test-evidence.md"),
      `---
entity_type: module
id: proper-test-evidence
title: Proper Test Evidence
status: current
authority: reviewed_memory
evidence_level: test_confirmed
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Proper Test Evidence

## Свидетельства из тестов

- Test TestFilter at tests/registry/filter_test.go:8 covers filtering
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const evErrors = result.errors.filter((e) => e.includes("proper-test-evidence.md"));
    expect(evErrors).toEqual([]);
  });

  it("errors: heuristic_match + status=current → ERROR (requires LLM verification)", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "heuristic-current.md"),
      `---
entity_type: module
id: heuristic-current
title: Heuristic Current
status: current
authority: reviewed_memory
evidence_level: heuristic_match
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Heuristic Current

## Ответственность
Test module.
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("heuristic_match");
    expect(result.errors.join("\n")).toContain("requires code_confirmed or test_confirmed");
  });

  it("checkEnrichmentStatus: detects unenriched memory bank (all needs_review)", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "enrichment-test-"));
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "unenriched.md"),
      `---
entity_type: module
id: unenriched
title: Unenriched
status: needs_review
authority: reviewed_memory
evidence_level: heuristic_match
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-11
review_required: true
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Unenriched
`,
      "utf8",
    );
    const { loadMemoryCards } = await import("../src/core/loadMemory.js");
    const cards = await loadMemoryCards({ root });
    const status = checkEnrichmentStatus(cards);
    expect(status.enriched).toBe(false);
    expect(status.needsReviewCount).toBe(1);
    expect(status.currentCount).toBe(0);
    expect(status.heuristicCount).toBe(1);
    await rm(root, { recursive: true, force: true });
  });

  it("warns on unknown frontmatter field (typo detection)", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "validate-typo-"));
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "typo.md"),
      `---
entity_type: module
id: typo-card
title: Typo
status: needs_review
authority: reviewed_memory
evidence_level: inferred
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-11
review_required: true
knowledge_types:
  - current_behavior
evindence_level: code_confirmed
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Typo
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const typoWarnings = result.warnings.filter((w) => w.includes("evindence_level"));
    expect(typoWarnings.length).toBe(1);
    expect(typoWarnings[0]).toContain("did you mean 'evidence_level'?");
    await rm(root, { recursive: true, force: true });
  });

  it("no warning for agent_summary frontmatter field", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "validate-agent-summary-"));
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "with-agent-summary.md"),
      `---
entity_type: module
id: agent-summary-card
title: Agent Summary Card
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-15
review_required: false
knowledge_types:
  - current_behavior
agent_summary: This module handles access filtering for card registries.
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Agent Summary Card

## Ответственность
content
## Не входит в ответственность
content
## Текущее поведение
content
## Связанные сценарии
content
## Связанные решения
content
## Свидетельства из кода
content
## Свидетельства из тестов
content
## Известные риски
content
## Открытые вопросы
content
## Почему такие границы
content
## Публичный интерфейс
content
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const unknownWarnings = result.warnings.filter((w) => w.includes("agent_summary") && w.includes("unknown frontmatter"));
    expect(unknownWarnings.length).toBe(0);
    await rm(root, { recursive: true, force: true });
  });

  it("errors for decision without required sections → section errors present", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/decisions");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "missing-sections.md"),
      `---
entity_type: decision
id: missing-sections-decision
title: Missing Sections Decision
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - design_rationale
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Missing Sections

No required sections at all.
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    const sectionErrors = result.errors.filter((e) => e.includes("missing-sections-decision") && e.includes("missing required section"));
    expect(sectionErrors.length).toBeGreaterThan(0);
  });

  it("strict-warnings mode: missing recommended sections become errors", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    // A module card with all required sections but no recommended ones
    await writeFile(
      path.join(dir, "module-no-recommended.md"),
      `---
entity_type: module
id: module-no-recommended
title: Module No Recommended
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Module No Recommended

## Ответственность
content
## Не входит в ответственность
content
## Текущее поведение
content
## Связанные сценарии
content
## Связанные решения
content
## Свидетельства из кода
content
## Свидетельства из тестов
content
## Известные риски
content
## Открытые вопросы
content
## Почему такие границы
content
## Публичный интерфейс
content
`,
      "utf8",
    );

    // Without strict-warnings: warnings only
    const normalResult = await validateMemory({ root, strictWarnings: false });
    const modWarnings = normalResult.warnings.filter((w) => w.includes("module-no-recommended") && w.includes("missing recommended section"));
    expect(modWarnings.length).toBeGreaterThan(0);
    const normalModErrors = normalResult.errors.filter((e) => e.includes("module-no-recommended"));
    expect(normalModErrors.length).toBe(0);

    // With strict-warnings: warnings → errors
    const strictResult = await validateMemory({ root, strictWarnings: true });
    const strictModErrors = strictResult.errors.filter((e) => e.includes("module-no-recommended") && e.includes("missing recommended section"));
    expect(strictModErrors.length).toBeGreaterThan(0);
  });

  it("validate --require-source-coverage without source-coverage.json -> error", async () => {
    const root = await createTempProject();
    const result = await validateMemory({ root, requireSourceCoverage: true });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("source-coverage.json not found"))).toBe(true);
  });

  it("validate --require-source-coverage with valid coverage -> ok", async () => {
    const root = await createTempProject();
    const memoryRoot = path.join(root, ".ai/memory");

    // Create a valid source-coverage.json (empty entries = no violations)
    const coverage = {
      entries: [],
      counts: {},
    };
    await writeFile(
      path.join(memoryRoot, "source-coverage.json"),
      JSON.stringify(coverage, null, 2),
      "utf8",
    );
    const result = await validateMemory({ root, requireSourceCoverage: true });
    // coverage has no entries, so no validation errors from validateSourceCoverage
    expect(result.errors.some((e) => e.includes("source-coverage"))).toBe(false);
  });

  it("validate --require-source-coverage with invalid coverage -> error", async () => {
    const root = await createTempProject();
    const memoryRoot = path.join(root, ".ai/memory");

    // Create invalid source-coverage.json (unknown disposition after triage)
    const coverage = {
      entries: [
        { path: "docs/api.md", disposition: "unknown", targetCards: [] },
      ],
      counts: { unknown: 1 },
    };
    await writeFile(
      path.join(memoryRoot, "source-coverage.json"),
      JSON.stringify(coverage, null, 2),
      "utf8",
    );
    const result = await validateMemory({ root, requireSourceCoverage: true });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("unknown"))).toBe(true);
  });

  // ── C4: max-errors truncation ──────────────────────────────────────────

  it("validate --max-errors 5 → truncation after 5 errors", async () => {
    const root = await createTempProject();
    const modulesDir = path.join(root, ".ai", "memory", "modules");
    await mkdir(modulesDir, { recursive: true });

    // Create 10 cards that each produce an error (heuristic_match + status=current)
    for (let i = 0; i < 10; i++) {
      await writeFile(
        path.join(modulesDir, `bad-module-${i}.md`),
        `---
entity_type: module
id: bad-module-${i}
title: Bad Module ${i}
status: current
authority: reviewed_memory
evidence_level: heuristic_match
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Bad Module ${i}

## Ответственность
content
## Не входит в ответственность
content
## Текущее поведение
content
## Связанные сценарии
content
## Связанные решения
content
## Свидетельства из кода
content
## Свидетельства из тестов
content
## Известные риски
content
## Открытые вопросы
content
## Почему такие границы
content
## Публичный интерфейс
content
`,
        "utf8",
      );
    }

    const result = await validateMemory({ root, maxErrors: 5 });
    // Errors should be truncated at 5 + a truncation message
    expect(result.errors.length).toBeLessThanOrEqual(7); // 5 errors + 1 truncation msg
    expect(result.errors.some((e) => e.includes("truncated at 5 errors"))).toBe(true);
  });

  // ── C4: structural checks (checkContract) ──────────────────────────────

  it("validate on missing top-level file → error with checkContract", async () => {
    const root = await createTempProject();
    // Delete MEMORY.md to trigger missing top-level file error
    await rm(path.join(root, ".ai", "memory", "MEMORY.md"));
    const result = await validateMemory({ root, checkContract: true });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Missing required top-level file") && e.includes("MEMORY.md"))).toBe(true);
  });

  it("validate on missing subdir → error with checkContract", async () => {
    const root = await createTempProject();
    // Delete modules/ subdir to trigger missing subdirectory error
    await rm(path.join(root, ".ai", "memory", "modules"), { recursive: true });
    const result = await validateMemory({ root, checkContract: true });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Missing required subdirectory") && e.includes("modules"))).toBe(true);
  });

  // ── C4: broken markdown links (checkContract) ──────────────────────────

  it("validate on broken markdown link → error with checkContract", async () => {
    const root = await createTempProject();
    const modulesDir = path.join(root, ".ai", "memory", "modules");
    await mkdir(modulesDir, { recursive: true });
    await writeFile(
      path.join(modulesDir, "broken-link.md"),
      `---
entity_type: module
id: broken-link
title: Broken Link
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Broken Link

Check [this](nonexistent.md) file for details.

## Ответственность
content
## Не входит в ответственность
content
## Текущее поведение
content
## Связанные сценарии
content
## Связанные решения
content
## Свидетельства из кода
content
## Свидетельства из тестов
content
## Известные риски
content
## Открытые вопросы
content
## Почему такие границы
content
## Публичный интерфейс
content
`,
      "utf8",
    );
    const result = await validateMemory({ root, checkContract: true });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("broken markdown link"))).toBe(true);
  });

  // ── C4: long code blocks warning ───────────────────────────────────────

  it("validate on code block > 25 lines → warning", async () => {
    const root = await createTempProject();
    const modulesDir = path.join(root, ".ai", "memory", "modules");
    await mkdir(modulesDir, { recursive: true });

    // Build a 30-line code block
    const codeLines = Array.from({ length: 30 }, (_, i) => `  // line ${i + 1}`).join("\n");
    await writeFile(
      path.join(modulesDir, "long-code-block.md"),
      `---
entity_type: module
id: long-code-block
title: Long Code Block
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Long Code Block

\`\`\`typescript
${codeLines}
\`\`\`

## Ответственность
content
## Не входит в ответственность
content
## Текущее поведение
content
## Связанные сценарии
content
## Связанные решения
content
## Свидетельства из кода
content
## Свидетельства из тестов
content
## Известные риски
content
## Открытые вопросы
content
## Почему такие границы
content
## Публичный интерфейс
content
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const codeBlockWarnings = result.warnings.filter((w) => w.toLowerCase().includes("code block"));
    expect(codeBlockWarnings.length).toBeGreaterThan(0);
    expect(codeBlockWarnings[0]).toContain("lines");
  });

  // ── C4: MODULES.md tier split warning ──────────────────────────────────

  it("validate on MODULES.md without tier split → warning", async () => {
    const root = await createTempProject();
    // Overwrite MODULES.md with content that has no production/demo split
    await writeFile(
      path.join(root, ".ai", "memory", "MODULES.md"),
      `---
entity_type: top-level
id: modules
title: Module Overview
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: false
---

# Module Overview

Here are the modules.
`,
      "utf8",
    );
    const result = await validateMemory({ root, checkContract: true });
    const tierWarnings = result.warnings.filter((w) => w.toLowerCase().includes("production") && w.toLowerCase().includes("demo"));
    expect(tierWarnings.length).toBeGreaterThan(0);
    expect(tierWarnings[0]).toContain("tier split");
  });

  // ── Cross-link validation ──────────────────────────────────────────────

  it("current module with empty cross-links and cross_link_attempts=0 → warning, no error", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai", "memory", "modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "empty-crosslinks.md"),
      `---
entity_type: module
id: empty-crosslinks
title: Empty Crosslinks
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
cross_link_attempts: 0
has_broken_relations: false
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Empty Crosslinks

## Ответственность
content
## Не входит в ответственность
content
## Текущее поведение
content
## Связанные сценарии
content
## Связанные решения
content
## Свидетельства из кода
content
## Свидетельства из тестов
content
## Известные риски
content
## Открытые вопросы
content
## Почему такие границы
content
## Публичный интерфейс
content
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const clWarnings = result.warnings.filter((w) => w.includes("empty-crosslinks") && w.toLowerCase().includes("empty cross-links"));
    expect(clWarnings.length).toBeGreaterThan(0);
    const clErrors = result.errors.filter((e) => e.includes("empty-crosslinks") && e.toLowerCase().includes("empty cross-links"));
    expect(clErrors.length).toBe(0);
  });

  it("current scenario with empty related_modules and cross_link_attempts=1 → warning", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai", "memory", "scenarios");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "empty-scenario-links.md"),
      `---
entity_type: scenario
id: empty-scenario-links
title: Empty Scenario Links
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
cross_link_attempts: 1
has_broken_relations: false
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Empty Scenario Links

## Сценарий
content
## Входные данные
content
## Ожидаемый результат
content
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const clWarnings = result.warnings.filter((w) => w.includes("empty-scenario-links") && w.toLowerCase().includes("empty cross-links"));
    expect(clWarnings.length).toBeGreaterThan(0);
    expect(clWarnings[0]).toContain("scenario");
  });

  it("current decision with empty cross-links and cross_link_attempts=2 → error", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai", "memory", "decisions");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "empty-decision-links.md"),
      `---
entity_type: decision
id: empty-decision-links
title: Empty Decision Links
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - design_rationale
cross_link_attempts: 2
has_broken_relations: false
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Empty Decision Links

## Суть решения
content
## Обоснование
content
## Влияние
content
## Риски
content
## Связанные модули
content
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const clErrors = result.errors.filter((e) => e.includes("empty-decision-links") && e.toLowerCase().includes("empty cross-links"));
    expect(clErrors.length).toBeGreaterThan(0);
    expect(clErrors[0]).toContain("atlas-analyst cross-linking pass");
  });

  it("current decision with cross_link_attempts=2 but has_broken_relations=true → no cross-link error", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai", "memory", "decisions");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "broken-relations-decision.md"),
      `---
entity_type: decision
id: broken-relations-decision
title: Broken Relations Decision
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - design_rationale
cross_link_attempts: 2
has_broken_relations: true
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Broken Relations Decision

## Суть решения
content
## Обоснование
content
## Влияние
content
## Риски
content
## Связанные модули
content
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const clErrors = result.errors.filter((e) => e.includes("broken-relations-decision") && e.toLowerCase().includes("empty cross-links"));
    expect(clErrors.length).toBe(0);
  });

  it("current module with populated related_scenarios → no cross-link warning", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai", "memory", "modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "populated-crosslinks.md"),
      `---
entity_type: module
id: populated-crosslinks
title: Populated Crosslinks
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
related_scenarios:
  - a2a-agent-discovery
cross_link_attempts: 0
has_broken_relations: false
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Populated Crosslinks

## Ответственность
content
## Не входит в ответственность
content
## Текущее поведение
content
## Связанные сценарии
content
## Связанные решения
content
## Свидетельства из кода
content
## Свидетельства из тестов
content
## Известные риски
content
## Открытые вопросы
content
## Почему такие границы
content
## Публичный интерфейс
content
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const clWarnings = result.warnings.filter((w) => w.includes("populated-crosslinks") && w.toLowerCase().includes("empty cross-links"));
    expect(clWarnings.length).toBe(0);
    const clErrors = result.errors.filter((e) => e.includes("populated-crosslinks") && e.toLowerCase().includes("empty cross-links"));
    expect(clErrors.length).toBe(0);
  });

  it("non-current card (needs_review) with empty cross-links → no warning/error", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai", "memory", "modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "needs-review-no-links.md"),
      `---
entity_type: module
id: needs-review-no-links
title: Needs Review No Links
status: needs_review
authority: reviewed_memory
evidence_level: heuristic_match
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-08
review_required: true
knowledge_types:
  - current_behavior
cross_link_attempts: 3
has_broken_relations: false
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Needs Review No Links

## Ответственность
content
## Не входит в ответственность
content
## Текущее поведение
content
## Связанные сценарии
content
## Связанные решения
content
## Свидетельства из кода
content
## Свидетельства из тестов
content
## Известные риски
content
## Открытые вопросы
content
## Почему такие границы
content
## Публичный интерфейс
content
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const clWarnings = result.warnings.filter((w) => w.includes("needs-review-no-links") && w.toLowerCase().includes("empty cross-links"));
    expect(clWarnings.length).toBe(0);
    const clErrors = result.errors.filter((e) => e.includes("needs-review-no-links") && e.toLowerCase().includes("empty cross-links"));
    expect(clErrors.length).toBe(0);
  });

  it("current card without agent_summary → warning", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai", "memory", "modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "no-agent-summary.md"),
      `---
entity_type: module
id: no-agent-summary
title: No Agent Summary
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
related_scenarios:
  - a2a-agent-discovery
cross_link_attempts: 0
has_broken_relations: false
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# No Agent Summary

## Ответственность
content
## Не входит в ответственность
content
## Текущее поведение
content
## Связанные сценарии
content
## Связанные решения
content
## Свидетельства из кода
content
## Свидетельства из тестов
content
## Известные риски
content
## Открытые вопросы
content
## Почему такие границы
content
## Публичный интерфейс
content
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const asWarnings = result.warnings.filter((w) => w.includes("no-agent-summary") && w.includes("agent_summary"));
    expect(asWarnings.length).toBeGreaterThan(0);
    expect(asWarnings[0]).toContain("add 1-2 sentence summary for agent use");
  });

  it("current card with whitespace-only agent_summary → warning", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai", "memory", "modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "ws-agent-summary.md"),
      `---
entity_type: module
id: ws-agent-summary
title: Whitespace Agent Summary
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
agent_summary: "   "
related_scenarios:
  - a2a-agent-discovery
cross_link_attempts: 0
has_broken_relations: false
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Whitespace Agent Summary

## Ответственность
content
## Не входит в ответственность
content
## Текущее поведение
content
## Связанные сценарии
content
## Связанные решения
content
## Свидетельства из кода
content
## Свидетельства из тестов
content
## Известные риски
content
## Открытые вопросы
content
## Почему такие границы
content
## Публичный интерфейс
content
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const asWarnings = result.warnings.filter((w) => w.includes("ws-agent-summary") && w.includes("agent_summary"));
    expect(asWarnings.length).toBeGreaterThan(0);
    expect(asWarnings[0]).toContain("add 1-2 sentence summary for agent use");
  });
});
