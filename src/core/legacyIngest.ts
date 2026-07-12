import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { resolveRoot } from "./paths.js";
import { BOILERPLATE_PATTERNS } from "./semanticRepair.js";
import type { LegacyCandidate, LegacyState, LegacyIngestResult } from "../schemas/legacyIngest.js";
import { LegacyCandidateSchema, LegacyIngestResultSchema } from "../schemas/legacyIngest.js";

// ── Constants ────────────────────────────────────────────────────────────────────

export const LEGACY_CLASSES = {
  canonical: ['openspec-requirement', 'kb-service', 'kb-reference', 'kb-decision', 'kb-runbook', 'kb-gotcha'],
  nonCanonical: ['draft-contradiction', 'history-only', 'duplicate', 'unknown'],
} as const;

export const LEGACY_STATES = ['unclassified', 'needs-evidence', 'needs-human', 'ready', 'rejected'] as const;

// ── State transition validation ──────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<LegacyState, LegacyState[]> = {
  "unclassified": ["needs-evidence", "needs-human", "rejected"],
  "needs-evidence": ["needs-human", "ready", "rejected"],
  "needs-human": ["ready", "rejected"],
  "ready": ["rejected"],
  "rejected": [],
};

export function validateStateTransition(from: LegacyState, to: LegacyState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function transitionState(
  from: LegacyState,
  to: LegacyState,
): asserts to is LegacyState {
  if (!validateStateTransition(from, to)) {
    throw new Error(
      `Illegal state transition: "${from}" → "${to}". ` +
      `Allowed from "${from}": [${VALID_TRANSITIONS[from].join(", ")}]`
    );
  }
}

// ── Heuristic classification ─────────────────────────────────────────────────────

function contentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function classifyByContent(content: string): { classification: string; confidence: number; matches: string[] } {
  const lower = content.toLowerCase();
  // Normalize numbered headers: "## 1. цель" → "## цель"
  const normalized = lower.replace(/##\s+\d+[.)]\s+/g, "## ");
  const matches: string[] = [];
  let confidence = 0;

  // OpenSpec patterns
  const openspecPatterns = ["openspec", "# openspec", "## requirements", "## acceptance criteria"];
  for (const pat of openspecPatterns) {
    if (normalized.includes(pat)) {
      matches.push(pat);
      confidence += 0.3;
      break; // one pattern match counts once
    }
  }

  // Service docs
  const servicePatterns = ["service:", "## service overview", "## service description"];
  for (const pat of servicePatterns) {
    if (normalized.includes(pat)) {
      matches.push(pat);
      confidence += 0.3;
      break;
    }
  }

  // Decision docs (ADR)
  const decisionPatterns = ["## decision", "## rationale", "decision record", "# adr"];
  for (const pat of decisionPatterns) {
    if (normalized.includes(pat)) {
      matches.push(pat);
      confidence += 0.3;
      break;
    }
  }

  // Reference docs
  if (normalized.includes("## behaviors carried over")) {
    matches.push("behaviors-carried-over");
    confidence += 0.3;
  }

  // Runbook docs
  const runbookPatterns = ["## deployment", "## configuration", "## troubleshooting"];
  for (const pat of runbookPatterns) {
    if (normalized.includes(pat)) {
      matches.push(pat);
      confidence += 0.3;
      break;
    }
  }

  // Gotcha docs
  const gotchaPatterns = ["## pitfall", "## avoidance", "## gotcha", "## common mistake"];
  for (const pat of gotchaPatterns) {
    if (normalized.includes(pat)) {
      matches.push(pat);
      confidence += 0.3;
      break;
    }
  }

  // Proposal/spec/decision patterns (English + Russian)
  const proposalPatterns = [
    // English
    "## proposal", "## proposed", "## context",
    "## alternatives", "## consequences", "## current behavior", "## proposed behavior",
    // Russian
    "## цель", "## решение", "## предложение", "## контекст", "## альтернативы",
    "## последствия", "## текущее поведение", "## предлагаемое поведение",
    "## архитектур", "## описание", "## проблема", "## задача",
    "## принцип", "## введение", "## сложность",
    "## что меняется", "## текущие точки", "## главные проблемы",
    "## контракт", "## pipeline", "## поля ответа",
  ];
  for (const pat of proposalPatterns) {
    if (normalized.includes(pat)) {
      matches.push(pat);
      confidence += 0.3;
      break;
    }
  }

  // Architecture/design patterns
  const archPatterns = [
    "## architecture", "## design", "## components", "## data flow", "## dependencies",
    "## схема", "## компоненты", "## поток данных", "## зависимости",
    "## диаграмма", "## mermaid",
  ];
  for (const pat of archPatterns) {
    if (normalized.includes(pat)) {
      matches.push(pat);
      confidence += 0.3;
      break;
    }
  }

  // Reference/guide patterns (English + Russian)
  const referencePatterns = [
    "## где смотреть", "## инварианты",
    "## алгоритм", "## формула", "## scoring", "## ranking",
    "## search", "## indexing",
  ];
  for (const pat of referencePatterns) {
    if (normalized.includes(pat)) {
      matches.push(pat);
      confidence += 0.3;
      break;
    }
  }

  // Implementation plan patterns (English + Russian)
  const planPatterns = [
    "## file structure", "## task", "## implementation",
    "## файл", "## шаг",
  ];
  for (const pat of planPatterns) {
    if (normalized.includes(pat)) {
      matches.push(pat);
      confidence += 0.3;
      break;
    }
  }

  // Analysis/comparison patterns
  const analysisPatterns = [
    "## introduction", "## analysis", "## comparison", "## complexity",
    "## анализ", "## сравнен",
  ];
  for (const pat of analysisPatterns) {
    if (normalized.includes(pat)) {
      matches.push(pat);
      confidence += 0.3;
      break;
    }
  }

  return { classification: "unknown", confidence, matches };
}

function classifyByPath(relPath: string): { classification: string; confidence: number; signal: string } {
  const lower = relPath.toLowerCase();

  if (/legacy\/|archive\/|old\//.test(lower)) {
    return { classification: "history-only", confidence: 0.3, signal: "legacy-path" };
  }

  const base = path.basename(lower);
  if (base === "readme.md" || base === "service.md") {
    return { classification: "kb-service", confidence: 0.2, signal: "service-filename" };
  }

  if (/^adr-|_adr\.|_decision\.|decision-/.test(base)) {
    return { classification: "kb-decision", confidence: 0.2, signal: "decision-filename" };
  }

  if (/openspec/.test(lower)) {
    return { classification: "openspec-requirement", confidence: 0.2, signal: "openspec-path" };
  }

  // Proposal/spec/analysis path patterns
  if (/proposal|\/spec|spec-|architecture|analysis|design|plan/.test(lower)) {
    return { classification: "kb-decision", confidence: 0.2, signal: "proposal-spec-path" };
  }

  // Guide/reference path patterns
  if (/guide|tutorial|howto|how-to|reference/.test(lower)) {
    return { classification: "kb-reference", confidence: 0.2, signal: "guide-path" };
  }

  return { classification: "unknown", confidence: 0, signal: "" };
}

interface Sig {
  classification: LegacyCandidate["classification"];
  confidence: number;
  rationale: string;
}

function heuristicClassify(relPath: string, content: string): Sig {
  const pathResult = classifyByPath(relPath);
  const contentResult = classifyByContent(content);

  // Start with content classification (stronger signal)
  let classification: LegacyCandidate["classification"] = "unknown";
  let confidence = 0;
  const rationales: string[] = [];

  // Content signals
  if (contentResult.matches.length > 0) {
    // Determine the best classification from content matches
    const classificationByMatch: Record<string, LegacyCandidate["classification"]> = {
      "openspec": "openspec-requirement",
      "# openspec": "openspec-requirement",
      "## requirements": "openspec-requirement",
      "## acceptance criteria": "openspec-requirement",
      "service:": "kb-service",
      "## service overview": "kb-service",
      "## service description": "kb-service",
      "## decision": "kb-decision",
      "## rationale": "kb-decision",
      "decision record": "kb-decision",
      "# adr": "kb-decision",
      "behaviors-carried-over": "kb-reference",
      "## deployment": "kb-runbook",
      "## configuration": "kb-runbook",
      "## troubleshooting": "kb-runbook",
      "## pitfall": "kb-gotcha",
      "## avoidance": "kb-gotcha",
      "## gotcha": "kb-gotcha",
      "## common mistake": "kb-gotcha",
      // proposal/spec/decision patterns
      "## proposal": "kb-decision",
      "## proposed": "kb-decision",
      "## context": "kb-decision",
      "## alternatives": "kb-decision",
      "## consequences": "kb-decision",
      "## current behavior": "kb-reference",
      "## proposed behavior": "kb-decision",
      "## цель": "kb-decision",
      "## решение": "kb-decision",
      "## предложение": "kb-decision",
      "## контекст": "kb-decision",
      "## альтернативы": "kb-decision",
      "## последствия": "kb-decision",
      "## текущее поведение": "kb-reference",
      "## предлагаемое поведение": "kb-decision",
      "## архитектур": "kb-decision",
      "## описание": "kb-reference",
      "## проблема": "kb-decision",
      "## задача": "kb-decision",
      // More Russian proposal/decision patterns
      "## принцип": "kb-reference",
      "## введение": "kb-reference",
      "## сложность": "kb-reference",
      "## что меняется": "kb-decision",
      "## текущие точки": "kb-decision",
      "## главные проблемы": "kb-decision",
      "## контракт": "kb-reference",
      "## pipeline": "kb-reference",
      "## поля ответа": "kb-reference",
      // Implementation plan patterns
      "## file structure": "kb-reference",
      "## task": "kb-reference",
      "## implementation": "kb-decision",
      "## файл": "kb-reference",
      "## шаг": "kb-reference",
      // Analysis/comparison patterns
      "## introduction": "kb-reference",
      "## analysis": "kb-reference",
      "## comparison": "kb-reference",
      "## complexity": "kb-reference",
      "## анализ": "kb-reference",
      "## сравнен": "kb-reference",
      // architecture patterns
      "## architecture": "kb-decision",
      "## design": "kb-decision",
      "## components": "kb-reference",
      "## data flow": "kb-reference",
      "## dependencies": "kb-reference",
      "## схема": "kb-decision",
      "## компоненты": "kb-reference",
      "## поток данных": "kb-reference",
      "## зависимости": "kb-reference",
      "## диаграмма": "kb-decision",
      "## mermaid": "kb-decision",
      // reference/guide patterns
      "## где смотреть": "kb-reference",
      "## инварианты": "kb-reference",
      "## алгоритм": "kb-reference",
      "## формула": "kb-reference",
      "## scoring": "kb-reference",
      "## ranking": "kb-reference",
      "## search": "kb-reference",
      "## indexing": "kb-reference",
    };

    confidence += contentResult.confidence;
    rationales.push(`content: ${contentResult.matches.join(", ")}`);

    // Find the first match that maps to a classification
    for (const m of contentResult.matches) {
      if (classificationByMatch[m]) {
        classification = classificationByMatch[m];
        break;
      }
    }
  }

  // Path signals
  if (pathResult.signal) {
    confidence += pathResult.confidence;
    rationales.push(`path: ${pathResult.signal}`);
  }

  // Contradiction signals
  const lower = content.toLowerCase();
  if (lower.includes("todo") || lower.includes("contradiction") || lower.includes("conflict")) {
    confidence += 0.25;
    rationales.push("contradiction-markers");
    if (confidence < 0.5) {
      classification = "draft-contradiction";
    }
  }

  // Path overrides: if path says history-only, boost it
  if (pathResult.classification === "history-only") {
    confidence = Math.max(confidence, pathResult.confidence);
    classification = "history-only";
    if (rationales.length === 0 || !rationales.some(r => r.includes("legacy-path"))) {
      rationales.push(`path: ${pathResult.signal}`);
    }
  }

  if (!classification || classification === "unknown") {
    classification = "unknown";
  }

  return {
    classification,
    confidence,
    rationale: rationales.join("; "),
  };
}

// ── State assignment ─────────────────────────────────────────────────────────────

function assignInitialState(confidence: number): LegacyState {
  if (confidence >= 0.5) {
    return "needs-evidence";
  }
  if (confidence >= 0.25) {
    return "needs-human";
  }
  return "unclassified";
}

// ── Duplicate detection ──────────────────────────────────────────────────────────

interface FileEntry {
  path: string;
  relPath: string;
  content: string;
  hash: string;
}

async function inventoryFiles(
  root: string,
  sources: string[]
): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];

  for (const source of sources) {
    const absSource = path.resolve(root, source);
    const patterns = [path.join(absSource, "**", "*.{md,mdx,txt}")]
      .map(p => toPattern(p));

    const files = await fg(patterns, { onlyFiles: true });

    for (const file of files) {
      try {
        const content = await readFile(file, "utf8");
        const hash = contentHash(content);
        const relPath = path.relative(root, file);
        entries.push({ path: file, relPath, content, hash });
      } catch {
        // Skip files that can't be read (binary, permissions, etc.)
      }
    }
  }

  return entries;
}

function toPattern(p: string): string {
  return p.replace(/\\/g, "/");
}

function generateId(relPath: string): string {
  const slug = relPath.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 40);
  return `legacy-${slug}-${createHash("md5").update(relPath).digest("hex").slice(0, 8)}`;
}

// ── Batch persistence ────────────────────────────────────────────────────────────

async function saveBatch(root: string, batchName: string, candidates: LegacyCandidate[]): Promise<void> {
  const batchDir = path.join(root, ".ai/memory-build/legacy-batches", batchName);
  await mkdir(batchDir, { recursive: true });

  const byClass: Record<string, number> = {};
  const byState: Record<string, number> = {};

  for (const c of candidates) {
    byClass[c.classification] = (byClass[c.classification] || 0) + 1;
    byState[c.state] = (byState[c.state] || 0) + 1;
  }

  const batch = {
    batchName,
    candidates: candidates.map(c => LegacyCandidateSchema.parse(c)),
    createdAt: new Date().toISOString(),
    stats: {
      total: candidates.length,
      byClass,
      byState,
    },
  };

  const batchPath = path.join(batchDir, "batch.json");
  await writeFile(batchPath, JSON.stringify(batch, null, 2), "utf8");
}

// ── Main ingest function ─────────────────────────────────────────────────────────

export async function legacyIngest(options: {
  root?: string;
  sources: string[];
  batch?: string;
}): Promise<LegacyIngestResult> {
  const root = resolveRoot(options);
  const batchName = options.batch ?? `batch-${Date.now()}`;

  const entries = await inventoryFiles(root, options.sources);

  // Build hash map for duplicate detection
  const hashMap = new Map<string, string>(); // hash → first path seen
  const candidates: LegacyCandidate[] = [];

  for (const entry of entries) {
    // Duplicate detection
    const existingPath = hashMap.get(entry.hash);
    if (existingPath && existingPath !== entry.relPath) {
      candidates.push({
        id: generateId(entry.relPath),
        path: entry.relPath,
        classification: "duplicate",
        state: "needs-human",
        confidence: 1.0,
        rationale: `duplicate of ${existingPath}`,
        evidence: [],
        subjectHash: undefined,
      });
      continue;
    }
    hashMap.set(entry.hash, entry.relPath);

    // Heuristic classification
    const sig = heuristicClassify(entry.relPath, entry.content);

    // Confidence threshold: must be ≥ 0.25 to classify
    const effectiveConfidence = sig.confidence;
    const classification = effectiveConfidence >= 0.25
      ? sig.classification
      : "unknown";

    // State assignment based on confidence
    const state = effectiveConfidence >= 0.25
      ? assignInitialState(effectiveConfidence)
      : "unclassified";

    const finalState = state === "unclassified" && effectiveConfidence < 0.25
      ? "needs-human"
      : state;

    candidates.push({
      id: generateId(entry.relPath),
      path: entry.relPath,
      classification,
      state: finalState,
      confidence: effectiveConfidence,
      rationale: sig.rationale,
      evidence: [],
      subjectHash: undefined,
    });
  }

  // Save batch
  await saveBatch(root, batchName, candidates);

  // Build result
  const byClass: Record<string, number> = {};
  const byState: Record<string, number> = {};
  for (const c of candidates) {
    byClass[c.classification] = (byClass[c.classification] || 0) + 1;
    byState[c.state] = (byState[c.state] || 0) + 1;
  }

  const batch = {
    batchName,
    candidates: candidates.map(c => LegacyCandidateSchema.parse(c)),
    createdAt: new Date().toISOString(),
    stats: {
      total: candidates.length,
      byClass,
      byState,
    },
  };

  const result = {
    batch,
    candidates: candidates.map(c => LegacyCandidateSchema.parse(c)),
  };

  return LegacyIngestResultSchema.parse(result);
}

// ── Staging (E2) ─────────────────────────────────────────────────────────────────

function slugify(p: string): string {
  return p.replace(/\.md$/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "unnamed";
}

export function getDefaultTargetPath(candidate: LegacyCandidate): string {
  const slug = slugify(candidate.path);
  switch (candidate.classification) {
    case "openspec-requirement": return `openspec/specs/${slug}/${slug}.md`;
    case "kb-service": return `.ai/docs/services/${slug}/README.md`;
    case "kb-decision": return `.ai/docs/decisions/${slug}.md`;
    case "kb-reference": return `.ai/docs/reference/${slug}.md`;
    case "kb-runbook": return `.ai/docs/runbooks/${slug}.md`;
    case "kb-gotcha": return `.ai/docs/gotchas/${slug}.md`;
    case "draft-contradiction": return `.ai/drafts/legacy/${slug}.md`;
    case "history-only": return `.ai/memory/historical/${slug}.md`;
    default: return `.ai/drafts/legacy/${slug}.md`;
  }
}

export function isStub(content: string): boolean {
  for (const { re } of BOILERPLATE_PATTERNS) {
    if (re.test(content)) return true;
  }
  return content.trim().length < 50;
}

export async function stageCandidate(
  candidate: LegacyCandidate,
  options: { root: string; batch: string },
): Promise<LegacyCandidate> {
  const root = resolveRoot({ root: options.root });
  const targetPath = candidate.targetPath ?? getDefaultTargetPath(candidate);
  const stagedPath = path.join(root, ".ai", "memory-build", "legacy-batches", options.batch, "staged", targetPath);

  const targetFullPath = path.join(root, targetPath);
  if (existsSync(targetFullPath)) {
    const existingContent = await readFile(targetFullPath, "utf8");
    if (!isStub(existingContent)) {
      return { ...candidate, targetPath, stagedPath, state: "needs-human" };
    }
  }

  await mkdir(path.dirname(stagedPath), { recursive: true });
  const sourceContent = await readFile(path.join(root, candidate.path), "utf8").catch(() => "");
  await writeFile(stagedPath, sourceContent, "utf8");

  return { ...candidate, targetPath, stagedPath };
}

export function evidenceValid(candidate: LegacyCandidate, root: string): { valid: boolean; missingPaths: string[] } {
  const missingPaths: string[] = [];
  for (const evidence of candidate.evidence) {
    if (!evidence.path || !evidence.supports) {
      missingPaths.push("missing path or supports field");
      continue;
    }
    const fullPath = path.resolve(root, evidence.path);
    if (!existsSync(fullPath)) {
      missingPaths.push(evidence.path);
    }
  }
  return { valid: missingPaths.length === 0, missingPaths };
}

// ── Subject hash binding (E3) ─────────────────────────────────────────────────────

function readFileSyncSafe(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

export function computeSubjectHash(candidate: LegacyCandidate, root?: string): string {
  const baseDir = root ?? process.cwd();
  // Read evidence file contents and hash them
  const evidenceHashes: string[] = [];
  for (const e of candidate.evidence) {
    try {
      const content = readFileSyncSafe(path.resolve(baseDir, e.path));
      evidenceHashes.push(contentHash(content));
    } catch {
      evidenceHashes.push("MISSING:" + e.path);
    }
  }

  const hashInput: Record<string, unknown> = {
    classification: candidate.classification,
    state: candidate.state,
    rationale: candidate.rationale ?? "",
    target: candidate.targetPath ?? "",
    staged: candidate.stagedPath ?? "",
    paths: [candidate.path, ...candidate.evidence.map((e) => e.path)].sort(),
    evidenceSHA256s: evidenceHashes.sort(),
  };
  // Stable serialization: sort keys then stringify
  const sortedKeys = Object.keys(hashInput).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    sorted[k] = hashInput[k];
  }
  const canonicalJson = JSON.stringify(sorted);
  return contentHash(canonicalJson);
}

export async function approveCandidate(
  candidate: LegacyCandidate,
  options: { root: string; batch: string },
): Promise<{ approved: boolean; reason?: string; subjectHash?: string }> {
  const currentHash = computeSubjectHash(candidate, options.root);
  // Check if candidate state is ready
  if (candidate.state !== "ready") {
    // Validate that the transition to "ready" would be legal
    if (!validateStateTransition(candidate.state, "ready")) {
      return { approved: false, reason: `Illegal state transition: '${candidate.state}' → 'ready'` };
    }
    return { approved: false, reason: `Candidate state is '${candidate.state}', must be 'ready'` };
  }
  return { approved: true, subjectHash: currentHash };
}

export async function applyCandidate(
  candidate: LegacyCandidate,
  options: { root: string; batch: string; subjectHash?: string },
): Promise<{ applied: boolean; reason?: string }> {
  // Must be approved (have a subject hash)
  if (!options.subjectHash) {
    return { applied: false, reason: "Candidate not approved — subjectHash required" };
  }
  // Verify subject hash matches current state
  const currentHash = computeSubjectHash(candidate, options.root);
  if (currentHash !== options.subjectHash) {
    return { applied: false, reason: "Subject hash mismatch — candidate changed after approval" };
  }
  // Must have stagedPath
  if (!candidate.stagedPath) {
    return { applied: false, reason: "No staged path — stage candidate first" };
  }
  return { applied: true };
}
