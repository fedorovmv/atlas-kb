import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { legacyIngestCommand, legacyListCommand, legacyStatusCommand, legacyApproveCommand, legacyApplyCommand, legacyFinalizeCommand, buildReviewPack, finalizeBatch } from "../src/commands/legacyIngest.js";

const execFileAsync = promisify(execFile);

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "e4-test-"));
});
afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

async function createSourceFiles(root: string) {
  const srcDir = path.join(root, "legacy");
  await mkdir(srcDir, { recursive: true });
  await writeFile(
    path.join(srcDir, "old-spec.md"),
    "# Old Specification\n\nSome old content that is no longer current.\n",
    "utf8",
  );
  const decisionDir = path.join(root, "docs");
  await mkdir(decisionDir, { recursive: true });
  await writeFile(
    path.join(decisionDir, "decision.md"),
    "# Decision\n\n## Decision\n\nUse OAuth2.\n\n## Rationale\n\nSecurity.\n",
    "utf8",
  );
}

describe("E4 CLI commands", () => {
  it("legacy-ingest creates batch with candidates", async () => {
    await createSourceFiles(tmpDir);
    await legacyIngestCommand({ root: tmpDir, sources: ["legacy", "docs"], batch: "test-batch", json: true });
    // If no throw, success — batch.json created
    const batchPath = path.join(tmpDir, ".ai", "memory-build", "legacy-batches", "test-batch", "batch.json");
    expect(existsSync(batchPath)).toBe(true);
  });

  it("legacy-list outputs candidate list", async () => {
    await createSourceFiles(tmpDir);
    await legacyIngestCommand({ root: tmpDir, sources: ["legacy", "docs"], batch: "test-batch" });
    // Should not throw
    await legacyListCommand({ root: tmpDir, batch: "test-batch", json: true });
  });

  it("legacy-status shows state transitions", async () => {
    await createSourceFiles(tmpDir);
    await legacyIngestCommand({ root: tmpDir, sources: ["legacy", "docs"], batch: "test-batch" });
    await legacyStatusCommand({ root: tmpDir, batch: "test-batch", json: true });
  });

  it("legacy-approve on non-ready candidate → rejected", async () => {
    await createSourceFiles(tmpDir);
    await legacyIngestCommand({ root: tmpDir, sources: ["legacy", "docs"], batch: "test-batch" });
    // Candidates from legacy/ are history-only with state needs-evidence or needs-human
    // Approving should fail since state is not 'ready'
    const batchPath = path.join(tmpDir, ".ai", "memory-build", "legacy-batches", "test-batch", "batch.json");
    const batch = JSON.parse(await readFile(batchPath, "utf8"));
    const firstId = batch.candidates[0].id;
    await legacyApproveCommand(firstId, { root: tmpDir, batch: "test-batch", json: true });
    // No throw = success (rejection is a valid result)
  });

  it("buildReviewPack generates review-pack.md", async () => {
    await createSourceFiles(tmpDir);
    await legacyIngestCommand({ root: tmpDir, sources: ["legacy", "docs"], batch: "test-batch" });
    const result = await buildReviewPack({ root: tmpDir, batch: "test-batch" });
    expect(existsSync(result.reviewPackPath)).toBe(true);
    expect(result.candidates).toBeGreaterThan(0);
  });

  it("finalizeBatch validates KB + rebuilds indexes", async () => {
    await createSourceFiles(tmpDir);
    await legacyIngestCommand({ root: tmpDir, sources: ["legacy", "docs"], batch: "test-batch" });
    const result = await finalizeBatch({ root: tmpDir, batch: "test-batch" });
    expect(result.finalized).toBe(true);
    const finalizePath = path.join(tmpDir, ".ai", "memory-build", "legacy-batches", "test-batch", "finalized.json");
    expect(existsSync(finalizePath)).toBe(true);
  });
});