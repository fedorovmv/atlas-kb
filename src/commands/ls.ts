import { loadMemoryCards } from "../core/loadMemory.js";
import type { EntityType, Status } from "../schemas/frontmatter.js";

export async function listMemory(options: { type?: EntityType; status?: Status; root?: string; json?: boolean } = {}) {
  const cards = await loadMemoryCards({ root: options.root });
  const filtered = cards.filter((card) => {
    if (options.type && card.meta.entity_type !== options.type) return false;
    if (options.status && card.meta.status !== options.status) return false;
    return true;
  });

  if (options.json) {
    console.log(JSON.stringify(filtered.map((card) => ({
      id: card.meta.id,
      title: card.meta.title,
      entity_type: card.meta.entity_type,
      status: card.meta.status,
      evidence_level: card.meta.evidence_level,
      path: card.relativePath,
    })), null, 2));
    return;
  }

  for (const card of filtered) {
    console.log(`${card.meta.id}\t${card.meta.entity_type}\t${card.meta.status}\t${card.meta.evidence_level}\t${card.relativePath}`);
  }
}
