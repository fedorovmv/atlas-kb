import { describe, expect, it } from "vitest";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createTempProject } from "./helpers.js";
import { validateMemory } from "../src/core/validate.js";

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

## Code evidence

- validateMemory function at src/core/validate.ts:17 implements evidence checks
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const codeConfirmedErrors = result.errors.filter((e) => e.includes("code-confirmed-current.md"));
    expect(codeConfirmedErrors).toEqual([]);
  });

  it("errors: code_confirmed without ## Code evidence section", async () => {
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
    expect(result.errors.join("\n")).toContain("evidence_level=code_confirmed requires ## Code evidence section with entries in format");
  });

  it("passes: code_confirmed with ## Code evidence section", async () => {
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

## Code evidence

- FilterCardsForCaller function at internal/registry/access_filter.go:12
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const evErrors = result.errors.filter((e) => e.includes("has-evidence.md"));
    expect(evErrors).toEqual([]);
  });

  it("errors: test_confirmed without ## Test evidence section", async () => {
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
    expect(result.errors.join("\n")).toContain("evidence_level=test_confirmed requires ## Test evidence section with entries in format");
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

## Code evidence

- TODO
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("bad-evidence-bullet.md");
    expect(result.errors.join("\n")).toContain("in format 'description at");
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

## Code evidence

- checked
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("generic-evidence.md");
    expect(result.errors.join("\n")).toContain("in format 'description at");
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

## Code evidence

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

## Test evidence

- checked
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("bad-test-evidence.md");
    expect(result.errors.join("\n")).toContain("in format 'description at");
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

## Test evidence

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

## Responsibility
Test module.
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("heuristic_match");
    expect(result.errors.join("\n")).toContain("requires code_confirmed or test_confirmed");
  });
});
