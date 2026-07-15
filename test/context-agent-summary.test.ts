import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildMemoryContext } from "../src/core/context.js";
import { contextMemory } from "../src/commands/context.js";

function makeCardContent(overrides: { agent_summary?: string } = {}) {
  const summaryLine = overrides.agent_summary ? `agent_summary: "${overrides.agent_summary}"\n` : "";
  const yaml = `---
entity_type: module
id: test-card
title: Test Card
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-15
review_required: false
${summaryLine}knowledge_types:
  - design_rationale
product_areas: []
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: false
  requires_warning: false
---

# Test Card

Some body content for the test card.
`;
  return yaml;
}

async function createProjectWithCard(cardContent: string) {
  const root = await mkdtemp(path.join(tmpdir(), "atlas-agent-summary-"));
  const memoryDir = path.join(root, ".ai", "memory", "modules");
  await mkdir(memoryDir, { recursive: true });
  await writeFile(
    path.join(memoryDir, "test-card.md"),
    cardContent,
    "utf8",
  );
  // Minimal source-priority config
  const configDir = path.join(root, ".ai", "atlas", "config");
  await mkdir(configDir, { recursive: true });
  await writeFile(
    path.join(configDir, "source-priority.yaml"),
    "priority:\n  - current-code\nrules: []\n",
    "utf8",
  );
  return root;
}

describe("context agent_summary", () => {
  it("renders Agent summary in compact excerpts when present", async () => {
    const cardContent = makeCardContent({ agent_summary: "Short summary for agents." });
    const root = await createProjectWithCard(cardContent);
    const context = await buildMemoryContext("test card", { root, limit: 4 });

    expect(context.markdown).toContain("Agent summary: Short summary for agents.");
    expect(context.markdown).toContain("## Compact excerpts");
    // Verify the summary appears in the compact excerpt for the right card
    const summaryIdx = context.markdown.indexOf("Agent summary:");
    const titleIdx = context.markdown.indexOf("### Test Card");
    const excerptIdx = context.markdown.indexOf("Some body content");
    expect(summaryIdx).toBeGreaterThanOrEqual(0);
    expect(summaryIdx).toBeGreaterThan(titleIdx);
    expect(summaryIdx).toBeLessThan(excerptIdx);
  });

  it("omits Agent summary label when card has no agent_summary", async () => {
    const cardContent = makeCardContent();
    const root = await createProjectWithCard(cardContent);
    const context = await buildMemoryContext("test card", { root, limit: 4 });

    expect(context.markdown).not.toContain("Agent summary: undefined");
    expect(context.markdown).not.toContain("Agent summary:");
    expect(context.markdown).toContain("## Compact excerpts");
  });

  it("omits Agent summary label when agent_summary is empty string", async () => {
    const cardContent = makeCardContent({ agent_summary: "  " });
    const root = await createProjectWithCard(cardContent);
    const context = await buildMemoryContext("test card", { root, limit: 4 });

    expect(context.markdown).not.toContain("Agent summary: undefined");
    expect(context.markdown).not.toContain("Agent summary:");
    expect(context.markdown).toContain("## Compact excerpts");
  });

  it("includes agent_summary in JSON output when present", async () => {
    const cardContent = makeCardContent({ agent_summary: "JSON summary test." });
    const root = await createProjectWithCard(cardContent);
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);
    try {
      await contextMemory("test card", { root, limit: 4, json: true });
    } finally {
      console.log = origLog;
    }

    const output = JSON.parse(logs[0]);
    const selectedCard = output.selected[0];
    expect(selectedCard.agent_summary).toBe("JSON summary test.");
  });

  it("omits agent_summary from JSON output when not present", async () => {
    const cardContent = makeCardContent();
    const root = await createProjectWithCard(cardContent);
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);
    try {
      await contextMemory("test card", { root, limit: 4, json: true });
    } finally {
      console.log = origLog;
    }

    const output = JSON.parse(logs[0]);
    const selectedCard = output.selected[0];
    expect(selectedCard.agent_summary).toBeUndefined();
  });

  it("omits agent_summary from JSON output when whitespace-only", async () => {
    const cardContent = makeCardContent({ agent_summary: "   " });
    const root = await createProjectWithCard(cardContent);
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);
    try {
      await contextMemory("test card", { root, limit: 4, json: true });
    } finally {
      console.log = origLog;
    }

    const output = JSON.parse(logs[0]);
    const selectedCard = output.selected[0];
    expect(selectedCard.agent_summary).toBeUndefined();
  });

  it("does not produce undefined in compact excerpts for cards without agent_summary", async () => {
    const cardContent = makeCardContent();
    const root = await createProjectWithCard(cardContent);
    const context = await buildMemoryContext("test card", { root, limit: 4 });

    expect(context.markdown).not.toContain("Agent summary: undefined");
    const excerptIdx = context.markdown.indexOf("## Compact excerpts");
    expect(excerptIdx).toBeGreaterThanOrEqual(0);
    const afterExcerpt = context.markdown.slice(excerptIdx);
    expect(afterExcerpt).not.toMatch(/Agent summary:\s*$/m);
  });
});
