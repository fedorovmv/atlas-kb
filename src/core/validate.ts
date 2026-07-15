import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import fg from "fast-glob";
import matter from "gray-matter";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { MemoryFrontmatterSchema } from "../schemas/frontmatter.js";
import type { MemoryCard, RepoMemoryOptions, ValidationResult } from "./types.js";
import { findMemoryMarkdownFiles, loadMemoryCards } from "./loadMemory.js";
import { RELATION_FIELDS } from "./relations.js";
import { CARD_SECTION_CONTRACTS } from "../schemas/cardSections.js";
import { resolveRoot, resolveMemoryRoot } from "./paths.js";
import { hasQualityEvidenceSection } from "./evidenceSection.js";
import { validateCardSections } from "./cardSections.js";
import { checkRuntimeTierMismatch } from "./runtimeTier.js";
import { SourceCoverageSchema } from "../schemas/sourceCoverage.js";
import { validateSourceCoverage } from "./sourceCoverage.js";
import { readFileIfExists } from "./utils.js";
import { checkDispatchAdvisory } from "./dispatch.js";
import { areCrossLinksEmpty } from "../commands/ls.js";

// Known frontmatter keys — anything else is likely a typo
const KNOWN_FRONTMATTER_KEYS = new Set([
  "entity_type", "id", "title", "status", "authority", "evidence_level",
  "stability", "source_confidence", "last_reviewed", "review_required",
  "knowledge_types", "product_areas", "aliases",
  "related_modules", "related_scenarios", "related_decisions", "related_specs",
  "related_tests", "conflicts_with", "supersedes", "superseded_by",
  "affects_modules", "affects_scenarios", "affects_decisions",
  "code_refs", "test_refs", "source_refs",
  "usage_policy", "claims",
  "runtime_tier", "source_status",
  "agent_summary",
  "cross_link_attempts", "has_broken_relations",
]);

/** Simple Levenshtein distance for typo suggestion. */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((item) => `${item.path.join(".") || "frontmatter"}: ${item.message}`).join("; ");
}

export function checkStructural(memoryRoot: string, cards: MemoryCard[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const requiredTopLevel = [
    "MEMORY.md", "MODULES.md", "DECISIONS.md", "ARCHITECTURE.md",
  ];
  for (const file of requiredTopLevel) {
    if (!existsSync(path.join(memoryRoot, file))) {
      errors.push(`Missing required top-level file: ${file}`);
    }
  }

  const requiredSubdirs = ["modules", "flows", "decisions", "architecture"];
  for (const dir of requiredSubdirs) {
    if (!existsSync(path.join(memoryRoot, dir))) {
      errors.push(`Missing required subdirectory: ${dir}/`);
    }
  }

  const modulesPath = path.join(memoryRoot, "MODULES.md");
  if (existsSync(modulesPath)) {
    const content = readFileSync(modulesPath, "utf-8");
    if (!/production/i.test(content) || !/demo/i.test(content)) {
      warnings.push("MODULES.md should have production/demo/shared tier split");
    }
  }

  const archPath = path.join(memoryRoot, "ARCHITECTURE.md");
  const archDir = path.join(memoryRoot, "architecture");
  if (existsSync(archPath)) {
    const content = readFileSync(archPath, "utf-8");
    if (!/Architecture overview/i.test(content) && !existsSync(archDir)) {
      warnings.push('ARCHITECTURE.md should have "Architecture overview" section or architecture/*.md files');
    }
  }

  return { errors, warnings };
}

export function checkMarkdownLinks(cards: MemoryCard[], memoryRoot: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  for (const card of cards) {
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkPattern.exec(card.body)) !== null) {
      const linkPath = match[2];
      if (/^https?:\/\//.test(linkPath)) continue;
      if (linkPath.startsWith("#")) continue;
      const cardDir = path.dirname(card.path);
      const resolved = path.resolve(cardDir, linkPath);
      if (!existsSync(resolved)) {
        errors.push(`Card "${card.meta.id}": broken markdown link "${linkPath}"`);
      }
    }
  }
  return { errors, warnings: [] };
}

export async function validateMemory(options: RepoMemoryOptions = {}): Promise<ValidationResult> {
  const root = resolveRoot(options);
  const memoryRoot = resolveMemoryRoot(options);
  const errors: string[] = [];
  const warnings: string[] = [];
  const files = await findMemoryMarkdownFiles(options);
  const parsedCards: MemoryCard[] = [];

  for (const relativePath of files) {
    const absolutePath = path.join(root, relativePath);
    const raw = await readFile(absolutePath, "utf8");
    if (!raw.trimStart().startsWith("---")) {
      errors.push(`${relativePath}: missing YAML frontmatter`);
      continue;
    }

    try {
      const parsed = matter(raw);
      const meta = MemoryFrontmatterSchema.parse(parsed.data);

      // Check for unknown frontmatter keys (likely typos, e.g. evindence_level)
      const rawKeys = Object.keys(parsed.data);
      for (const key of rawKeys) {
        if (!KNOWN_FRONTMATTER_KEYS.has(key)) {
          // Suggest closest known key
          const suggestion = [...KNOWN_FRONTMATTER_KEYS].find((k) => {
            const dist = levenshtein(key.toLowerCase(), k.toLowerCase());
            return dist <= 2 && dist > 0;
          });
          const hint = suggestion ? ` — did you mean '${suggestion}'?` : "";
          warnings.push(`${relativePath}: unknown frontmatter field '${key}'${hint}`);
        }
      }

      parsedCards.push({ path: absolutePath, relativePath, meta, body: parsed.content, raw });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(`${relativePath}: invalid frontmatter: ${formatZodError(error)}`);
      } else {
        errors.push(`${relativePath}: failed to parse frontmatter: ${(error as Error).message}`);
      }
    }
  }

  let cards: MemoryCard[] = parsedCards;
  try {
    cards = parsedCards.length === files.length ? parsedCards : await loadMemoryCards(options);
  } catch {
    // Keep parsedCards. Detailed parse errors were already collected above.
  }

  const byId = new Map<string, MemoryCard>();
  for (const card of cards) {
    const existing = byId.get(card.meta.id);
    if (existing) {
      errors.push(`duplicate id "${card.meta.id}": ${existing.relativePath} and ${card.relativePath}`);
    } else {
      byId.set(card.meta.id, card);
    }
  }

  const allIds = new Set(byId.keys());

  for (const card of cards) {
    const m = card.meta;

    if ((m.entity_type === "proposal" || m.status === "proposed") && m.usage_policy.can_answer_current_behavior) {
      errors.push(`${card.relativePath}: proposal/proposed memory cannot answer current behavior`);
    }

    if ((m.entity_type === "proposal" || m.entity_type === "historical" || m.status === "historical") && m.usage_policy.can_generate_code_from) {
      errors.push(`${card.relativePath}: proposal/historical memory cannot be direct code generation source`);
    }

    if (m.entity_type === "decision" && m.usage_policy.can_generate_code_from) {
      errors.push(`${card.relativePath}: decision/rationale must not be direct code generation source`);
    }

    if (m.status === "current" && m.knowledge_types.includes("proposed_behavior")) {
      errors.push(`${card.relativePath}: current file must not mix proposed_behavior in knowledge_types`);
    }

    if (m.status === "current" && ["spec_only", "inferred", "unknown", "heuristic_match"].includes(m.evidence_level)) {
      if (m.evidence_level === "heuristic_match") {
        errors.push(`${card.relativePath}: current file has evidence_level=heuristic_match — requires code_confirmed or test_confirmed (LLM verification needed)`);
      } else {
        warnings.push(`${card.relativePath}: current file has weak evidence_level=${m.evidence_level}`);
      }
    }

    if (m.status === "current" && m.review_required) {
      warnings.push(`${card.relativePath}: current file still has review_required=true`);
    }

    // Cross-link validation: warn/error for current cards with empty cross-links
    if (m.status === "current" && ["module", "decision", "scenario"].includes(m.entity_type)) {
      if (areCrossLinksEmpty(m)) {
        if (m.cross_link_attempts >= 2 && !m.has_broken_relations) {
          errors.push(`${card.relativePath}: current ${m.entity_type} card has empty cross-links after ${m.cross_link_attempts} attempts — run atlas-analyst cross-linking pass`);
        } else if (m.cross_link_attempts < 2) {
          warnings.push(`${card.relativePath}: current ${m.entity_type} card has empty cross-links (attempts: ${m.cross_link_attempts}) — cross-linking needed`);
        }
      }
    }

    // agent_summary warning for current cards
    if (m.status === "current" && !m.agent_summary?.trim()) {
      warnings.push(`${card.relativePath}: current card without agent_summary — add 1-2 sentence summary for agent use`);
    }

    if (m.evidence_level === "spec_only" && m.knowledge_types.includes("current_behavior")) {
      errors.push(`${card.relativePath}: spec_only evidence cannot claim current_behavior without code/test/contract evidence`);
    }

    if (m.evidence_level === "code_confirmed" && !hasQualityEvidenceSection(card.body, "Свидетельства из кода")) {
      errors.push(`${card.relativePath}: evidence_level=code_confirmed требует секцию ## Свидетельства из кода с записями в формате 'описание at <путь>:<строка> (имя_символа)'`);
    }
    if (m.evidence_level === "test_confirmed" && !hasQualityEvidenceSection(card.body, "Свидетельства из тестов")) {
      errors.push(`${card.relativePath}: evidence_level=test_confirmed требует секцию ## Свидетельства из тестов с записями в формате 'описание at <путь>:<строка> (имя_символа)'`);
    }

    for (const field of RELATION_FIELDS) {
      for (const id of m[field] ?? []) {
        if (!allIds.has(id)) errors.push(`${card.relativePath}: broken relation ${field}: ${id}`);
      }
    }

    for (const ref of [...m.code_refs, ...m.test_refs]) {
      const resolved = path.resolve(root, ref.path);
      const matches = ref.path.includes("*") ? fg.sync(ref.path, { cwd: root, dot: true }) : [];
      if (!existsSync(resolved) && matches.length === 0) {
        warnings.push(`${card.relativePath}: referenced path/glob does not exist: ${ref.path}`);
      }
    }
  }

  // Card sections validation — skip cards still needing review or auto-generated from weak evidence
  for (const card of cards) {
    if (card.meta.review_required) continue;
    const sectionResult = validateCardSections(card);
    for (const err of sectionResult.errors) {
      errors.push(err);
    }
    if (options.strictWarnings) {
      for (const warn of sectionResult.warnings) {
        errors.push(warn);
      }
    } else {
      for (const warn of sectionResult.warnings) {
        warnings.push(warn);
      }
    }
  }

  // Runtime tier mismatch warnings
  for (const card of cards) {
    const tierWarnings = checkRuntimeTierMismatch(card);
    warnings.push(...tierWarnings);
  }

  // Reference study validation
  for (const card of cards) {
    if (card.meta.entity_type === "reference") {
      const refResult = validateReferenceStudy(card);
      errors.push(...refResult.errors);
      warnings.push(...refResult.warnings);

      // Async tree hash verification for reference cards with treeHash set
      const sourceRefs = card.meta.source_refs ?? [];
      if (sourceRefs.length > 0 && sourceRefs[0].treeHash) {
        const sourcePath = path.resolve(root, sourceRefs[0].path);
        if (existsSync(sourcePath)) {
          try {
            const { treeHash } = await import("./hashing.js");
            const computed = await treeHash([sourcePath]);
            if (computed !== sourceRefs[0].treeHash) {
              errors.push(`Card "${card.meta.id}": reference study tree hash mismatch — expected ${sourceRefs[0].treeHash.slice(0, 16)}, got ${computed.slice(0, 16)}`);
            }
          } catch {
            // hashing module unavailable — skip
          }
        }
      }
    }
  }

  // Source coverage validation (if --require-source-coverage)
  if (options.requireSourceCoverage) {
    const memoryRoot = resolveMemoryRoot(options);
    const coveragePath = path.join(memoryRoot, "source-coverage.json");
    const coverageContent = await readFileIfExists(coveragePath);
    if (!coverageContent) {
      errors.push("source-coverage.json not found (required by --require-source-coverage)");
    } else {
      try {
        const coverage = SourceCoverageSchema.parse(JSON.parse(coverageContent));
        const covResult = validateSourceCoverage(coverage, cards);
        errors.push(...covResult.errors);
        warnings.push(...covResult.warnings);
      } catch (e) {
        errors.push(`source-coverage.json: invalid schema: ${(e as Error).message}`);
      }
    }
  }

  // Specialist dispatch advisory (if --check-dispatch, warnings only)
  if (options.checkDispatch) {
    const advisory = await checkDispatchAdvisory({ root });
    warnings.push(...advisory.warnings);
  }

  // Contract-first checks (structural completeness + markdown links)
  if (options.checkContract) {
    const structuralResult = checkStructural(memoryRoot, cards);
    errors.push(...structuralResult.errors);
    warnings.push(...structuralResult.warnings);

    const linkResult = checkMarkdownLinks(cards, memoryRoot);
    errors.push(...linkResult.errors);
  }

  // Long code blocks (25+ lines)
  for (const card of cards) {
    const codeBlockPattern = /```[\s\S]*?```/g;
    const matches = card.body.match(codeBlockPattern) ?? [];
    for (const block of matches) {
      const lines = block.split("\n").length - 2;
      if (lines > 25) {
        warnings.push(`Card "${card.meta.id}": code block with ${lines} lines (consider summarizing)`);
      }
    }
  }

  // Error budget
  const maxErrors = options.maxErrors ?? 50;
  if (errors.length > maxErrors) {
    errors.splice(maxErrors);
    errors.push(`... truncated at ${maxErrors} errors (use --max-errors to increase)`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Validate reference study cards — 6 required sections, no placeholders, source path check. */
export function validateReferenceStudy(card: MemoryCard): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (card.meta.entity_type !== "reference") return { errors, warnings };

  const requiredSections = CARD_SECTION_CONTRACTS.reference.required;

  const presentSections = new Set<string>();
  for (const line of card.body.split("\n")) {
    const trimmed = line.trimStart();
    if (/^## /.test(trimmed)) presentSections.add(trimmed);
  }

  for (const section of requiredSections) {
    if (!presentSections.has(section)) {
      errors.push(`Card "${card.meta.id}": reference study missing required section "${section}"`);
    }
  }

  // Placeholder check in sections
  const placeholderPattern = /Needs review|TBD|TODO|FIXME|Placeholder|PENDING|Требует ревью/i;
  const sections = card.body.split(/^## /m).slice(1);
  for (const section of sections) {
    const sectionName = section.split("\n")[0].trim();
    if (placeholderPattern.test(section)) {
      errors.push(`Card "${card.meta.id}": reference study section "## ${sectionName}" contains placeholder content`);
    }
  }

  // Source path validation — resolve relative to cwd (best effort for unit tests)
  const sourceRefs = card.meta.source_refs ?? [];
  if (sourceRefs.length > 0) {
    const sourceRef = sourceRefs[0];
    const sourcePath = path.resolve(process.cwd(), sourceRef.path);
    if (!existsSync(sourcePath)) {
      warnings.push(`Card "${card.meta.id}": reference study source path may not exist: ${sourceRef.path}`);
    } else if (sourceRef.treeHash) {
      // treeHash present — async verification in validateMemory() handles mismatch/errors
    } else {
      // Existing reference cards without treeHash → WARNING (backward compat)
      warnings.push(`Card "${card.meta.id}": reference study source_ref has no treeHash — consider running 'atlas migrate' to auto-fill`);
    }
  }

  return { errors, warnings };
}

/** Check if memory bank is unenriched — all cards needs_review, no current. */
export function checkEnrichmentStatus(cards: MemoryCard[]): { enriched: boolean; currentCount: number; needsReviewCount: number; heuristicCount: number } {
  const currentCount = cards.filter((c) => c.meta.status === "current").length;
  const needsReviewCount = cards.filter((c) => c.meta.status === "needs_review").length;
  const heuristicCount = cards.filter((c) => c.meta.evidence_level === "heuristic_match").length;
  const enriched = currentCount > 0 || needsReviewCount === 0;
  return { enriched, currentCount, needsReviewCount, heuristicCount };
}
