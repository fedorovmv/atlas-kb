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
  return score;
}
