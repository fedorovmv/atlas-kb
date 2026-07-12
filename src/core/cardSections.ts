import type { MemoryCard } from "./types.js";
import { CARD_SECTION_CONTRACTS } from "../schemas/cardSections.js";
import type { EntityType } from "../schemas/frontmatter.js";

/**
 * Extract H2 headings from Markdown body.
 * Returns an array of strings like "## Title" (with ##).
 * Ignores H1, H3+, and content inside code blocks.
 */
export function extractCardSections(body: string): string[] {
  const lines = body.split("\n");
  const sections: string[] = [];
  let inCodeBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const trimmedLeft = line.trimStart();
    if (/^## /.test(trimmedLeft)) {
      sections.push(trimmedLeft);
    }
  }
  return sections;
}

export interface SectionValidationResult {
  ok: boolean;
  missingRequired: string[];
  missingRecommended: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Validate a card against its section contract.
 */
export function validateCardSections(card: MemoryCard): SectionValidationResult {
  const contract = CARD_SECTION_CONTRACTS[card.meta.entity_type as EntityType];
  const result: SectionValidationResult = {
    ok: true,
    missingRequired: [],
    missingRecommended: [],
    errors: [],
    warnings: [],
  };

  if (!contract) {
    // No contract for this type — skip validation
    return result;
  }

  const present = extractCardSections(card.body);
  const presentSet = new Set(present.map((s) => s.trim()));

  for (const required of contract.required) {
    if (!presentSet.has(required)) {
      result.missingRequired.push(required);
      result.errors.push(
        `Card "${card.meta.id}" (${card.meta.entity_type}): missing required section "${required}"`
      );
    }
  }

  if (contract.recommended) {
    for (const rec of contract.recommended) {
      if (!presentSet.has(rec)) {
        result.missingRecommended.push(rec);
        result.warnings.push(
          `Card "${card.meta.id}" (${card.meta.entity_type}): missing recommended section "${rec}"`
        );
      }
    }
  }

  result.ok = result.errors.length === 0;
  return result;
}
