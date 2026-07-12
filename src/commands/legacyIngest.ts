import { legacyIngest, approveCandidate, applyCandidate, stageCandidate, evidenceValid, computeSubjectHash } from "../core/legacyIngest.js";
import { loadMemoryCards } from "../core/loadMemory.js";
import { validateMemory } from "../core/validate.js";
import { rebuildIndexes } from "../core/semanticRepair.js";
import { resolveRoot, resolveMemoryRoot } from "../core/paths.js";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

function getBatchDir(root: string, batch: string): string {
  return path.join(root, ".ai", "memory-build", "legacy-batches", batch);
}

async function loadBatch(root: string, batch: string): Promise<{ candidates: import("../schemas/legacyIngest.js").LegacyCandidate[] }> {
  const batchPath = path.join(getBatchDir(root, batch), "batch.json");
  if (!existsSync(batchPath)) throw new Error(`Batch '${batch}' not found at ${batchPath}`);
  const raw = await readFile(batchPath, "utf8");
  return JSON.parse(raw);
}

async function saveBatch(root: string, batch: string, candidates: import("../schemas/legacyIngest.js").LegacyCandidate[]): Promise<void> {
  const batchDir = getBatchDir(root, batch);
  const batchPath = path.join(batchDir, "batch.json");
  const byClass: Record<string, number> = {};
  const byState: Record<string, number> = {};
  for (const c of candidates) {
    byClass[c.classification] = (byClass[c.classification] || 0) + 1;
    byState[c.state] = (byState[c.state] || 0) + 1;
  }
  await writeFile(batchPath, JSON.stringify({ batchName: batch, candidates, createdAt: new Date().toISOString(), stats: { total: candidates.length, byClass, byState } }, null, 2), "utf8");
}

// ── buildReviewPack ──────────────────────────────────────────────────────────────

export async function buildReviewPack(options: { root?: string; batch?: string }): Promise<{ reviewPackPath: string; candidates: number }> {
  const root = resolveRoot(options);
  const batchName = options.batch ?? "default";
  const batch = await loadBatch(root, batchName);
  const batchDir = getBatchDir(root, batchName);
  const reviewPackPath = path.join(batchDir, "review-pack.md");

  const lines: string[] = [`# Legacy Review Pack — ${batchName}`, "", `**Candidates:** ${batch.candidates.length}`, ""];

  for (const c of batch.candidates) {
    lines.push(`## ${c.id}`);
    lines.push(`- **Path:** ${c.path}`);
    lines.push(`- **Classification:** ${c.classification} (confidence: ${c.confidence.toFixed(2)})`);
    lines.push(`- **State:** ${c.state}`);
    lines.push(`- **Target:** ${c.targetPath ?? "N/A"}`);
    lines.push(`- **Staged:** ${c.stagedPath ?? "N/A"}`);
    lines.push(`- **Rationale:** ${c.rationale ?? "N/A"}`);
    const ev = evidenceValid(c, root);
    lines.push(`- **Evidence valid:** ${ev.valid}${ev.missingPaths.length > 0 ? ` (missing: ${ev.missingPaths.join(", ")})` : ""}`);
    lines.push("");
  }

  await writeFile(reviewPackPath, lines.join("\n"), "utf8");
  return { reviewPackPath, candidates: batch.candidates.length };
}

// ── finalizeBatch ────────────────────────────────────────────────────────────────

export async function finalizeBatch(options: { root?: string; batch?: string }): Promise<{ finalized: boolean; errors: number; warnings: number }> {
  const root = resolveRoot(options);
  const batchName = options.batch ?? "default";
  const batch = await loadBatch(root, batchName);

  // Validate KB integrity
  const validateResult = await validateMemory({ root });

  // Rebuild DECISIONS.md/FLOWS.md indexes
  const cards = await loadMemoryCards({ root });
  rebuildIndexes(cards);

  // Artifact index rebuild — soft dependency on F4 (skip if not available)
  try {
    const { buildArtifactIndex } = await import("../core/artifactIndex.js");
    await buildArtifactIndex({ root });
  } catch {
    // F4 not available — skip gracefully
  }

  // Mark batch as finalized
  const finalizePath = path.join(getBatchDir(root, batchName), "finalized.json");
  await writeFile(finalizePath, JSON.stringify({ finalizedAt: new Date().toISOString(), candidateCount: batch.candidates.length, validateOk: validateResult.ok, errors: validateResult.errors.length, warnings: validateResult.warnings.length }, null, 2), "utf8");

  return { finalized: true, errors: validateResult.errors.length, warnings: validateResult.warnings.length };
}

// ── CLI command handlers ──────────────────────────────────────────────────────────

export async function legacyIngestCommand(options: { root?: string; sources: string[]; batch?: string; json?: boolean }): Promise<void> {
  const root = resolveRoot(options);
  const result = await legacyIngest({ root, sources: options.sources, batch: options.batch });
  if (options.json) {
    console.log(JSON.stringify({ batch: result.batch.batchName, candidates: result.candidates.length, byClass: result.batch.stats.byClass, byState: result.batch.stats.byState }, null, 2));
  } else {
    console.log(`# Legacy ingest complete`);
    console.log(`\nBatch: ${result.batch.batchName}`);
    console.log(`Candidates: ${result.candidates.length}`);
    console.log(`By class: ${JSON.stringify(result.batch.stats.byClass)}`);
    console.log(`By state: ${JSON.stringify(result.batch.stats.byState)}`);
  }
}

export async function legacyListCommand(options: { root?: string; batch?: string; json?: boolean }): Promise<void> {
  const root = resolveRoot(options);
  const batchName = options.batch ?? "default";
  const batch = await loadBatch(root, batchName);
  if (options.json) {
    console.log(JSON.stringify(batch.candidates.map((c) => ({ id: c.id, classification: c.classification, state: c.state, confidence: c.confidence })), null, 2));
  } else {
    console.log(`# Legacy candidates — ${batchName}`);
    for (const c of batch.candidates) {
      console.log(`  - [${c.classification}] ${c.id} (${c.state}, conf=${c.confidence.toFixed(2)})`);
    }
  }
}

export async function legacyStatusCommand(options: { root?: string; batch?: string; json?: boolean }): Promise<void> {
  const root = resolveRoot(options);
  const batchName = options.batch ?? "default";
  const batch = await loadBatch(root, batchName);
  const byState: Record<string, number> = {};
  for (const c of batch.candidates) byState[c.state] = (byState[c.state] || 0) + 1;
  if (options.json) {
    console.log(JSON.stringify({ batch: batchName, total: batch.candidates.length, byState }, null, 2));
  } else {
    console.log(`# Legacy status — ${batchName}`);
    console.log(`Total: ${batch.candidates.length}`);
    for (const [state, count] of Object.entries(byState)) {
      console.log(`  ${state}: ${count}`);
    }
  }
}

export async function legacyScaffoldCommand(options: { root?: string; batch?: string; json?: boolean }): Promise<void> {
  const root = resolveRoot(options);
  const batchName = options.batch ?? "default";
  const batch = await loadBatch(root, batchName);
  let staged = 0;
  for (const c of batch.candidates) {
    if (c.state === "ready" || c.state === "needs-evidence") {
      const result = await stageCandidate(c, { root, batch: batchName });
      if (result.stagedPath) staged++;
    }
  }
  if (options.json) {
    console.log(JSON.stringify({ staged, total: batch.candidates.length }, null, 2));
  } else {
    console.log(`# Legacy scaffold — ${batchName}`);
    console.log(`Staged: ${staged}/${batch.candidates.length}`);
  }
}

export async function legacyCheckCommand(options: { root?: string; batch?: string; json?: boolean }): Promise<void> {
  const root = resolveRoot(options);
  const batchName = options.batch ?? "default";
  const batch = await loadBatch(root, batchName);
  const results = batch.candidates.map((c) => {
    const ev = evidenceValid(c, root);
    return { id: c.id, evidenceValid: ev.valid, missingPaths: ev.missingPaths };
  });
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`# Legacy check — ${batchName}`);
    for (const r of results) {
      console.log(`  ${r.id}: ${r.evidenceValid ? "OK" : `FAIL (${r.missingPaths.join(", ")})`}`);
    }
  }
}

export async function legacyReviewPackCommand(options: { root?: string; batch?: string; json?: boolean }): Promise<void> {
  const result = await buildReviewPack(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`# Review pack generated: ${result.reviewPackPath}`);
    console.log(`Candidates: ${result.candidates}`);
  }
}

export async function legacyApproveCommand(id: string, options: { root?: string; batch?: string; json?: boolean }): Promise<void> {
  const root = resolveRoot(options);
  const batchName = options.batch ?? "default";
  const batch = await loadBatch(root, batchName);
  const candidate = batch.candidates.find((c) => c.id === id);
  if (!candidate) throw new Error(`Candidate '${id}' not found in batch '${batchName}'`);
  const result = await approveCandidate(candidate, { root, batch: batchName });
  if (result.approved && result.subjectHash) {
    candidate.subjectHash = result.subjectHash;
    await saveBatch(root, batchName, batch.candidates);
  }
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.approved ? `# Approved: ${id}` : `# Rejected: ${id} — ${result.reason}`);
  }
}

export async function legacyApplyCommand(options: { root?: string; batch?: string; json?: boolean }): Promise<void> {
  const root = resolveRoot(options);
  const batchName = options.batch ?? "default";
  const batch = await loadBatch(root, batchName);
  let applied = 0;
  let failed = 0;
  for (const c of batch.candidates) {
    if (!c.subjectHash) { failed++; continue; }
    const result = await applyCandidate(c, { root, batch: batchName, subjectHash: c.subjectHash });
    if (result.applied) {
      // Copy staged → target
      if (c.stagedPath && c.targetPath) {
        const targetFull = path.join(root, c.targetPath);
        await mkdir(path.dirname(targetFull), { recursive: true });
        const stagedContent = await readFile(c.stagedPath, "utf8").catch(() => "");
        await writeFile(targetFull, stagedContent, "utf8");
        applied++;
      }
    } else {
      failed++;
    }
  }
  if (options.json) {
    console.log(JSON.stringify({ applied, failed }, null, 2));
  } else {
    console.log(`# Legacy apply — ${batchName}`);
    console.log(`Applied: ${applied}, Failed: ${failed}`);
  }
}

export async function legacyFinalizeCommand(options: { root?: string; batch?: string; json?: boolean }): Promise<void> {
  const result = await finalizeBatch(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`# Legacy finalize — ${options.batch ?? "default"}`);
    console.log(`Finalized: ${result.finalized}`);
    console.log(`Validate errors: ${result.errors}, warnings: ${result.warnings}`);
  }
}