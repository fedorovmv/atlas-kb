import path from "node:path";
import { existsSync } from "node:fs";
import fg from "fast-glob";
import matter from "gray-matter";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { MemoryFrontmatterSchema } from "../schemas/frontmatter.js";
import type { MemoryCard, RepoMemoryOptions, ValidationResult } from "./types.js";
import { findMemoryMarkdownFiles, loadMemoryCards } from "./loadMemory.js";
import { RELATION_FIELDS } from "./relations.js";
import { resolveRoot } from "./paths.js";
import { hasQualityEvidenceSection } from "./evidenceSection.js";

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

export async function validateMemory(options: RepoMemoryOptions = {}): Promise<ValidationResult> {
  const root = resolveRoot(options);
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

    if (m.evidence_level === "spec_only" && m.knowledge_types.includes("current_behavior")) {
      errors.push(`${card.relativePath}: spec_only evidence cannot claim current_behavior without code/test/contract evidence`);
    }

    if (m.evidence_level === "code_confirmed" && !hasQualityEvidenceSection(card.body, "Code evidence")) {
      errors.push(`${card.relativePath}: evidence_level=code_confirmed requires ## Code evidence section with entries in format 'description at <path>:<line> (symbol_name)'`);
    }
    if (m.evidence_level === "test_confirmed" && !hasQualityEvidenceSection(card.body, "Test evidence")) {
      errors.push(`${card.relativePath}: evidence_level=test_confirmed requires ## Test evidence section with entries in format 'description at <path>:<line> (symbol_name)'`);
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

  return { ok: errors.length === 0, errors, warnings };
}

/** Check if memory bank is unenriched — all cards needs_review, no current. */
export function checkEnrichmentStatus(cards: MemoryCard[]): { enriched: boolean; currentCount: number; needsReviewCount: number; heuristicCount: number } {
  const currentCount = cards.filter((c) => c.meta.status === "current").length;
  const needsReviewCount = cards.filter((c) => c.meta.status === "needs_review").length;
  const heuristicCount = cards.filter((c) => c.meta.evidence_level === "heuristic_match").length;
  const enriched = currentCount > 0 || needsReviewCount === 0;
  return { enriched, currentCount, needsReviewCount, heuristicCount };
}
