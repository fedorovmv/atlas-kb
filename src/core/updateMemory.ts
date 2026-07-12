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

  if (checkLevelCode && !hasEvidenceSection(bodyToCheck, "Code evidence")) {
    throw new Error("Cannot set evidence_level=code_confirmed: body must contain ## Code evidence section with entries");
  }
  if (checkLevelTest && !hasEvidenceSection(bodyToCheck, "Test evidence")) {
    throw new Error("Cannot set evidence_level=test_confirmed: body must contain ## Test evidence section with entries");
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
