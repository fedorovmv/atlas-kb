import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Read a markdown file and extract named sections by heading.
 * Returns a map of sectionName → text content (trimmed).
 */
export async function readDocSections(root: string, relPath: string): Promise<Map<string, string>> {
  try {
    const full = path.join(root, relPath);
    const raw = await readFile(full, "utf8");
    return extractSections(raw);
  } catch {
    return new Map();
  }
}

/**
 * Extract markdown sections by heading.
 * Handles ## and ### headings. Returns map of lowercase heading → content.
 */
export function extractSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = content.split("\n");
  let currentHeading = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    const match = line.match(/^##+\s+(.+)$/);
    if (match) {
      if (currentHeading) {
        sections.set(currentHeading.toLowerCase(), currentBody.join("\n").trim());
      }
      currentHeading = match[1].trim();
      currentBody = [];
    } else if (currentHeading) {
      currentBody.push(line);
    }
  }
  if (currentHeading) {
    sections.set(currentHeading.toLowerCase(), currentBody.join("\n").trim());
  }

  // Also capture text before first heading (intro/overview)
  const firstHeadingIdx = lines.findIndex((l) => /^##+\s+/.test(l));
  if (firstHeadingIdx > 0) {
    const intro = lines.slice(0, firstHeadingIdx).join("\n").trim();
    if (intro) sections.set("_intro", intro);
  }

  return sections;
}

/**
 * Try multiple heading variants for a section.
 * E.g. "problem" matches "Problem", "## Problem", "Motivation", "Background".
 */
export function findSection(sections: Map<string, string>, variants: string[]): string | null {
  for (const v of variants) {
    const key = v.toLowerCase();
    if (sections.has(key) && sections.get(key)!.length > 0) return sections.get(key)!;
  }
  // Fuzzy: check if any heading contains the variant
  for (const [key, val] of sections) {
    for (const v of variants) {
      if (key.includes(v.toLowerCase()) && val.length > 0) return val;
    }
  }
  return null;
}

/**
 * Extract labeled content from prose, e.g. "**Goal:** Implement the business logic..."
 * or "**Architecture:** The agent is an HTTP service..."
 * Returns a map of lowercase label → text after the colon.
 */
export function extractBoldLabels(content: string): Map<string, string> {
  const labels = new Map<string, string>();
  // Match **Label:** text or *Label:* text
  const regex = /\*\*?([^*:+]+):\*\*?\s+(.+?)(?=\n\*\*?|\n#|\n$|$)/gis;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const label = match[1].trim().toLowerCase();
    const text = match[2].trim();
    if (label && text && !labels.has(label)) {
      labels.set(label, text);
    }
  }
  return labels;
}

/**
 * Try to find content from sections, then bold labels, then intro.
 * Returns the first match or null.
 */
export function findContent(
  sections: Map<string, string>,
  content: string,
  variants: string[],
): string | null {
  // 1. Try markdown sections
  const sectionContent = findSection(sections, variants);
  if (sectionContent) return sectionContent;

  // 2. Try bold labels in prose
  const labels = extractBoldLabels(content);
  for (const v of variants) {
    const key = v.toLowerCase();
    if (labels.has(key) && labels.get(key)!.length > 0) return labels.get(key)!;
  }

  // 3. Fuzzy bold labels
  for (const [key, val] of labels) {
    for (const v of variants) {
      if (key.includes(v.toLowerCase()) && val.length > 0) return val;
    }
  }

  return null;
}

/**
 * Extract first paragraph from a markdown doc (before any heading).
 */
export function extractFirstParagraph(content: string): string {
  const lines = content.split("\n");
  const para: string[] = [];
  for (const line of lines) {
    if (/^##+\s+/.test(line)) break;
    if (line.trim().startsWith("---")) continue;
    if (line.trim().length > 0) para.push(line.trim());
  }
  return para.join(" ").trim();
}

/**
 * Read a doc and extract a summary — first meaningful paragraph or overview section.
 */
export async function readDocSummary(root: string, relPath: string): Promise<string> {
  try {
    const full = path.join(root, relPath);
    const raw = await readFile(full, "utf8");
    const sections = extractSections(raw);

    // Try Overview / Summary / Description first
    const overview = findSection(sections, ["overview", "summary", "description", "about"]);
    if (overview) return truncate(overview, 500);

    // Fallback: first paragraph
    const intro = extractFirstParagraph(raw);
    if (intro) return truncate(intro, 500);

    return "";
  } catch {
    return "";
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + "...";
}