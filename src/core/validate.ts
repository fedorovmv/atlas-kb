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

    if (m.status === "current" && ["spec_only", "inferred", "unknown"].includes(m.evidence_level)) {
      warnings.push(`${card.relativePath}: current file has weak evidence_level=${m.evidence_level}`);
    }

    if (m.status === "current" && m.review_required) {
      warnings.push(`${card.relativePath}: current file still has review_required=true`);
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
