import type { MemoryCard } from "./types.js";

export function tokenize(input: string): string[] {
  return [...new Set((input.toLowerCase().match(/[\p{L}\p{N}_\-.]{3,}/gu) ?? []))];
}

export function cardHaystack(card: MemoryCard) {
  const m = card.meta;
  return [
    m.id,
    m.title,
    m.entity_type,
    m.status,
    m.authority,
    m.evidence_level,
    m.stability,
    ...(m.agent_summary ? [m.agent_summary] : []),
    ...m.knowledge_types,
    ...m.product_areas,
    ...m.aliases,
    ...m.related_modules,
    ...m.related_scenarios,
    ...m.related_decisions,
    ...m.affects_modules,
    ...m.affects_scenarios,
    ...m.affects_decisions,
    ...m.code_refs.map((ref) => ref.path),
    ...m.test_refs.map((ref) => ref.path),
    card.body.slice(0, 6000),
  ].join("\n").toLowerCase();
}

export function scoreCard(card: MemoryCard, query: string): number {
  const haystack = cardHaystack(card);
  const tokens = tokenize(query);
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += token.includes("-") ? 2 : 1;
  }
  if (haystack.includes(query.toLowerCase())) score += 5;
  if (card.meta.status === "current") score += 0.25;
  if (card.meta.entity_type === "decision" && tokens.some((t) => ["why", "почему", "rationale", "границ"].includes(t))) score += 2;

  // Evidence quality weighting — prefer confirmed evidence over heuristic/unconfirmed
  const evidenceBoost: Record<string, number> = {
    code_confirmed: 0.5,
    test_confirmed: 0.4,
    contract_confirmed: 0.4,
    reviewed_doc: 0.2,
    heuristic_match: 0.0,   // keyword match, not verified — no boost
    spec_only: -0.1,        // unconfirmed spec — slight penalty
    inferred: -0.1,         // inferred — slight penalty
    unknown: -0.2,          // unknown evidence — stronger penalty
  };
  score += evidenceBoost[card.meta.evidence_level] ?? 0;

  return score;
}
