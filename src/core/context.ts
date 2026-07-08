import type { ContextPack, MemoryCard, RepoMemoryOptions } from "./types.js";
import { loadMemoryCards } from "./loadMemory.js";
import { getDirectRelatedIds } from "./relations.js";
import { scoreCard } from "./score.js";

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function compactExcerpt(body: string, max = 1200) {
  const normalized = body.trim().replace(/\n{3,}/g, "\n\n");
  return normalized.length <= max ? normalized : `${normalized.slice(0, max).trim()}\n...`;
}

function renderCardLine(card: MemoryCard) {
  return `- \`${card.relativePath}\` — ${card.meta.title} [${card.meta.entity_type}, ${card.meta.status}, evidence=${card.meta.evidence_level}]`;
}

export async function buildMemoryContext(query: string, options: RepoMemoryOptions & { limit?: number } = {}): Promise<ContextPack> {
  const limit = options.limit ?? 8;
  const cards = await loadMemoryCards(options);
  const scored = cards
    .map((card) => ({ card, score: scoreCard(card, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.card.relativePath.localeCompare(b.card.relativePath));

  const selected = scored.slice(0, limit).map((item) => item.card);
  const byId = new Map(cards.map((card) => [card.meta.id, card]));
  const relatedIds = unique(selected.flatMap((card) => getDirectRelatedIds(card)));
  const related = relatedIds
    .map((id) => byId.get(id))
    .filter((card): card is MemoryCard => Boolean(card))
    .filter((card) => !selected.some((selectedCard) => selectedCard.meta.id === card.meta.id))
    .slice(0, limit);

  const all = [...selected, ...related];
  const codeRefs = unique(all.flatMap((card) => card.meta.code_refs.map((ref) => ref.path))).sort();
  const testRefs = unique(all.flatMap((card) => card.meta.test_refs.map((ref) => ref.path))).sort();

  const markdown = [
    `# Memory context pack`,
    ``,
    `Task/query: ${query}`,
    ``,
    `## Recommended memory files`,
    ...(selected.length ? selected.map(renderCardLine) : ["- No matching memory files found."]),
    ``,
    `## Related memory files`,
    ...(related.length ? related.map(renderCardLine) : ["- No direct related memory files found." ]),
    ``,
    `## Related code paths`,
    ...(codeRefs.length ? codeRefs.map((ref) => `- \`${ref}\``) : ["- No code refs found."]),
    ``,
    `## Related test paths`,
    ...(testRefs.length ? testRefs.map((ref) => `- \`${ref}\``) : ["- No test refs found."]),
    ``,
    `## Source rules`,
    `- Prefer current code and tests over memory.`,
    `- Treat proposals as proposed behavior, not current behavior.`,
    `- Treat historical cards as rationale/context, not implementation guidance.`,
    `- Do not implement from rationale alone.`,
    `- If sources conflict, record the conflict.`,
    ``,
    `## Compact excerpts`,
    ...selected.flatMap((card) => [``, `### ${card.meta.title} — \`${card.relativePath}\``, compactExcerpt(card.body)]),
  ].join("\n");

  return { query, selected, related, codeRefs, testRefs, markdown };
}
