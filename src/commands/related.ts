import { loadMemoryCards } from "../core/loadMemory.js";
import { getRelatedCards, RELATION_FIELDS } from "../core/relations.js";

export async function relatedMemory(id: string, options: { root?: string; json?: boolean } = {}) {
  const cards = await loadMemoryCards({ root: options.root });
  const result = getRelatedCards(cards, id);
  if (!result.card) throw new Error(`Memory card not found: ${id}`);

  if (options.json) {
    console.log(JSON.stringify({
      id,
      path: result.card.relativePath,
      direct: result.direct.map((card) => ({ id: card.meta.id, path: card.relativePath, type: card.meta.entity_type })),
      reverse: result.reverse.map((card) => ({ id: card.meta.id, path: card.relativePath, type: card.meta.entity_type })),
    }, null, 2));
    return;
  }

  console.log(`# Related entities for \`${id}\``);
  console.log(`\nFile: \`${result.card.relativePath}\``);

  for (const field of RELATION_FIELDS) {
    const values = result.card.meta[field] ?? [];
    if (!values.length) continue;
    console.log(`\n## ${field}`);
    for (const value of values) {
      const target = cards.find((card) => card.meta.id === value);
      console.log(target ? `- \`${value}\` — ${target.relativePath}` : `- \`${value}\` — missing memory card`);
    }
  }

  if (result.reverse.length) {
    console.log(`\n## reverse references`);
    for (const card of result.reverse) {
      console.log(`- \`${card.meta.id}\` — ${card.relativePath}`);
    }
  }
}
