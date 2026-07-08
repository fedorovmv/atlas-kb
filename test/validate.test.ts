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
evidence_level: code_confirmed
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
`,
      "utf8",
    );
    const result = await validateMemory({ root });
    const codeConfirmedErrors = result.errors.filter((e) => e.includes("code-confirmed-current.md"));
    expect(codeConfirmedErrors).toEqual([]);
  });
});
