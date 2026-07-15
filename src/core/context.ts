import path from "node:path";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ContextPack, MemoryCard, RepoMemoryOptions } from "./types.js";
import { fileHash } from "./hashing.js";

const execFileAsync = promisify(execFile);
import { loadMemoryCardsBestEffort } from "./loadMemory.js";
import { getDirectRelatedIds } from "./relations.js";
import { scoreCard } from "./score.js";
import { resolveMemoryRoot, resolveRoot } from "./paths.js";
import { SourcePrioritySchema } from "../schemas/sourcePriority.js";
import * as yaml from "js-yaml";

const DEFAULT_PRIORITY = [
  "current-code",
  "current-tests",
  "api-contracts",
  "reviewed-memory",
  "current-docs",
  "reviewed-specs",
  "new-specs",
  "historical-specs",
  "demo-modules",
];

const DEFAULT_RULES = [
  "New specs describe proposed behavior, not current behavior.",
  "Historical specs may preserve rationale but must not override current code.",
  "Demo modules are examples, not production evidence.",
  "If code and memory conflict, write conflict instead of silently updating memory.",
  "If rationale is inferred, mark it as inferred.",
];

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function compactExcerpt(body: string, max = 1200) {
  const normalized = body.trim().replace(/\n{3,}/g, "\n\n");
  return normalized.length <= max ? normalized : `${normalized.slice(0, max).trim()}\n...`;
}

function renderCardLine(card: MemoryCard) {
  const needsVerification = card.meta.evidence_level === "heuristic_match" || card.meta.evidence_level === "spec_only" || card.meta.evidence_level === "inferred";
  const marker = needsVerification ? " [needs LLM verification]" : "";
  return `- \`${card.relativePath}\` — ${card.meta.title} [${card.meta.entity_type}, ${card.meta.status}, evidence=${card.meta.evidence_level}]${marker}`;
}

type SourcePriority = {
  priority: string[];
  rules: string[];
};

export async function loadSourcePriority(options: RepoMemoryOptions): Promise<SourcePriority> {
  try {
    const root = resolveRoot(options);
    const configPath = path.join(root, ".ai", "atlas", "config", "source-priority.yaml");
    const raw = await readFile(configPath, "utf8");
    const parsed = yaml.load(raw) as Record<string, unknown>;
    const validated = SourcePrioritySchema.parse(parsed);
    return { priority: validated.priority, rules: validated.rules };
  } catch {
    return { priority: DEFAULT_PRIORITY, rules: DEFAULT_RULES };
  }
}

async function loadReconciliationFile(memoryRoot: string, filename: string): Promise<string | null> {
  try {
    const filePath = path.join(memoryRoot, "reconciliation", filename);
    const raw = await readFile(filePath, "utf8");
    // Strip frontmatter if present
    const withoutFrontmatter = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
    const body = withoutFrontmatter.trim();
    return body.length > 0 ? body : null;
  } catch {
    return null;
  }
}

function renderUsagePolicyLine(card: MemoryCard): string {
  const p = card.meta.usage_policy;
  return `- \`${card.meta.id}\`: current_behavior=${p.can_answer_current_behavior}, code_gen=${p.can_generate_code_from}, rationale=${p.can_use_as_rationale}, example=${p.can_use_as_example}, code_check=${p.requires_code_check_before_change}, warning=${p.requires_warning}`;
}

export async function buildMemoryContext(query: string, options: RepoMemoryOptions & { limit?: number } = {}): Promise<ContextPack> {
  const limit = options.limit ?? 8;
  const cards = await loadMemoryCardsBestEffort(options);
  const sourcePriority = await loadSourcePriority(options);
  const scored = cards
    .map((card) => ({ card, score: scoreCard(card, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.card.relativePath.localeCompare(b.card.relativePath));

  const selected = scored.slice(0, limit).map((item) => item.card);
  const byId = new Map(cards.map((card) => [card.meta.id, card]));
  const relatedIds = unique(selected.flatMap((card) => getDirectRelatedIds(card)));
  const related = relatedIds
    .map((id) => byId.get(id))
    .filter((card): card is MemoryCard => Boolean(card))
    .filter((card) => !selected.some((selectedCard) => selectedCard.meta.id === card.meta.id))
    .slice(0, limit);

  const all = [...selected, ...related];
  const codeRefs = unique(all.flatMap((card) => card.meta.code_refs.map((ref) => ref.path))).sort();
  const testRefs = unique(all.flatMap((card) => card.meta.test_refs.map((ref) => ref.path))).sort();

  // Load reconciliation files
  const memoryRoot = resolveMemoryRoot(options);
  const conflictsContent = await loadReconciliationFile(memoryRoot, "conflicts.md");
  const openQuestionsContent = await loadReconciliationFile(memoryRoot, "open-questions.md");

  const reconciliationSection: string[] = [];
  if (conflictsContent || openQuestionsContent) {
    reconciliationSection.push("## Conflicts and open questions");
    if (conflictsContent) {
      reconciliationSection.push("### Conflicts");
      reconciliationSection.push(compactExcerpt(conflictsContent, 500));
    }
    if (openQuestionsContent) {
      reconciliationSection.push("");
      reconciliationSection.push("### Open questions");
      reconciliationSection.push(compactExcerpt(openQuestionsContent, 500));
    }
  } else {
    reconciliationSection.push("## Conflicts and open questions");
    reconciliationSection.push("- No open conflicts or questions.");
  }

  // Build usage policy section
  const usagePolicySection: string[] = [];
  if (selected.length > 0) {
    usagePolicySection.push("## Usage policy");
    usagePolicySection.push(...selected.map(renderUsagePolicyLine));
  }

  const priorityRules = sourcePriority.rules.length > 0 ? sourcePriority.rules : DEFAULT_RULES;

  const markdown = [
    `# Memory context pack`,
    ``,
    `Task/query: ${query}`,
    ``,
    `## Recommended memory files`,
    ...(selected.length ? selected.map(renderCardLine) : ["- No matching memory files found."]),
    ``,
    `## Related memory files`,
    ...(related.length ? related.map(renderCardLine) : ["- No direct related memory files found." ]),
    ``,
    `## Related code paths`,
    ...(codeRefs.length ? codeRefs.map((ref) => `- \`${ref}\``) : ["- No code refs found."]),
    ``,
    `## Related test paths`,
    ...(testRefs.length ? testRefs.map((ref) => `- \`${ref}\``) : ["- No test refs found."]),
    ``,
    `## Source priority`,
    ...sourcePriority.priority.map((p, i) => `${i + 1}. ${p}`),
    ``,
    `## Source rules`,
    ...priorityRules.map((rule) => `- ${rule}`),
    ``,
    ...usagePolicySection,
    ``,
    ...reconciliationSection,
    ``,
    `## Compact excerpts`,
    ...selected.flatMap((card) => {
      const lines: string[] = [``, `### ${card.meta.title} — \`${card.relativePath}\``];
      if (card.meta.agent_summary?.trim()) {
        lines.push(`Agent summary: ${card.meta.agent_summary.trim()}`);
      }
      lines.push(compactExcerpt(card.body));
      return lines;
    }),
  ].join("\n");

  // F1: optional freshness tracking
  const pack: ContextPack = {
    query,
    selected,
    related,
    codeRefs,
    testRefs,
    markdown,
    generatedAt: new Date().toISOString(),
  };

  if (options.trackFreshness) {
    // Try to get git HEAD
    try {
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
        cwd: options.root ?? process.cwd(),
      });
      pack.repositoryHead = stdout.trim();
    } catch {
      // Not a git repo — skip
    }

    // Hash selected memory card source files
    const hashes: Record<string, string> = {};
    const root = options.root ?? process.cwd();
    for (const card of selected) {
      try {
        const h = await fileHash(card.path);
        hashes[card.relativePath] = h;
      } catch {
        // Skip files that can't be read
      }
    }
    if (Object.keys(hashes).length > 0) {
      pack.sourceHashes = hashes;
    }
  }

  return pack;
}
