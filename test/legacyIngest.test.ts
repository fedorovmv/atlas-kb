import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  legacyIngest,
  validateStateTransition,
  LEGACY_CLASSES,
  LEGACY_STATES,
} from "../src/core/legacyIngest.js";
import type { LegacyState } from "../src/schemas/legacyIngest.js";

let tmpDir: string;

beforeEach(async () => { tmpDir = await mkdtemp(path.join(os.tmpdir(), "legacy-test-")); });
afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

describe("validateStateTransition", () => {
  it("unclassified → needs-evidence is valid", () => {
    expect(validateStateTransition("unclassified", "needs-evidence")).toBe(true);
  });

  it("unclassified → ready is INVALID (skipping states)", () => {
    expect(validateStateTransition("unclassified", "ready")).toBe(false);
  });

  it("ready → needs-human is INVALID (backward transition)", () => {
    expect(validateStateTransition("ready", "needs-human")).toBe(false);
  });

  it("ready → rejected is valid", () => {
    expect(validateStateTransition("ready", "rejected")).toBe(true);
  });

  it("rejected → anything is INVALID (terminal state)", () => {
    const states: LegacyState[] = ["unclassified", "needs-evidence", "needs-human", "ready"];
    for (const s of states) {
      expect(validateStateTransition("rejected", s)).toBe(false);
    }
  });
});

describe("legacyIngest", () => {
  it("classifies OpenSpec spec → openspec-requirement", async () => {
    const srcDir = path.join(tmpDir, "specs");
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      path.join(srcDir, "feature.md"),
      "# OpenSpec\n\n## Requirements\n\nSome requirement text here.\n\n## Acceptance Criteria\n\n- Criterion A\n- Criterion B\n",
      "utf8",
    );

    const result = await legacyIngest({ root: tmpDir, sources: ["specs"] });
    const candidate = result.candidates.find((c) => c.path.includes("feature.md"));
    expect(candidate).toBeDefined();
    expect(candidate!.classification).toBe("openspec-requirement");
  });

  it("classifies service doc → kb-service", async () => {
    const srcDir = path.join(tmpDir, "docs");
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      path.join(srcDir, "service.md"),
      "# My Service\n\n## Service Overview\n\nThis service handles authentication.\n\nService: auth-gateway\n",
      "utf8",
    );

    const result = await legacyIngest({ root: tmpDir, sources: ["docs"] });
    const candidate = result.candidates.find((c) => c.path.includes("service.md"));
    expect(candidate).toBeDefined();
    expect(candidate!.classification).toBe("kb-service");
  });

  it("classifies legacy archive → history-only", async () => {
    const srcDir = path.join(tmpDir, "legacy", "archive");
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      path.join(srcDir, "old-spec.md"),
      "# Old Specification\n\nSome old content that is no longer current.\n",
      "utf8",
    );

    const result = await legacyIngest({ root: tmpDir, sources: ["legacy"] });
    const candidate = result.candidates.find((c) => c.path.includes("old-spec.md"));
    expect(candidate).toBeDefined();
    expect(candidate!.classification).toBe("history-only");
  });

  it("low confidence → needs-human", async () => {
    const srcDir = path.join(tmpDir, "misc");
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      path.join(srcDir, "random.md"),
      "# Random File\n\nThis is just some random text with no clear classification signals at all.\n",
      "utf8",
    );

    const result = await legacyIngest({ root: tmpDir, sources: ["misc"] });
    const candidate = result.candidates.find((c) => c.path.includes("random.md"));
    expect(candidate).toBeDefined();
    expect(candidate!.state).toBe("needs-human");
  });

  it("duplicate content → duplicate classification", async () => {
    const srcDir = path.join(tmpDir, "src");
    await mkdir(path.join(srcDir, "a"), { recursive: true });
    await mkdir(path.join(srcDir, "b"), { recursive: true });
    const content = "# Same Content\n\nIdentical text in both files for testing duplicate detection.\n";
    await writeFile(path.join(srcDir, "a", "file.md"), content, "utf8");
    await writeFile(path.join(srcDir, "b", "file.md"), content, "utf8");

    const result = await legacyIngest({ root: tmpDir, sources: ["src"] });
    const duplicates = result.candidates.filter((c) => c.classification === "duplicate");
    expect(duplicates.length).toBeGreaterThanOrEqual(1);
  });

  it("batch.json saved to correct path", async () => {
    const srcDir = path.join(tmpDir, "docs");
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      path.join(srcDir, "test.md"),
      "# Test\n\n## Decision\n\nSome decision content here.\n\n## Rationale\n\nBecause we need it.\n",
      "utf8",
    );

    const result = await legacyIngest({ root: tmpDir, sources: ["docs"], batch: "test-batch" });
    const batchPath = path.join(tmpDir, ".ai", "memory-build", "legacy-batches", "test-batch", "batch.json");
    expect(existsSync(batchPath)).toBe(true);
  });
});

describe("LEGACY_CLASSES", () => {
  it("has canonical and nonCanonical arrays", () => {
    expect(LEGACY_CLASSES.canonical).toContain("openspec-requirement");
    expect(LEGACY_CLASSES.canonical).toContain("kb-service");
    expect(LEGACY_CLASSES.nonCanonical).toContain("history-only");
    expect(LEGACY_CLASSES.nonCanonical).toContain("duplicate");
  });
});

describe("LEGACY_STATES", () => {
  it("has 5 states", () => {
    expect(LEGACY_STATES).toHaveLength(5);
    expect(LEGACY_STATES).toContain("unclassified");
    expect(LEGACY_STATES).toContain("ready");
    expect(LEGACY_STATES).toContain("rejected");
  });
});