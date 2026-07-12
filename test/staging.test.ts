import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { stageCandidate, evidenceValid, isStub, getDefaultTargetPath } from "../src/core/legacyIngest.js";
import type { LegacyCandidate } from "../src/schemas/legacyIngest.js";

let tmpDir: string;
beforeEach(async () => { tmpDir = await mkdtemp(path.join(os.tmpdir(), "e2-test-")); });
afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

function makeCandidate(overrides: Partial<LegacyCandidate> = {}): LegacyCandidate {
  return {
    id: "test-candidate",
    path: "specs/test.md",
    classification: "kb-service",
    state: "needs-evidence",
    confidence: 0.5,
    evidence: [],
    ...overrides,
  };
}

describe("isStub", () => {
  it("boilerplate content → true", () => {
    expect(isStub("## Responsibilities\nNeeds review — identify from code.")).toBe(true);
  });
  it("real content → false", () => {
    expect(isStub("## Responsibilities\nThis module handles authentication and authorization for all API endpoints with OAuth2.")).toBe(false);
  });
  it("very short content (<50 chars) → true", () => {
    expect(isStub("Short.")).toBe(true);
  });
});

describe("getDefaultTargetPath", () => {
  it("openspec-requirement → openspec/specs/", () => {
    const c = makeCandidate({ classification: "openspec-requirement" });
    expect(getDefaultTargetPath(c)).toContain("openspec/specs/");
  });
  it("kb-service → .ai/docs/services/", () => {
    const c = makeCandidate({ classification: "kb-service" });
    expect(getDefaultTargetPath(c)).toContain(".ai/docs/services/");
  });
  it("history-only → .ai/memory/historical/", () => {
    const c = makeCandidate({ classification: "history-only" });
    expect(getDefaultTargetPath(c)).toContain("historical");
  });
});

describe("stageCandidate", () => {
  it("staged path created", async () => {
    const srcDir = path.join(tmpDir, "specs");
    await mkdir(srcDir, { recursive: true });
    await writeFile(path.join(srcDir, "test.md"), "# Test\n\nReal content here that is long enough.", "utf8");

    const candidate = makeCandidate({ path: "specs/test.md" });
    const result = await stageCandidate(candidate, { root: tmpDir, batch: "test-batch" });
    expect(result.stagedPath).toBeDefined();
    expect(result.targetPath).toBeDefined();
  });

  it("existing non-stub target → skip (needs-human)", async () => {
    const srcDir = path.join(tmpDir, "specs");
    await mkdir(srcDir, { recursive: true });
    await writeFile(path.join(srcDir, "test.md"), "# Test\n\nReal content.", "utf8");
    // Create existing target that's NOT a stub
    const targetDir = path.join(tmpDir, ".ai", "docs", "services");
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, "README.md"), "# Real Service\n\nThis is a real service doc with substantial content about authentication and OAuth2.", "utf8");

    const candidate = makeCandidate({ path: "specs/test.md", targetPath: ".ai/docs/services/README.md" });
    const result = await stageCandidate(candidate, { root: tmpDir, batch: "test-batch" });
    expect(result.state).toBe("needs-human");
  });

  it("existing stub target → overwrite (staged)", async () => {
    const srcDir = path.join(tmpDir, "specs");
    await mkdir(srcDir, { recursive: true });
    await writeFile(path.join(srcDir, "test.md"), "# Test\n\nReal content here.", "utf8");
    // Create existing target that IS a stub
    const targetDir = path.join(tmpDir, ".ai", "docs", "services");
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, "README.md"), "Needs review.", "utf8");

    const candidate = makeCandidate({ path: "specs/test.md", targetPath: ".ai/docs/services/README.md" });
    const result = await stageCandidate(candidate, { root: tmpDir, batch: "test-batch" });
    expect(result.stagedPath).toBeDefined();
  });
});

describe("evidenceValid", () => {
  it("valid evidence → true", async () => {
    await mkdir(path.join(tmpDir, "src"), { recursive: true });
    await writeFile(path.join(tmpDir, "src", "index.ts"), "export {};", "utf8");
    const candidate = makeCandidate({ evidence: [{ path: "src/index.ts", supports: "proves the point" }] });
    const result = evidenceValid(candidate, tmpDir);
    expect(result.valid).toBe(true);
  });

  it("missing path → false", () => {
    const candidate = makeCandidate({ evidence: [{ path: "nonexistent.ts", supports: "test" }] });
    const result = evidenceValid(candidate, tmpDir);
    expect(result.valid).toBe(false);
    expect(result.missingPaths).toContain("nonexistent.ts");
  });
});