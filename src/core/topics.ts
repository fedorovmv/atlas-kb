/**
 * Extract topic tokens from a spec path and content.
 * Shared by specClassification.ts and specRelations.ts.
 */

const TOPIC_PATH_EXCLUDE = ["specs", "docs", "spec", "doc", "legacy", "archive", "proposals", "cr", "superpowers", "plans", "design"];

/** Filter out date tokens (2026, 06, 10, etc.) and common noise. */
function isMeaningfulToken(token: string): boolean {
  if (token.length < 3) return false;
  // Pure numbers (years, months, days)
  if (/^\d+$/.test(token)) return false;
  // Date-like: 2026-06, 06-10
  if (/^\d{2,4}[-_]?\d{0,2}$/.test(token)) return false;
  // Common markdown noise + path noise that leaks from embedded spec content
  const NOISE = new Set([
    "the", "and", "for", "with", "from", "this", "that", "are", "was", "will", "must", "shall",
    "not", "but", "all", "any", "can", "has", "have", "may", "should", "would", "could",
    "docs", "spec", "specs", "superpowers", "plans", "plan", "design", "historical",
    "proposal", "memory", "summary", "status", "overview", "description", "intro",
    "md", "yaml", "json", "version", "draft", "date", "language", "target",
    "вектор", "версия", "дата", "статус", "язык",
    "история", "резюме", "обзор", "описание",
  ]);
  if (NOISE.has(token)) return false;
  return true;
}

/** Strip markdown formatting from heading text. */
function cleanHeading(text: string): string {
  return text
    .replace(/[`*_#~\[\]()]/g, " ")
    .replace(/\*\*/g, " ")
    .replace(/[""''«»]/g, " ")
    .replace(/[—:,.!?;]/g, " ")
    .trim();
}

export function extractSpecTopics(specPath: string, content: string): string[] {
  const segments = specPath
    .toLowerCase()
    .split("/")
    .filter((s) => !TOPIC_PATH_EXCLUDE.includes(s));
  const headings = content.match(/^#+\s+(.+)$/gm) ?? [];
  const headingTopics = headings.map((h) => cleanHeading(h.replace(/^#+\s+/, "").toLowerCase()));
  return [
    ...new Set([
      ...segments.flatMap((s) => s.split(/[-_.]/)),
      ...headingTopics.flatMap((h) => h.split(/\s+/)),
    ]),
  ].filter(isMeaningfulToken);
}