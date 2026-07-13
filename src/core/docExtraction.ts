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
 * Normalizes numbered headers: "## 1. Goal" → key "goal" (strips "1. " prefix).
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
        sections.set(normalizeHeading(currentHeading), currentBody.join("\n").trim());
      }
      currentHeading = match[1].trim();
      currentBody = [];
    } else if (currentHeading) {
      currentBody.push(line);
    }
  }
  if (currentHeading) {
    sections.set(normalizeHeading(currentHeading), currentBody.join("\n").trim());
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
 * Normalize heading: strip numbered prefixes ("1. ", "2) "),
 * strip leading/trailing whitespace, lowercase.
 */
function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/^\d+[.)\s]+/, "") // strip "1. " or "2) " prefix
    .trim();
}

/**
 * Bilingual (EN↔RU) heading synonyms. When searching for a Russian heading,
 * also match the English equivalent and vice versa.
 */
const BILINGUAL_SYNONYMS: Record<string, string[]> = {
  "цель": ["goal", "purpose", "objective"],
  "goal": ["цель", "назначение"],
  "проблема": ["problem", "issue", "challenge"],
  "problem": ["проблема", "задача"],
  "решение": ["decision", "solution", "approach"],
  "decision": ["решение", "подход"],
  "обоснование": ["rationale", "why", "justification", "reasoning"],
  "rationale": ["обоснование", "почему", "причины"],
  "альтернативы": ["alternatives", "options"],
  "alternatives": ["альтернативы", "варианты"],
  "последствия": ["consequences", "trade-offs", "implications"],
  "consequences": ["последствия", "компромиссы"],
  "ограничения": ["constraints", "limitations", "restrictions", "global constraints"],
  "constraints": ["ограничения", "лимиты", "условия"],
  "участники": ["actors", "participants", "components"],
  "actors": ["участники", "компоненты", "стороны"],
  "поток": ["flow", "process", "steps", "workflow", "procedure"],
  "flow": ["поток", "процесс", "шаги", "сценарий"],
  "контекст": ["context", "background", "motivation"],
  "context": ["контекст", "фон", "предыстория"],
  "описание": ["description", "overview", "summary", "about"],
  "description": ["описание", "обзор", "сводка"],
  "статус": ["status", "state"],
  "status": ["статус", "состояние"],
  "требования": ["requirements", "claims", "behavior", "specification"],
  "requirements": ["требования", "поведение", "спецификация"],
  "ошибки": ["errors", "failure", "error cases", "fallback"],
  "errors": ["ошибки", "отказ", "сценарии ошибок"],
  "затронутые модули": ["affected modules", "affected components", "changed modules"],
  "affected modules": ["затронутые модули", "изменяемые модули"],
  "затронутые сценарии": ["affected scenarios", "affected flows", "changed scenarios"],
  "affected scenarios": ["затронутые сценарии", "изменяемые сценарии"],
};

/**
 * Try multiple heading variants for a section.
 * Also checks bilingual synonyms (EN↔RU).
 */
export function findSection(sections: Map<string, string>, variants: string[]): string | null {
  // Collect all variants including bilingual synonyms
  const allVariants: string[] = [...variants];
  for (const v of variants) {
    const key = v.toLowerCase();
    if (BILINGUAL_SYNONYMS[key]) {
      allVariants.push(...BILINGUAL_SYNONYMS[key]);
    }
  }

  // 1. Exact match
  for (const v of allVariants) {
    const key = v.toLowerCase();
    if (sections.has(key) && sections.get(key)!.length > 0) return sections.get(key)!;
  }
  // 2. Fuzzy: check if any heading contains the variant
  for (const [key, val] of sections) {
    for (const v of allVariants) {
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
 * Detect common scaffold/template boilerplate in README content.
 * Returns true if the text looks like a generated template, not real project documentation.
 */
export function isBoilerplate(text: string): boolean {
  const lower = text.toLowerCase();
  const boilerplateMarkers = [
    // Vite / Create React App
    "this template provides a minimal setup",
    "vite with hmr",
    "create react app",
    "npm create vite",
    "npm run dev",
    // Next.js
    "create-next-app",
    "next.js starter",
    // Generic scaffolds
    "this project was bootstrapped with",
    "getting started with",
    "edit it and save",
    // Go templates
    "go module template",
  ];
  const hasMarker = boilerplateMarkers.some((m) => lower.includes(m));
  if (!hasMarker) return false;
  // Also check if the text is primarily scaffold instructions
  const scaffoldInstructions =
    lower.includes("npm run") || lower.includes("yarn") || lower.includes("pnpm") || lower.includes("go run");
  return hasMarker || (scaffoldInstructions && text.length < 300);
}

/**
 * Read a doc and extract a summary — first meaningful paragraph or overview section.
 * Filters out scaffold/template boilerplate.
 */
export async function readDocSummary(root: string, relPath: string): Promise<string> {
  try {
    const full = path.join(root, relPath);
    const raw = await readFile(full, "utf8");
    const sections = extractSections(raw);

    // Try Overview / Summary / Description first
    const overview = findSection(sections, ["overview", "summary", "description", "about"]);
    if (overview && !isBoilerplate(overview)) return truncate(overview, 500);

    // Fallback: first paragraph (skip boilerplate)
    const intro = extractFirstParagraph(raw);
    if (intro && !isBoilerplate(intro)) return truncate(intro, 500);

    return "";
  } catch {
    return "";
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + "...";
}