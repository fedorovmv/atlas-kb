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
