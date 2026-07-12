import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { ArtifactIndex, ArtifactEntry, ArtifactHit } from "../schemas/artifactIndex.js";
import { resolveRoot, resolveMemoryRoot, toPosixPath } from "./paths.js";

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".pdf",
  ".zip", ".gz", ".tar", ".bin", ".exe", ".so", ".dylib", ".dll",
]);

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB

function contentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function extractTitle(raw: string): string {
  // Try to find H1 heading in the body content
  const h1Match = raw.match(/^#\s+(.+)$/m);
  return h1Match ? h1Match[1].trim() : "";
}

function extractSignals(frontmatter: Record<string, unknown>): string[] {
  const signals: string[] = [];
  const topics = (frontmatter.topics as string[]) ?? (frontmatter.tags as string[]) ?? [];
  if (Array.isArray(topics)) signals.push(...topics);
  const productAreas = frontmatter.product_areas as string[] | undefined;
  if (Array.isArray(productAreas)) signals.push(...productAreas);
  const aliases = frontmatter.aliases as string[] | undefined;
  if (Array.isArray(aliases)) signals.push(...aliases);
  const knowledgeTypes = frontmatter.knowledge_types as string[] | undefined;
  if (Array.isArray(knowledgeTypes)) signals.push(...knowledgeTypes);
  return signals.filter(Boolean);
}

/**
 * Build an artifact index by scanning `.ai/memory/` for markdown files.
 * Phase 2 scope: only `.ai/memory/` is scanned (`.ai/docs/` and `.ai/drafts/` are deferred to Phase 3).
 */
export async function buildArtifactIndex(options: { root?: string }): Promise<ArtifactIndex> {
  const root = resolveRoot(options);
  const memoryRoot = resolveMemoryRoot(options);

  const pattern = toPosixPath(path.relative(root, path.join(memoryRoot, "**/*.md")));
  const files = await fg(pattern, {
    cwd: root,
    dot: true,
    onlyFiles: true,
    absolute: false,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  const entries: ArtifactEntry[] = [];

  for (const relativePath of files) {
    const ext = path.extname(relativePath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) continue;

    const absolutePath = path.join(root, relativePath);

    // Large file guard
    try {
      const raw = await readFile(absolutePath, "utf8");
      if (Buffer.byteLength(raw, "utf8") > MAX_FILE_SIZE) continue;

      if (!raw.trimStart().startsWith("---")) continue;

      const parsed = matter(raw);
      const fm = parsed.data as Record<string, unknown>;
      const title = (fm.title as string) || extractTitle(raw) || path.basename(relativePath, ".md");
      const kind = (fm.entity_type as string) || "unknown";
      const signals = extractSignals(fm);
      const hash = contentHash(raw);

      entries.push({
        path: toPosixPath(relativePath),
        title,
        kind,
        signals,
        contentHash: hash,
      });
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  const index: ArtifactIndex = {
    entries,
    generatedAt: new Date().toISOString(),
  };

  // Save index to .ai/memory-build/latest/artifact-index.json
  const buildDir = path.join(root, ".ai", "memory-build", "latest");
  await mkdir(buildDir, { recursive: true });
  await writeFile(
    path.join(buildDir, "artifact-index.json"),
    JSON.stringify(index, null, 2),
    "utf8",
  );

  return index;
}

/**
 * Search artifacts by query string with scoring.
 * - 4 points per term found in title (case-insensitive)
 * - 1 point per term found in haystack (path + kind + signals + title combined)
 * Returns top `limit` results by descending score. Empty query returns empty array.
 */
export function artifactSearch(
  query: string,
  index: ArtifactIndex,
  limit: number = 8,
): ArtifactHit[] {
  if (!query.trim()) return [];

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const hits: ArtifactHit[] = [];

  for (const entry of index.entries) {
    let score = 0;

    for (const term of terms) {
      // Title match — 4 points
      if (entry.title.toLowerCase().includes(term)) {
        score += 4;
      }

      // Haystack match — 1 point
      const haystack = [entry.path, entry.kind, ...entry.signals].join(" ").toLowerCase();
      if (haystack.includes(term)) {
        score += 1;
      }
    }

    if (score > 0) {
      hits.push({ entry, score });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
