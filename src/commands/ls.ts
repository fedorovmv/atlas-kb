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
  // Phase 6: normalize to lowercase for case-insensitive comparison — prevents silent loop resets on LLM casing variance
  const presentHeadings = new Set(bodyLines.filter((l) => /^##\s/.test(l.trimStart())).map((l) => l.trimStart().toLowerCase()));
  return contract.required.some((req) => !presentHeadings.has(req.toLowerCase()));
}

export async function listMemory(options: {
  type?: EntityType;
  status?: Status;
  root?: string;
  json?: boolean;
  needsEnrichment?: boolean;
  needsEnrichmentContent?: boolean;
  needsEnrichmentLinks?: boolean;
  needsEnrichmentReview?: boolean;
} = {}) {
  const cards = await loadMemoryCardsBestEffort({ root: options.root });
  const filtered = cards.filter((card) => {
    if (options.type && card.meta.entity_type !== options.type) return false;
    if (options.status && card.meta.status !== options.status) return false;
    const flagEnabled = options.needsEnrichment || options.needsEnrichmentContent || options.needsEnrichmentLinks || options.needsEnrichmentReview;
    if (flagEnabled) {
      // Phase 1: terminal cards with weak-but-acceptable evidence, no placeholder, sections complete
      // Covers: proposal/historical spec_only, decision reviewed_doc, architecture reviewed_doc
      const isTerminalEntity =
        (card.meta.entity_type === "proposal" || card.meta.entity_type === "historical") && card.meta.evidence_level === "spec_only" ||
        card.meta.entity_type === "decision" && card.meta.evidence_level === "reviewed_doc" ||
        card.meta.entity_type === "architecture" && card.meta.evidence_level === "reviewed_doc";
      if (isTerminalEntity &&
          !hasPlaceholderContent(card.body) &&
          !hasMissingRequiredSections(card.meta.entity_type, card.body)) {
        return false;  // terminal, done — not needs-enrichment
      }
      const weakEvidence = ["inferred", "spec_only", "unknown", "heuristic_match"].includes(card.meta.evidence_level);
      const needsReview = card.meta.status === "needs_review" || card.meta.review_required === true;
      const hasPlaceholder = hasPlaceholderContent(card.body);
      const missingSections = hasMissingRequiredSections(card.meta.entity_type, card.body);
      const emptyCrossLinks = areCrossLinksEmpty(card.meta);

      let include = false;

      // Content check: placeholders + weak evidence + missing sections
      if (options.needsEnrichment || options.needsEnrichmentContent) {
        if (weakEvidence || hasPlaceholder || missingSections) include = true;
      }

      // Links check: empty cross-links with accept-empty after 2 attempts
      if (options.needsEnrichment || options.needsEnrichmentLinks) {
        if (emptyCrossLinks) {
          const trackingEnabled = process.env.ENABLE_CROSS_LINK_TRACKING === "1" || process.env.ENABLE_CROSS_LINK_TRACKING === "true";
          if (trackingEnabled) {
            const attempts = (card.meta.cross_link_attempts ?? 0) as number;
            const hasBroken = (card.meta.has_broken_relations ?? false) as boolean;
            // Accept empty after 2 attempts UNLESS broken relations flag set
            if (attempts < 2 || hasBroken) include = true;
          } else {
            include = true;
          }
        }
      }

      // Review check: status=needs_review
      if (options.needsEnrichment || options.needsEnrichmentReview) {
        if (needsReview) include = true;
      }

      if (!include) return false;
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
      cross_link_attempts: card.meta.cross_link_attempts,
      has_broken_relations: card.meta.has_broken_relations,
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

export function areCrossLinksEmpty(meta: { entity_type: string; related_modules?: unknown[]; related_scenarios?: unknown[]; related_decisions?: unknown[]; affects_modules?: unknown[]; affects_scenarios?: unknown[] }): boolean {
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
  if (meta.entity_type === "scenario") {
    const related = (meta.related_modules ?? []) as unknown[];
    if (related.length === 0) return true;
  }
  return false;
}
