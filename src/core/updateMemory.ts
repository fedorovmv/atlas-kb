import { writeFile } from "node:fs/promises";
import yaml from "js-yaml";
import { loadMemoryCards, findCardById } from "./loadMemory.js";
import { resolveRoot } from "./paths.js";
import type { RepoMemoryOptions } from "./types.js";

export type UpdateOptions = RepoMemoryOptions & {
  body?: string;
  fields?: Record<string, unknown>;
};

export type UpdateResult = {
  id: string;
  path: string;
  updated: boolean;
  changes: string[];
};

export async function updateMemoryCard(id: string, options: UpdateOptions): Promise<UpdateResult> {
  const root = resolveRoot(options);
  const cards = await loadMemoryCards(options);
  const card = findCardById(cards, id);
  if (!card) {
    throw new Error(`Memory card not found: ${id}`);
  }

  const changes: string[] = [];
  let newBody = card.body;
  let newMeta: Record<string, unknown> = { ...card.meta };

  // Replace body if provided
  if (options.body !== undefined) {
    newBody = options.body;
    changes.push("body");
  }

  // Set specific frontmatter fields if provided
  if (options.fields) {
    for (const [key, value] of Object.entries(options.fields)) {
      newMeta[key] = value;
      changes.push(`frontmatter.${key}`);
    }
  }

  if (changes.length === 0) {
    return { id, path: card.relativePath, updated: false, changes: [] };
  }

  // Reconstruct file: preserve frontmatter structure, replace body
  // Use gray-matter stringify to safely serialize
  const frontmatterYaml = yaml.dump(newMeta, { lineWidth: -1 }).trimEnd();
  const content = `---\n${frontmatterYaml}\n---\n\n${newBody.trimStart()}\n`;

  await writeFile(card.path, content, "utf8");

  return { id, path: card.relativePath, updated: true, changes };
}
