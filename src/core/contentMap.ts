import type { SourceContentMap } from "../schemas/sourceContentMap.js";
import type { SectionMapEntry } from "../schemas/sourceContentMap.js";
import type { FileRecord, DiscoveryReport } from "../schemas/discovery.js";
import type { MemoryCard } from "./types.js";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";

// Words to filter out from topics / keyword extraction
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "dare",
  "ought", "used", "it", "its", "this", "that", "these", "those",
  "i", "you", "he", "she", "we", "they", "me", "him", "her", "us",
  "them", "my", "your", "his", "our", "their", "what", "which", "who",
  "whom", "whose", "where", "when", "how", "why", "if", "then", "than",
  "so", "as", "up", "out", "off", "over", "under", "again", "further",
  "also", "not", "no", "nor", "just", "about", "into", "through",
  "during", "before", "after", "above", "below", "between",
  "system", "using", "with", "based",
]);

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function filterStopwords(words: string[]): string[] {
  return words
    .map((w) => w.toLowerCase().replace(/[^a-z0-9-]/g, ""))
    .filter(
      (w) =>
        w.length > 1 &&
        !STOP_WORDS.has(w) &&
        !/^\d+$/.test(w),
    )
    .filter((v, i, a) => a.indexOf(v) === i); // unique
}

/**
 * Parse markdown headings (## and ###) and build a section map.
 */
function parseSectionMap(content: string): SectionMapEntry[] {
  const lines = content.split("\n");
  const headingRegex = /^(#{2,3})\s+(.+)$/;
  const headings: Array<{ index: number; level: number; text: string; line: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(headingRegex);
    if (match) {
      headings.push({
        index: i,
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1, // 1-indexed
      });
    }
  }

  const sections: SectionMapEntry[] = [];
  for (let i = 0; i < headings.length; i++) {
    const current = headings[i];
    const nextHeading = headings[i + 1];
    const startLine = current.line;
    const endLine = nextHeading ? nextHeading.line - 1 : lines.length;

    // Extract first paragraph after this heading (max 120 chars)
    let summary = "";
    for (let j = current.index + 1; j < (nextHeading ? nextHeading.index : lines.length); j++) {
      const trimmed = lines[j].trim();
      if (trimmed && trimmed !== "---" && trimmed !== "***" && !trimmed.startsWith("#")) {
        const summaryText = trimmed.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
        summary = summaryText.length > 120 ? summaryText.slice(0, 120) + "…" : summaryText;
        break;
      }
    }

    // Extract keyword topics from heading text
    const keywordTopics = filterStopwords(
      current.text.split(/[\s\-_,:]+/).map((w) => w.trim()).filter(Boolean),
    );

    sections.push({
      heading: current.text,
      startLine,
      endLine,
      summary: summary || undefined,
      keywordTopics,
    });
  }

  return sections;
}

/**
 * Extract topics from file content.
 */
function extractTopics(
  content: string,
  sectionMap: SectionMapEntry[],
): string[] {
  const topicSet = new Set<string>();
  const lines = content.split("\n");

  // From section headings (first 5)
  const headingTopics = sectionMap.slice(0, 5).flatMap((s) => s.keywordTopics);
  for (const t of headingTopics) {
    topicSet.add(t);
  }

  // From first paragraph (non-empty lines at the start, before first heading or code block)
  let inFirstParagraph = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inFirstParagraph) break;
      continue;
    }
    if (trimmed.startsWith("#") || trimmed.startsWith("```")) break;
    if (!inFirstParagraph) inFirstParagraph = true;
    const words = trimmed.split(/[\s,.;:]+/).map((w) => w.trim()).filter(Boolean);
    const filtered = filterStopwords(words);
    for (const w of filtered) {
      if (topicSet.size < 20) topicSet.add(w);
    }
  }

  // From code blocks (imports, package names)
  const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
  let m;
  while ((m = codeBlockRegex.exec(content)) !== null) {
    const codeContent = m[1];
    // Go: package X
    const pkgMatch = codeContent.match(/package\s+(\w+)/);
    if (pkgMatch) topicSet.add(pkgMatch[1]);
    // Import paths: extract package names
    const importMatches = codeContent.match(/import\s+["']([^"']+)?["']|import\s+\(\s*[\s\S]*?\)/g) || [];
    for (const imp of importMatches) {
      const pkgParts = imp.match(/["']([^"']+)["']/g);
      if (pkgParts) {
        for (const p of pkgParts) {
          const pathStr = p.replace(/["']/g, "");
          const lastSegment = pathStr.split("/").pop();
          if (lastSegment && lastSegment.length > 1 && !lastSegment.includes(".")) {
            if (topicSet.size < 30) topicSet.add(lastSegment);
          }
        }
      }
    }
  }

  // Also scan for standalone import/package lines outside code blocks
  const inlinePkg = content.match(/package\s+(\w+)/g);
  if (inlinePkg) {
    for (const m of inlinePkg) {
      const name = m.replace(/package\s+/, "");
      topicSet.add(name);
    }
  }

  return [...topicSet];
}

/**
 * Extract components and services from file path and content.
 */
function extractComponentsAndServices(
  file: FileRecord,
  content: string,
): { components: string[]; services: string[] } {
  const components = new Set<string>();
  const services = new Set<string>();

  // From path patterns
  const pathParts = file.path.split("/");
  for (let i = 0; i < pathParts.length - 1; i++) {
    const dir = pathParts[i];
    if (dir === "internal" && i + 1 < pathParts.length - 1) {
      components.add(pathParts[i + 1]);
    }
    if (dir === "pkg" && i + 1 < pathParts.length - 1) {
      components.add(pathParts[i + 1]);
    }
    if (dir === "services" && i + 1 < pathParts.length - 1) {
      services.add(pathParts[i + 1]);
    }
  }

  // From content
  const serviceMatch = content.matchAll(/Service[:\s]+(\w+)/gi);
  for (const m of serviceMatch) {
    services.add(m[1].toLowerCase());
  }
  const componentMatch = content.matchAll(/Component[:\s]+(\w+)/gi);
  for (const m of componentMatch) {
    components.add(m[1].toLowerCase());
  }

  // Go package declarations
  const pkgMatch = content.match(/package\s+(\w+)/);
  if (pkgMatch) {
    components.add(pkgMatch[1]);
  }

  return {
    components: [...components],
    services: [...services],
  };
}

/**
 * Extract referenced paths from markdown links and code.
 */
function extractReferencedPaths(content: string): string[] {
  const paths = new Set<string>();

  // Markdown links [text](path)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  while ((m = linkRegex.exec(content)) !== null) {
    const refPath = m[2];
    if (!refPath.startsWith("http") && !refPath.startsWith("#") && refPath.includes("/")) {
      paths.add(refPath);
    }
  }

  // Import paths from code blocks
  const importRegex = /import\s+["']([^"']+)?["']/g;
  while ((m = importRegex.exec(content)) !== null) {
    const importPath = m[1];
    if (importPath && importPath !== "." && !importPath.startsWith("http")) {
      paths.add(importPath);
    }
  }

  return [...paths];
}

/**
 * Compute target cards — cards whose topics/aliases intersect with the file topics,
 * or whose code_refs match the file path.
 */
function computeTargetCards(
  file: FileRecord,
  contentTopics: string[],
  cards: MemoryCard[],
  options?: { root?: string },
): string[] {
  const fileTopicsLower = new Set(contentTopics.map((t) => t.toLowerCase()));
  const filePath = file.path.toLowerCase();
  const targetCards: string[] = [];

  for (const card of cards) {
    const aliases = (card.meta.aliases || []).map((a) => a.toLowerCase());
    const productAreas = (card.meta.product_areas || []).map((a) => a.toLowerCase());
    const cardTopics = new Set([...aliases, ...productAreas]);

    // Check topic intersection
    let hasTopicIntersection = false;
    for (const ct of cardTopics) {
      for (const ft of fileTopicsLower) {
        if (ct.includes(ft) || ft.includes(ct)) {
          hasTopicIntersection = true;
          break;
        }
      }
      if (hasTopicIntersection) break;
    }

    // Check code_refs intersection
    let hasCodeRefMatch = false;
    for (const ref of card.meta.code_refs || []) {
      if (filePath.includes(ref.path.toLowerCase()) || ref.path.toLowerCase().includes(filePath)) {
        hasCodeRefMatch = true;
        break;
      }
    }

    if (hasTopicIntersection || hasCodeRefMatch) {
      targetCards.push(card.relativePath);
    }
  }

  return targetCards;
}

/**
 * Map a FileRecord.kind to a sourceType classifier value.
 */
function deriveSourceType(kind: FileRecord["kind"]): string {
  const mapping: Record<FileRecord["kind"], string> = {
    code: "code",
    test: "test",
    doc: "doc",
    spec: "spec",
    config: "config",
    contract: "contract",
    demo: "demo",
    example: "example",
    legacy: "legacy",
    unknown: "unknown",
  };
  return mapping[kind];
}

/**
 * Build content map for a single file.
 */
export async function buildSourceContentMap(
  file: FileRecord,
  cards: MemoryCard[],
  options?: { root?: string },
): Promise<SourceContentMap> {
  const absPath = path.isAbsolute(file.path) ? file.path : options?.root ? path.join(options.root, file.path) : file.path;
  const content = await fs.readFile(absPath, "utf8");

  // 1. Parse Markdown headings → sectionMap
  const sectionMap = parseSectionMap(content);

  // 2. Extract topics
  const topics = extractTopics(content, sectionMap);

  // 3. Determine components/services
  const { components, services } = extractComponentsAndServices(file, content);

  // 4. Compute targetCards
  const targetCards = computeTargetCards(file, topics, cards, options);

  // 6. referencedPaths
  const referencedPaths = extractReferencedPaths(content);

  // 7. sha256 of file content
  const fileSha256 = sha256(content);

  // 8. classifiers.sourceType from FileRecord.kind
  const sourceType = deriveSourceType(file.kind);

  // Build partial entry without contentMapId first
  const partialEntry: Omit<SourceContentMap, "contentMapId"> & { contentMapId?: string } = {
    path: file.path,
    sha256: fileSha256,
    title: undefined,
    moduleBoundary: undefined,
    classifiers: {
      sourceType,
      sourceStatus: undefined,
      memoryIntents: [],
      tags: [],
    },
    topics,
    components,
    services,
    referencedPaths,
    targetCards,
    sectionMap,
  };

  // 5. contentMapId = SHA-256[:16] of sorted JSON
  const sortedJson = JSON.stringify(
    Object.keys(partialEntry)
      .sort()
      .reduce((acc, key) => {
        acc[key] = partialEntry[key as keyof typeof partialEntry];
        return acc;
      }, {} as Record<string, unknown>),
  );
  const contentMapId = sha256(sortedJson).slice(0, 16);

  return {
    ...partialEntry,
    contentMapId,
  } as SourceContentMap;
}

/**
 * Build content maps for all files in a discovery report.
 * Writes .ai/memory-build/latest/source-content-map.jsonl
 */
export async function buildAllContentMaps(
  discovery: DiscoveryReport,
  cards: MemoryCard[],
  options?: { root?: string; buildDir?: string },
): Promise<{ maps: SourceContentMap[]; path: string }> {
  const files = discovery.files;
  const root = options?.root ?? discovery.root;
  const buildDir =
    options?.buildDir ?? path.join(root, ".ai", "memory-build", "latest");

  // Ensure build directory exists
  await fs.mkdir(buildDir, { recursive: true });

  const maps: SourceContentMap[] = [];
  const jsonlLines: string[] = [];

  for (const file of files) {
    const map = await buildSourceContentMap(file, cards, { root });
    maps.push(map);
    jsonlLines.push(JSON.stringify(map));
  }

  const outputPath = path.join(buildDir, "source-content-map.jsonl");
  await fs.writeFile(outputPath, jsonlLines.join("\n") + (jsonlLines.length > 0 ? "\n" : ""), "utf8");

  return { maps, path: outputPath };
}
