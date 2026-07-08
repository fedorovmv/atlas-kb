import { loadMemoryCards, findCardById } from "../core/loadMemory.js";

export async function showMemory(id: string, options: { root?: string; json?: boolean } = {}) {
  const cards = await loadMemoryCards({ root: options.root });
  const card = findCardById(cards, id);
  if (!card) throw new Error(`Memory card not found: ${id}`);

  if (options.json) {
    console.log(JSON.stringify({ path: card.relativePath, meta: card.meta, body: card.body }, null, 2));
    return;
  }

  console.log(card.raw);
}
