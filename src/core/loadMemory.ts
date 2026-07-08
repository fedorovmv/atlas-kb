import path from "node:path";
import { readFile } from "node:fs/promises";
import fg from "fast-glob";
import matter from "gray-matter";
import { MemoryFrontmatterSchema } from "../schemas/frontmatter.js";
import type { MemoryCard, RepoMemoryOptions } from "./types.js";
import { resolveMemoryRoot, resolveRoot, toPosixPath } from "./paths.js";

export async function findMemoryMarkdownFiles(options: RepoMemoryOptions = {}) {
  const root = resolveRoot(options);
  const memoryRoot = resolveMemoryRoot(options);
  const pattern = toPosixPath(path.relative(root, path.join(memoryRoot, "**/*.md")));
  return fg(pattern, {
    cwd: root,
    dot: true,
    onlyFiles: true,
    absolute: false,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });
}

export async function loadMemoryCards(options: RepoMemoryOptions = {}): Promise<MemoryCard[]> {
  const root = resolveRoot(options);
  const files = await findMemoryMarkdownFiles(options);
  const cards: MemoryCard[] = [];

  for (const relativePath of files) {
    const absolutePath = path.join(root, relativePath);
    const raw = await readFile(absolutePath, "utf8");
    if (!raw.trimStart().startsWith("---")) continue;

    const parsed = matter(raw);
    const meta = MemoryFrontmatterSchema.parse(parsed.data);
    cards.push({
      path: absolutePath,
      relativePath: toPosixPath(relativePath),
      meta,
      body: parsed.content,
      raw,
    });
  }

  return cards.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function findCardById(cards: MemoryCard[], id: string) {
  return cards.find((card) => card.meta.id === id);
}
