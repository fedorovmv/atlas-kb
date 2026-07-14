import { loadMemoryCardsBestEffort } from "../core/loadMemory.js";
import { CARD_SECTION_CONTRACTS } from "../schemas/cardSections.js";
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

function hasMissingRequiredSections(entityType: string, body: string): boolean {
  const contract = (CARD_SECTION_CONTRACTS as Record<string, { required: string[] }>)[entityType];
  if (!contract || !contract.required || contract.required.length === 0) return false;
  const bodyLines = body.split("\n");
  const presentHeadings = new Set(bodyLines.filter((l) => /^##\s/.test(l.trimStart())).map((l) => l.trimStart()));
  return contract.required.some((req) => !presentHeadings.has(req));
}

export async function listMemory(options: { type?: EntityType; status?: Status; root?: string; json?: boolean; needsEnrichment?: boolean } = {}) {
  const cards = await loadMemoryCardsBestEffort({ root: options.root });
  const filtered = cards.filter((card) => {
    if (options.type && card.meta.entity_type !== options.type) return false;
    if (options.status && card.meta.status !== options.status) return false;
    if (options.needsEnrichment) {
      const weakEvidence = ["inferred", "spec_only", "unknown", "heuristic_match"].includes(card.meta.evidence_level);
      const needsReview = card.meta.status === "needs_review" || card.meta.review_required === true;
      const hasPlaceholder = hasPlaceholderContent(card.body);
      const missingSections = hasMissingRequiredSections(card.meta.entity_type, card.body);
      const emptyCrossLinks = areCrossLinksEmpty(card.meta);
      if (!weakEvidence && !needsReview && !hasPlaceholder && !missingSections && !emptyCrossLinks) return false;
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
      missing_sections: hasMissingRequiredSections(card.meta.entity_type, card.body),
      empty_crosslinks: areCrossLinksEmpty(card.meta),
      path: card.relativePath,
    })), null, 2));
    return;
  }

  for (const card of filtered) {
    const flags = [
      hasPlaceholderContent(card.body) ? "PLACEHOLDER" : "",
      hasMissingRequiredSections(card.meta.entity_type, card.body) ? "MISSING_SECTIONS" : "",
      areCrossLinksEmpty(card.meta) ? "NO_CROSSLINKS" : "",
    ].filter(Boolean).join(",");
    console.log(`${card.meta.id}\t${card.meta.entity_type}\t${card.meta.status}\t${card.meta.evidence_level}\t${flags}\t${card.relativePath}`);
  }
}

function areCrossLinksEmpty(meta: { entity_type: string; related_modules?: unknown[]; related_scenarios?: unknown[]; related_decisions?: unknown[]; affects_modules?: unknown[]; affects_scenarios?: unknown[] }): boolean {
  // Only check cross-links for card types that should have them
  if (meta.entity_type === "decision" || meta.entity_type === "proposal") {
    const related = (meta.related_modules ?? []) as unknown[];
    const affects = (meta.affects_modules ?? []) as unknown[];
    if (related.length === 0 && affects.length === 0) return true;
  }
  if (meta.entity_type === "module") {
    const related = (meta.related_scenarios ?? []) as unknown[];
    if (related.length === 0) return true;
  }
  return false;
}
