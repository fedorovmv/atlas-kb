import { buildMemoryContext } from "../core/context.js";

export async function contextMemory(query: string, options: { root?: string; limit?: number; json?: boolean } = {}) {
  const context = await buildMemoryContext(query, { root: options.root, limit: options.limit });

  if (options.json) {
    console.log(JSON.stringify({
      query: context.query,
      selected: context.selected.map((card) => ({ id: card.meta.id, path: card.relativePath, type: card.meta.entity_type, status: card.meta.status })),
      related: context.related.map((card) => ({ id: card.meta.id, path: card.relativePath, type: card.meta.entity_type, status: card.meta.status })),
      codeRefs: context.codeRefs,
      testRefs: context.testRefs,
    }, null, 2));
    return;
  }

  console.log(context.markdown);
}
