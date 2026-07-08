import { describe, expect, it } from "vitest";
import { createTempProject, loadSynapseMini } from "./helpers.js";
import { loadMemoryCards } from "../src/core/loadMemory.js";
import { getRelatedCards } from "../src/core/relations.js";
import { buildMemoryContext } from "../src/core/context.js";
import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";

describe("relations and context", () => {
  it("resolves direct and reverse relations from frontmatter", async () => {
    const root = await createTempProject();
    const cards = await loadMemoryCards({ root });
    const related = getRelatedCards(cards, "agent-tool-registry");

    expect(related.card?.meta.title).toBe("Agent & Tool Registry");
    expect(related.direct.map((card) => card.meta.id)).toContain("registry-is-discovery-not-orchestration");
    expect(related.direct.map((card) => card.meta.id)).toContain("a2a-agent-discovery");
    expect(related.reverse.map((card) => card.meta.id)).toContain("registry-is-discovery-not-orchestration");
  });

  it("builds a useful context pack for a coding-agent task", async () => {
    const root = await createTempProject();
    const context = await buildMemoryContext("почему registry не должен выбирать агента и где менять agent cards", { root, limit: 4 });

    expect(context.markdown).toContain("Memory context pack");
    expect(context.markdown).toContain("Agent & Tool Registry");
    expect(context.markdown).toContain("Registry is discovery, not orchestration");
    expect(context.codeRefs).toContain("internal/registry");
    expect(context.testRefs).toContain("tests/agent-registry");
  });

  it("loads source priority from config and renders in context markdown", async () => {
    const root = loadSynapseMini();
    const context = await buildMemoryContext("agent registry", { root, limit: 4 });

    expect(context.markdown).toContain("## Source priority");
    expect(context.markdown).toContain("current-code");
    expect(context.markdown).toContain("current-tests");
    expect(context.markdown).toContain("## Source rules");
  });

  it("includes conflicts and open questions in context from reconciliation files", async () => {
    const root = await createTempProject();
    // Write a conflicts.md with substantive content
    const reconciliationDir = path.join(root, ".ai", "memory", "reconciliation");
    await mkdir(reconciliationDir, { recursive: true });
    await writeFile(
      path.join(reconciliationDir, "conflicts.md"),
      `---
entity_type: conflict
id: test-conflict
title: Test Conflict
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-09
review_required: false
knowledge_types:
  - conflict
product_areas: []
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Test Conflict

There is a conflict between the new spec and current implementation regarding agent filtering.
The new spec says filtering should happen at runtime but the code does it at discovery time.`,
      "utf8",
    );
    const context = await buildMemoryContext("test query", { root });

    expect(context.markdown).toContain("## Conflicts and open questions");
    expect(context.markdown).toContain("conflict between");
  });

  it("includes usage policy section with per-card fields in context", async () => {
    const root = loadSynapseMini();
    const context = await buildMemoryContext("agent registry", { root, limit: 4 });

    expect(context.markdown).toContain("## Usage policy");
    expect(context.markdown).toContain("agent-tool-registry");
    expect(context.markdown).toContain("current_behavior=");
    expect(context.markdown).toContain("code_gen=");
  });
});
