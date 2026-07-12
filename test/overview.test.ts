import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { renderOverview } from "../src/core/overview.js";

let tmpDir: string;
beforeEach(async () => { tmpDir = await mkdtemp(path.join(os.tmpdir(), "f3-test-")); });
afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

async function createCard(root: string, id: string, type: string, title: string, status = "current") {
  const memDir = path.join(root, ".ai", "memory");
  await mkdir(memDir, { recursive: true });
  const fm = `---
entity_type: ${type}
id: ${id}
title: ${title}
status: ${status}
authority: reviewed_memory
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: "2026-07-12"
review_required: false
knowledge_types: ["current_behavior"]
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---
# ${title}
Content.
`;
  await writeFile(path.join(memDir, `${id}.md`), fm, "utf8");
}

describe("renderOverview", () => {
  it("OVERVIEW.md created with all sections", async () => {
    await createCard(tmpDir, "mod-1", "module", "Module 1");
    const result = await renderOverview({ root: tmpDir });
    expect(existsSync(result.overviewPath)).toBe(true);
    const content = await readFile(result.overviewPath, "utf8");
    expect(content).toContain("# Memory Overview");
    expect(content).toContain("## Route reasons");
    expect(content).toContain("## OpenSpec");
    expect(content).toContain("## Scenario matrix");
    expect(content).toContain("## Test obligations");
    expect(content).toContain("## Tasks");
    expect(content).toContain("## Verification evidence");
    expect(content).toContain("## Reviews");
    expect(content).toContain("## Session lanes");
    expect(content).toContain("## Knowledge impact");
  });

  it("empty section → N/A", async () => {
    const result = await renderOverview({ root: tmpDir });
    const content = await readFile(result.overviewPath, "utf8");
    expect(content).toContain("N/A");
  });

  it("overview-sources.json contains hashes", async () => {
    await createCard(tmpDir, "mod-1", "module", "Module 1");
    const result = await renderOverview({ root: tmpDir });
    expect(existsSync(result.sourcesPath)).toBe(true);
    const sourcesContent = await readFile(result.sourcesPath, "utf8");
    const sources = JSON.parse(sourcesContent);
    expect(sources.sources).toBeDefined();
    expect(Object.keys(sources.sources).length).toBeGreaterThan(0);
  });

  it("scenario matrix populated when scenario cards exist", async () => {
    await createCard(tmpDir, "scen-1", "scenario", "Login Flow");
    const result = await renderOverview({ root: tmpDir });
    const content = await readFile(result.overviewPath, "utf8");
    expect(content).toContain("scen-1");
    expect(content).toContain("Login Flow");
  });

  it("no route manifest → N/A for route reasons", async () => {
    const result = await renderOverview({ root: tmpDir });
    const content = await readFile(result.overviewPath, "utf8");
    expect(content).toContain("## Route reasons\nN/A");
  });

  it("valid route manifest → shows mode/type/reasons", async () => {
    const buildDir = path.join(tmpDir, ".ai/memory-build/latest");
    await mkdir(buildDir, { recursive: true });
    const manifest = {
      surface: { changedFiles: ["src/foo.ts"], components: ["src"], risks: [], type: "bugfix", behaviorChange: true },
      result: { mode: "direct", reasons: ["Bounded change, low risk"], type: "bugfix", risks: [], behaviorChange: true },
    };
    await writeFile(path.join(buildDir, "route-manifest.json"), JSON.stringify(manifest), "utf8");
    const result = await renderOverview({ root: tmpDir });
    const content = await readFile(result.overviewPath, "utf8");
    expect(content).toContain("Mode: DIRECT");
    expect(content).toContain("Type: bugfix");
    expect(content).toContain("Bounded change, low risk");
  });

  it("invalid manifest JSON → N/A (route manifest invalid)", async () => {
    const buildDir = path.join(tmpDir, ".ai/memory-build/latest");
    await mkdir(buildDir, { recursive: true });
    await writeFile(path.join(buildDir, "route-manifest.json"), "{ invalid json }", "utf8");
    const result = await renderOverview({ root: tmpDir });
    const content = await readFile(result.overviewPath, "utf8");
    expect(content).toContain("N/A (route manifest invalid)");
  });
});