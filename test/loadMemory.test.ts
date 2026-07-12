import { describe, expect, it } from "vitest";
import path from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { loadMemoryCards, loadMemoryCardsBestEffort, LoadMemoryError } from "../src/core/loadMemory.js";

describe("loadMemoryCards resilience", () => {
  it("throws LoadMemoryError on broken frontmatter but preserves valid cards", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loadmem-broken-"));
    const memDir = path.join(root, ".ai/memory/modules");
    await mkdir(memDir, { recursive: true });

    // Valid card
    await writeFile(
      path.join(memDir, "valid.md"),
      `---
entity_type: module
id: valid-card
title: Valid
status: needs_review
authority: reviewed_memory
evidence_level: inferred
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
  requires_code_check_before_change: true
---

# Valid
`,
      "utf8",
    );

    // Broken card — invalid entity_type
    await writeFile(
      path.join(memDir, "broken.md"),
      `---
entity_type: modul
id: broken-card
title: Broken
status: needs_review
authority: reviewed_memory
evidence_level: inferred
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
  requires_code_check_before_change: true
---

# Broken
`,
      "utf8",
    );

    try {
      await loadMemoryCards({ root });
      expect.fail("should have thrown LoadMemoryError");
    } catch (err) {
      expect(err).toBeInstanceOf(LoadMemoryError);
      const e = err as LoadMemoryError;
      expect(e.errors.length).toBe(1);
      expect(e.errors[0].relativePath).toContain("broken.md");
      expect(e.validCards.length).toBe(1);
      expect(e.validCards[0].meta.id).toBe("valid-card");
    }

    await rm(root, { recursive: true, force: true });
  });

  it("loads all cards when frontmatter is valid", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loadmem-ok-"));
    const memDir = path.join(root, ".ai/memory/modules");
    await mkdir(memDir, { recursive: true });

    for (let i = 0; i < 3; i++) {
      await writeFile(
        path.join(memDir, `card-${i}.md`),
        `---
entity_type: module
id: card-${i}
title: Card ${i}
status: needs_review
authority: reviewed_memory
evidence_level: inferred
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
  requires_code_check_before_change: true
---

# Card ${i}
`,
        "utf8",
      );
    }

    const cards = await loadMemoryCards({ root });
    expect(cards.length).toBe(3);
    expect(cards.map((c) => c.meta.id).sort()).toEqual(["card-0", "card-1", "card-2"]);

    await rm(root, { recursive: true, force: true });
  });

  it("loadMemoryCardsBestEffort returns valid cards when some are broken", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loadmem-besteffort-"));
    const memDir = path.join(root, ".ai/memory/modules");
    await mkdir(memDir, { recursive: true });

    // Valid card
    await writeFile(
      path.join(memDir, "good.md"),
      `---
entity_type: module
id: good-card
title: Good
status: needs_review
authority: reviewed_memory
evidence_level: inferred
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
  requires_code_check_before_change: true
---

# Good
`,
      "utf8",
    );

    // Broken card — invalid status
    await writeFile(
      path.join(memDir, "bad.md"),
      `---
entity_type: module
id: bad-card
title: Bad
status: bogus
authority: reviewed_memory
evidence_level: inferred
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
  requires_code_check_before_change: true
---

# Bad
`,
      "utf8",
    );

    // Best-effort: should return valid card, not throw
    const cards = await loadMemoryCardsBestEffort({ root });
    expect(cards.length).toBe(1);
    expect(cards[0].meta.id).toBe("good-card");

    await rm(root, { recursive: true, force: true });
  });

  it("loadMemoryCardsBestEffort returns all cards when none broken", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loadmem-besteffort-ok-"));
    const memDir = path.join(root, ".ai/memory/modules");
    await mkdir(memDir, { recursive: true });

    await writeFile(
      path.join(memDir, "ok.md"),
      `---
entity_type: module
id: ok-card
title: OK
status: needs_review
authority: reviewed_memory
evidence_level: inferred
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
  requires_code_check_before_change: true
---

# OK
`,
      "utf8",
    );

    const cards = await loadMemoryCardsBestEffort({ root });
    expect(cards.length).toBe(1);
    expect(cards[0].meta.id).toBe("ok-card");

    await rm(root, { recursive: true, force: true });
  });
});