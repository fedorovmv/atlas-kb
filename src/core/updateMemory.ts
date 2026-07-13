import { writeFile, rename, unlink } from "node:fs/promises";
import yaml from "js-yaml";
import { loadMemoryCards, findCardById } from "./loadMemory.js";
import { resolveRoot } from "./paths.js";
import { hasEvidenceSection } from "./evidenceSection.js";
import { validateCardSections } from "./cardSections.js";
import type { RepoMemoryOptions, MemoryCard } from "./types.js";
import type { MemoryFrontmatter } from "../schemas/frontmatter.js";

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

/**
 * Dedup duplicate H2 sections in card body.
 * If a section heading (## Foo) appears multiple times, merge content into the last occurrence.
 * Prevents agents from creating duplicate ## Свидетельства из тестов etc.
 */
function dedupH2Sections(body: string): string {
  const sections: { heading: string; content: string }[] = [];
  const lines = body.split("\n");
  let current: { heading: string; content: string[] } | null = null;
  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      if (current) sections.push({ heading: current.heading, content: current.content.join("\n") });
      current = { heading: h2Match[1].trim(), content: [] };
    } else if (current) {
      current.content.push(line);
    } else {
      // Content before first H2 — push as preamble
      sections.push({ heading: "", content: line });
    }
  }
  if (current) sections.push({ heading: current.heading, content: current.content.join("\n") });

  // Dedup by heading (keep last, merge non-empty content from earlier occurrences)
  const seen = new Map<string, number>(); // heading → index in result
  const result: { heading: string; content: string }[] = [];
  for (const sec of sections) {
    if (!sec.heading) {
      result.push(sec);
      continue;
    }
    const idx = seen.get(sec.heading);
    if (idx !== undefined) {
      // Duplicate — merge content if earlier was empty, otherwise keep last
      const existing = result[idx];
      if (!existing.content.trim() && sec.content.trim()) {
        existing.content = sec.content;
      }
    } else {
      seen.set(sec.heading, result.length);
      result.push({ heading: sec.heading, content: sec.content });
    }
  }

  return result
    .map((s) => (s.heading ? `## ${s.heading}\n${s.content}` : s.content))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

  // Replace body if provided — dedup duplicate H2 sections (keep last occurrence)
  if (options.body !== undefined) {
    newBody = dedupH2Sections(options.body);
    changes.push("body");
  }

  // Set specific frontmatter fields if provided
  if (options.fields) {
    for (const [key, value] of Object.entries(options.fields)) {
      newMeta[key] = value;
      changes.push(`frontmatter.${key}`);
    }
  }

  // Auto-sync usage_policy when status/evidence changes.
  // Module cards: current + code_confirmed/test_confirmed → can_answer_current_behavior: true.
  // Otherwise → false. Prevents inconsistent state where current+confirmed cards can't answer.
  const effectiveStatus = (options.fields?.status as string | undefined) ?? (newMeta.status as string);
  const effectiveEvidence = (options.fields?.evidence_level as string | undefined) ?? (newMeta.evidence_level as string);
  const entityType = newMeta.entity_type as string;
  if (entityType === "module" && effectiveStatus && effectiveEvidence) {
    const canAnswer = effectiveStatus === "current" &&
      (effectiveEvidence === "code_confirmed" || effectiveEvidence === "test_confirmed");
    const usagePolicy = (newMeta.usage_policy as Record<string, unknown>) ?? {};
    if (usagePolicy.can_answer_current_behavior !== canAnswer) {
      usagePolicy.can_answer_current_behavior = canAnswer;
      newMeta.usage_policy = usagePolicy;
      changes.push("frontmatter.usage_policy.can_answer_current_behavior");
    }
  }

  if (changes.length === 0) {
    return { id, path: card.relativePath, updated: false, changes: [] };
  }

  // Guard: evidence_level code_confirmed/test_confirmed require matching body sections
  // Only enforce when evidence_level is being set, or when body is being changed on a card that already has the level
  const setEvidenceLevel = options.fields?.evidence_level as string | undefined;
  const bodyChanged = options.body !== undefined;
  const bodyToCheck = bodyChanged ? newBody : card.body;
  const effectiveLevel = (setEvidenceLevel !== undefined ? setEvidenceLevel : card.meta.evidence_level) as string;

  const checkLevelCode =
    (setEvidenceLevel === "code_confirmed") || (bodyChanged && effectiveLevel === "code_confirmed");
  const checkLevelTest =
    (setEvidenceLevel === "test_confirmed") || (bodyChanged && effectiveLevel === "test_confirmed");

  if (checkLevelCode && !hasEvidenceSection(bodyToCheck, "Свидетельства из кода")) {
    throw new Error("Cannot set evidence_level=code_confirmed: body must contain ## Свидетельства из кода section with entries");
  }
  if (checkLevelTest && !hasEvidenceSection(bodyToCheck, "Свидетельства из тестов")) {
    throw new Error("Cannot set evidence_level=test_confirmed: body must contain ## Свидетельства из тестов section with entries");
  }

  // Reconstruct file: preserve frontmatter structure, replace body
  // Use gray-matter stringify to safely serialize
  const frontmatterYaml = yaml.dump(newMeta, { lineWidth: -1 }).trimEnd();
  const content = `---\n${frontmatterYaml}\n---\n\n${newBody.trimStart()}\n`;

  // Atomic write: write to temp file, then rename. Prevents partial writes
  // if process crashes or concurrent updates race.
  const tmpPath = `${card.path}.tmp`;
  await writeFile(tmpPath, content, "utf8");
  try {
    await rename(tmpPath, card.path);
  } catch (err) {
    await unlink(tmpPath).catch(() => {});
    throw err;
  }

  // Soft warning for missing required sections — body may be in-progress
  const updatedCard: MemoryCard = { ...card, body: newBody, meta: newMeta as MemoryFrontmatter };
  const sectionResult = validateCardSections(updatedCard);
  if (sectionResult.missingRequired.length > 0) {
    console.warn(`Warning: card "${id}" is missing required sections: ${sectionResult.missingRequired.join(", ")}`);
  }

  return { id, path: card.relativePath, updated: true, changes };
}
