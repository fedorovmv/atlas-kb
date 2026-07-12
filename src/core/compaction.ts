import { loadMemoryCardsBestEffort } from "./loadMemory.js";
import { resolveRoot } from "./paths.js";
import { loadSessions, getActiveSessionSummary } from "./sessionTracking.js";

export interface CompactionResult {
  content: string;
  truncated: boolean;
  charCount: number;
  maxChars: number;
}

export async function buildCompaction(options: {
  root?: string;
  maxChars?: number;
  noTruncate?: boolean;
}): Promise<CompactionResult> {
  const maxChars = options.maxChars ?? 12000;
  const root = resolveRoot(options);
  const cards = await loadMemoryCardsBestEffort({ root });

  const sections: string[] = [];

  sections.push("# Memory Compaction");
  sections.push("");

  const topic = cards.length > 0 ? cards[0].meta.title : "N/A";
  sections.push(`## Topic\n${topic}`);
  sections.push("");

  sections.push("## HEAD\nN/A");
  sections.push("");
  sections.push("## Route reasons\nN/A");
  sections.push("");
  const sessions = await loadSessions(root);
  const activeLane = getActiveSessionSummary(sessions);
  sections.push(`## Active lane\n${activeLane}`);
  sections.push("");
  sections.push("## Approvals\nN/A");
  sections.push("");

  const unresolved = cards.filter((c) => c.meta.review_required).map((c) => `- ${c.meta.id}: ${c.meta.title}`);
  sections.push("## Unresolved items");
  sections.push(unresolved.length > 0 ? unresolved.join("\n") : "N/A");
  sections.push("");

  const relevantFiles = cards.slice(0, 20).map((c) => `- ${c.relativePath}`);
  sections.push("## Relevant files (top 20)");
  sections.push(relevantFiles.length > 0 ? relevantFiles.join("\n") : "N/A");
  sections.push("");

  const canonical = cards.filter((c) => c.meta.status === "current").slice(0, 8);
  const canonicalLines = canonical.map((c) => `- ${c.meta.id}: ${c.meta.title} [${c.meta.entity_type}]`);
  sections.push("## Canonical KB (top 8)");
  sections.push(canonicalLines.length > 0 ? canonicalLines.join("\n") : "N/A");
  sections.push("");

  let content = sections.join("\n");
  const charCount = content.length;

  if (charCount > maxChars) {
    if (options.noTruncate) {
      throw new Error(`Compaction exceeds maxChars (${charCount} > ${maxChars}). Use --max-chars to increase or remove --no-truncate.`);
    }
    content = content.slice(0, maxChars);
    content += "\n\n<!-- TRUNCATED: split the KB build by module/scope -->";
  }

  return { content, truncated: charCount > maxChars, charCount: content.length, maxChars };
}