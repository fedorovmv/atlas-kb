import { SourceCoverage, SourceCoverageEntry, Disposition } from "../schemas/sourceCoverage.js";
import type { SourceContentMap } from "../schemas/sourceContentMap.js";
import { FileRecord, DiscoveryReport } from "../schemas/discovery.js";
import type { MemoryCard } from "./types.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { buildAllContentMaps } from "./contentMap.js";
import { discoverProject } from "./discoverProject.js";
import { loadMemoryCards } from "./loadMemory.js";
import { resolveRoot, resolveMemoryRoot } from "./paths.js";

export interface TriageResult {
  coverage: SourceCoverage;
  updated: number;  // how many unknown -> concrete
  stillUnknown: number;
}

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".gz", ".tar",
  ".bin", ".exe", ".so", ".dylib", ".dll",
]);

function isBinaryFile(file: FileRecord): boolean {
  const ext = path.extname(file.path).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function findTargetCards(file: FileRecord, cards: MemoryCard[]): string[] {
  const results: string[] = [];
  const fileBase = file.path.toLowerCase();
  for (const card of cards) {
    // Match by source_refs, code_refs, test_refs
    for (const ref of card.meta.source_refs ?? []) {
      if (ref.path.toLowerCase().includes(fileBase) || fileBase.includes(ref.path.toLowerCase().split("/").pop()!)) {
        results.push(card.relativePath);
      }
    }
    for (const ref of card.meta.code_refs ?? []) {
      if (ref.path.toLowerCase().includes(fileBase) || fileBase.includes(ref.path.toLowerCase().split("/").pop()!)) {
        results.push(card.relativePath);
      }
    }
    for (const ref of card.meta.test_refs ?? []) {
      if (ref.path.toLowerCase().includes(fileBase) || fileBase.includes(ref.path.toLowerCase().split("/").pop()!)) {
        results.push(card.relativePath);
      }
    }
  }
  return [...new Set(results)];
}

/**
 * Determines disposition for a file based on its content and signals.
 */
export function triageDisposition(
  file: FileRecord,
  content: string,
  cards: MemoryCard[]
): { disposition: Disposition; reason?: string; targetCards?: string[] } {
  // 1. Empty/binary -> rejected
  if (content.length === 0 || file.sizeBytes === 0) {
    return { disposition: "rejected", reason: "empty file" };
  }
  if (isBinaryFile(file)) {
    return { disposition: "rejected", reason: "binary file" };
  }

  // 2. Contains deprecated/superseded tags -> superseded
  if (/\b(deprecated|superseded|obsolete)\b/i.test(content)) {
    return { disposition: "superseded", reason: "deprecated/superseded markers in content" };
  }

  // 3. Legacy/archive paths
  const isLegacyPath = /(legacy|archive|old|deprecated)\//.test(file.path);
  const hasArchSignals = /\b(architecture|rationale|decision|constraint)\b/i.test(content);

  if (isLegacyPath && !hasArchSignals) {
    return { disposition: "historical-only", reason: "legacy path without architecture signals" };
  }
  if (isLegacyPath && hasArchSignals) {
    return { disposition: "rationale-only", reason: "legacy path with rationale signals" };
  }

  // 4. Rationale tags -> rationale-only
  if (/\b(rationale|why|reason|ADR|decision record)\b/i.test(content)) {
    return { disposition: "rationale-only", reason: "rationale markers in content" };
  }

  // 5. Current-doc signals -> extracted
  const currentDocSignals = /\b(architecture|flow|deploy|config|test|ops|API|runtime)\b/i.test(content);
  if (currentDocSignals && file.kind === "doc") {
    const targetCards = findTargetCards(file, cards);
    return {
      disposition: "extracted",
      reason: "current documentation with durable signals",
      targetCards,
    };
  }

  // 6. Headings + current-candidate -> extracted (low confidence)
  if (file.kind === "doc" && /^#{1,3}\s/m.test(content)) {
    const targetCards = findTargetCards(file, cards);
    return {
      disposition: "extracted",
      reason: "document with headings (low confidence)",
      targetCards,
    };
  }

  // 7. Fallback -> rejected
  return { disposition: "rejected", reason: "no durable signals detected" };
}

/**
 * Creates initial source-coverage.json from discovery.
 * All dispositions = "unknown" initially.
 */
export async function createInitialCoverage(
  discovery: DiscoveryReport,
  options?: { root?: string }
): Promise<SourceCoverage> {
  const root = options?.root ?? process.cwd();
  const entries: SourceCoverageEntry[] = [];

  for (const file of discovery.files) {
    let sha256: string | undefined;
    try {
      const absPath = path.join(root, file.path);
      const content = await fs.readFile(absPath);
      const { createHash } = await import("node:crypto");
      sha256 = createHash("sha256").update(content).digest("hex");
    } catch {
      // File not accessible — skip hash
    }
    entries.push({
      path: file.path,
      sha256,
      sourceKind: (file.path.includes("submodule") ? "submodule-working-tree" : "git-tracked") as SourceCoverageEntry["sourceKind"],
      disposition: "unknown",
      targetCards: [],
    });
  }

  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.disposition] = (counts[entry.disposition] ?? 0) + 1;
  }

  return { entries, counts };
}

/**
 * Applies triage to coverage: replaces unknown with concrete disposition.
 */
export async function triageCoverage(
  coverage: SourceCoverage,
  discovery: DiscoveryReport,
  cards: MemoryCard[],
  options?: { root?: string }
): Promise<TriageResult> {
  const root = options?.root ?? process.cwd();
  const fileMap = new Map(discovery.files.map((f) => [f.path, f]));
  let updated = 0;

  const entries: SourceCoverageEntry[] = [];
  for (const entry of coverage.entries) {
    if (entry.disposition !== "unknown") {
      entries.push(entry);
      continue;
    }
    const file = fileMap.get(entry.path);
    if (!file) {
      entries.push({ ...entry, disposition: "rejected", reason: "file not found in discovery" });
      updated++;
      continue;
    }
    let content = "";
    try {
      const absPath = path.join(root, file.path);
      content = await fs.readFile(absPath, "utf8");
    } catch {
      // Can't read — treat as rejected
    }
    const result = triageDisposition(file, content, cards);
    entries.push({
      ...entry,
      disposition: result.disposition,
      reason: result.reason,
      targetCards: result.targetCards ?? [],
    });
    updated++;
  }

  const stillUnknown = entries.filter((e) => e.disposition === "unknown").length;
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.disposition] = (counts[entry.disposition] ?? 0) + 1;
  }

  return {
    coverage: { entries, counts },
    updated,
    stillUnknown,
  };
}

/**
 * Validates source-coverage.json.
 */
export function validateSourceCoverage(
  coverage: SourceCoverage,
  cards: MemoryCard[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Build a set of known card paths for targetCards validation
  const cardPaths = new Set(cards.map((c) => c.relativePath));
  const cardIds = new Set(cards.map((c) => c.meta.id));

  for (const entry of coverage.entries) {
    const disp = entry.disposition;

    // Rule 3: unknown after triage = ERROR
    if (disp === "unknown") {
      errors.push(`${entry.path}: disposition is still "unknown" after triage`);
    }

    // Rule 4: rejected/deferred/unknown require reason
    if (["rejected", "deferred", "unknown"].includes(disp) && !entry.reason) {
      errors.push(`${entry.path}: disposition "${disp}" requires a reason`);
    }

    // Rule 5: extracted/rationale-only/superseded require non-empty targetCards
    if (["extracted", "rationale-only", "superseded"].includes(disp)) {
      if (!entry.targetCards || entry.targetCards.length === 0) {
        errors.push(`${entry.path}: disposition "${disp}" requires non-empty targetCards`);
      }
    }

    // Rule 6: historical-only must NOT have targetCards
    if (disp === "historical-only" && entry.targetCards && entry.targetCards.length > 0) {
      errors.push(`${entry.path}: disposition "historical-only" must not have targetCards`);
    }

    // Rule 7: targetCards paths must exist (either as relative path or card id)
    if (entry.targetCards) {
      for (const cardRef of entry.targetCards) {
        if (!cardPaths.has(cardRef) && !cardIds.has(cardRef)) {
          warnings.push(`${entry.path}: targetCards reference "${cardRef}" does not match any known card path or id`);
        }
      }
    }
  }

  return { errors, warnings };
}

/**
 * Orchestrates the full triage pipeline:
 * 1. Discover project files
 * 2. Load memory cards
 * 3. Create initial coverage
 * 4. Build content maps
 * 5. Triage each unknown file
 * 6. Save coverage (throws if >30% still unknown)
 */
export async function triageSources(options?: {
  root?: string;
  buildDir?: string;
  dryRun?: boolean;
  /** Override triageDisposition for testing */
  dispositionFn?: typeof triageDisposition;
}): Promise<TriageResult & { contentMaps: SourceContentMap[]; contentMapPath: string }> {
  const root = resolveRoot(options);
  const memoryRoot = resolveMemoryRoot(options);

  const discovery = await discoverProject({ root });
  const cards = await loadMemoryCards({ root }).catch(() => []);
  const initialCoverage = await createInitialCoverage(discovery, { root });

  const { maps: contentMaps, path: contentMapPath } = await buildAllContentMaps(discovery, cards, { root, buildDir: options?.buildDir });

  // Triage each file
  let updated = 0;
  for (let i = 0; i < initialCoverage.entries.length; i++) {
    const entry = initialCoverage.entries[i];
    if (entry.disposition !== "unknown") continue;
    const file = discovery.files.find(f => f.path === entry.path);
    if (!file) continue;
    let content = "";
    try { content = await fs.readFile(path.join(root, file.path), "utf8"); } catch { /* binary */ }
    const result = (options?.dispositionFn ?? triageDisposition)(file, content, cards);
    initialCoverage.entries[i].disposition = result.disposition;
    if (result.reason) initialCoverage.entries[i].reason = result.reason;
    if (result.targetCards) initialCoverage.entries[i].targetCards = result.targetCards;
    updated++;
  }

  const stillUnknown = initialCoverage.entries.filter(e => e.disposition === "unknown").length;

  if (initialCoverage.entries.length > 0 && stillUnknown / initialCoverage.entries.length > 0.3) {
    const unknownFiles = initialCoverage.entries.filter(e => e.disposition === "unknown").map(e => e.path);
    throw new Error(`Triage failed: ${stillUnknown}/${initialCoverage.entries.length} files still unknown (>30%). Files: ${unknownFiles.slice(0, 10).join(", ")}${unknownFiles.length > 10 ? "..." : ""}`);
  }

  // Save coverage
  if (!options?.dryRun) {
    const coveragePath = path.join(memoryRoot, "source-coverage.json");
    await fs.writeFile(coveragePath, JSON.stringify(initialCoverage, null, 2), "utf8");
  }

  return { coverage: initialCoverage, updated, stillUnknown, contentMaps, contentMapPath };
}
