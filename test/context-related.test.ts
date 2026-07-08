import { describe, expect, it } from "vitest";
import { createTempProject } from "./helpers.js";
import { loadMemoryCards } from "../src/core/loadMemory.js";
import { getRelatedCards } from "../src/core/relations.js";
import { buildMemoryContext } from "../src/core/context.js";

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
});
