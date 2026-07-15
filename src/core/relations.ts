import type { MemoryCard } from "./types.js";

export const RELATION_FIELDS = [
  "related_modules",
  "related_scenarios",
  "related_decisions",
  "related_specs",
  "related_tests",
  "conflicts_with",
  "supersedes",
  "superseded_by",
  "affects_modules",
  "affects_scenarios",
  "affects_decisions",
] as const;

export type RelationField = (typeof RELATION_FIELDS)[number];

export function getDirectRelatedIds(card: MemoryCard): string[] {
  const result = new Set<string>();
  for (const field of RELATION_FIELDS) {
    for (const id of card.meta[field] ?? []) result.add(id);
  }
  return [...result].sort();
}

export function getReverseRelated(cards: MemoryCard[], id: string): MemoryCard[] {
  return cards.filter((card) => getDirectRelatedIds(card).includes(id));
}

export function getRelatedCards(cards: MemoryCard[], id: string) {
  const byId = new Map(cards.map((card) => [card.meta.id, card]));
  const card = byId.get(id);
  if (!card) return { card: undefined, direct: [], reverse: [] };

  const direct = getDirectRelatedIds(card)
    .map((relatedId) => byId.get(relatedId))
    .filter((value): value is MemoryCard => Boolean(value));
  const reverse = getReverseRelated(cards, id);
  return { card, direct, reverse };
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
