import { describe, it, expect } from "vitest";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createTempProject } from "./helpers.js";
import { updateMemoryCard } from "../src/core/updateMemory.js";

describe("updateMemoryCard evidence guards", () => {
  it("throws: set code_confirmed without evidence section in body", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "card-1.md"),
      `---
entity_type: module
id: card-1
title: Card 1
status: current
authority: reviewed_memory
evidence_level: unknown
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

# Card 1

Some body content without evidence.
`,
      "utf8",
    );

    await expect(
      updateMemoryCard("card-1", { root, fields: { evidence_level: "code_confirmed" } }),
    ).rejects.toThrow(/Code evidence/);
  });

  it("succeeds: set code_confirmed with evidence section in new body", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "card-2.md"),
      `---
entity_type: module
id: card-2
title: Card 2
status: current
authority: reviewed_memory
evidence_level: unknown
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

# Card 2

Some body content.
`,
      "utf8",
    );

    const bodyWithEvidence = "# Card 2\n\n## Code evidence\n\n- Function X at file.ts:12\n";
    const result = await updateMemoryCard("card-2", {
      root,
      fields: { evidence_level: "code_confirmed" },
      body: bodyWithEvidence,
    });
    expect(result.updated).toBe(true);
  });

  it("succeeds: set code_confirmed when existing body already has section", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "card-3.md"),
      `---
entity_type: module
id: card-3
title: Card 3
status: current
authority: reviewed_memory
evidence_level: unknown
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

# Card 3

## Code evidence

- Existing function at file.ts:1
`,
      "utf8",
    );

    const result = await updateMemoryCard("card-3", {
      root,
      fields: { evidence_level: "code_confirmed" },
    });
    expect(result.updated).toBe(true);
  });

  it("succeeds: set reviewed_doc without section", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "card-4.md"),
      `---
entity_type: module
id: card-4
title: Card 4
status: current
authority: reviewed_memory
evidence_level: unknown
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

# Card 4

No evidence section.
`,
      "utf8",
    );

    const result = await updateMemoryCard("card-4", {
      root,
      fields: { evidence_level: "reviewed_doc" },
    });
    expect(result.updated).toBe(true);
  });

  it("succeeds: set test_confirmed with ## Test evidence section", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "card-5.md"),
      `---
entity_type: module
id: card-5
title: Card 5
status: current
authority: reviewed_memory
evidence_level: unknown
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

# Card 5

Some body.
`,
      "utf8",
    );

    const bodyWithTestEvidence = "# Card 5\n\n## Test evidence\n\n- Test X at test.ts:10\n";
    const result = await updateMemoryCard("card-5", {
      root,
      fields: { evidence_level: "test_confirmed" },
      body: bodyWithTestEvidence,
    });
    expect(result.updated).toBe(true);
  });

  it("throws: set test_confirmed without ## Test evidence", async () => {
    const root = await createTempProject();
    const dir = path.join(root, ".ai/memory/modules");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "card-6.md"),
      `---
entity_type: module
id: card-6
title: Card 6
status: current
authority: reviewed_memory
evidence_level: unknown
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

# Card 6

No test evidence here.
`,
      "utf8",
    );

    await expect(
      updateMemoryCard("card-6", { root, fields: { evidence_level: "test_confirmed" } }),
    ).rejects.toThrow(/Test evidence/);
  });
});
