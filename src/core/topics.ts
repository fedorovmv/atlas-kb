/**
 * Extract topic tokens from a spec path and content.
 * Shared by specClassification.ts and specRelations.ts.
 */

const TOPIC_PATH_EXCLUDE = ["specs", "docs", "spec", "doc", "legacy", "archive", "proposals", "cr"];

export function extractSpecTopics(specPath: string, content: string): string[] {
  const segments = specPath
    .toLowerCase()
    .split("/")
    .filter((s) => !TOPIC_PATH_EXCLUDE.includes(s));
  const headings = content.match(/^#+\s+(.+)$/gm) ?? [];
  const headingTopics = headings.map((h) => h.replace(/^#+\s+/, "").toLowerCase());
  return [
    ...new Set([
      ...segments.flatMap((s) => s.split(/[-_.]/)),
      ...headingTopics.flatMap((h) => h.split(/\s+/)),
    ]),
  ].filter((s) => s.length >= 3);
}