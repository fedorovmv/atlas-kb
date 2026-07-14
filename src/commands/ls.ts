import { loadMemoryCardsBestEffort } from "../core/loadMemory.js";
import type { EntityType, Status } from "../schemas/frontmatter.js";

const PLACEHOLDER_PATTERNS = [
  /Требует ревью/,
  /Не задокументировано в спецификации/,
  /Не задокументировано в коде/,
  /^Needs review/i,
  /^TBD/i,
  /^TODO/i,
];

function hasPlaceholderContent(body: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pat) => pat.test(body));
}

export async function listMemory(options: { type?: EntityType; status?: Status; root?: string; json?: boolean; needsEnrichment?: boolean } = {}) {
  const cards = await loadMemoryCardsBestEffort({ root: options.root });
  const filtered = cards.filter((card) => {
    if (options.type && card.meta.entity_type !== options.type) return false;
    if (options.status && card.meta.status !== options.status) return false;
    if (options.needsEnrichment) {
      // Card needs enrichment if: needs_review status, weak evidence, OR placeholder content
      const weakEvidence = ["inferred", "spec_only", "unknown"].includes(card.meta.evidence_level);
      const needsReview = card.meta.status === "needs_review" || card.meta.review_required;
      const hasPlaceholder = hasPlaceholderContent(card.body);
      if (!weakEvidence && !needsReview && !hasPlaceholder) return false;
    }
    return true;
  });

  if (options.json) {
    console.log(JSON.stringify(filtered.map((card) => ({
      id: card.meta.id,
      title: card.meta.title,
      entity_type: card.meta.entity_type,
      status: card.meta.status,
      evidence_level: card.meta.evidence_level,
      review_required: card.meta.review_required,
      has_placeholder: hasPlaceholderContent(card.body),
      path: card.relativePath,
    })), null, 2));
    return;
  }

  for (const card of filtered) {
    const placeholder = hasPlaceholderContent(card.body) ? "PLACEHOLDER" : "";
    console.log(`${card.meta.id}\t${card.meta.entity_type}\t${card.meta.status}\t${card.meta.evidence_level}\t${placeholder}\t${card.relativePath}`);
  }
}
