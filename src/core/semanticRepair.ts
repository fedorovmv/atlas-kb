import type { MemoryCard } from "./types.js";
import type { SourceContentMap } from "../schemas/sourceContentMap.js";
import type {
  BoilerplateMatch,
  ExtractedSentence,
  CardScope,
  RepairResult,
} from "../schemas/semanticRepair.js";

// ---------------------------------------------------------------------------
// Boilerplate patterns (15+ including Russian / CJK variants)
// ---------------------------------------------------------------------------

export const BOILERPLATE_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "Needs review", re: /Needs review/i },
  { name: "TBD", re: /\bTBD\b/i },
  { name: "TODO", re: /\bTODO\b/i },
  { name: "Placeholder", re: /Placeholder/i },
  { name: "待定", re: /待定/ },
  { name: "Needs review —", re: /Needs review\s*[—–-]/i },
  { name: "PENDING", re: /\bPENDING\b/i },
  { name: "FIXME", re: /\bFIXME\b/i },
  { name: "Not yet verified", re: /Not yet verified/i },
  { name: "Must be filled", re: /Must be filled/i },
  { name: "Requires review", re: /Requires review/i },
  { name: "尚待", re: /尚待/ },
  { name: "Needs review — what", re: /Needs review\b.*\bwhat\b/i },
  { name: "Needs review — identify", re: /Needs review\b.*\bidentify\b/i },
  { name: "Needs review — extract", re: /Needs review\b.*\bextract\b/i },
  { name: "Needs review — which", re: /Needs review\b.*\bwhich\b/i },
  { name: "Needs review — infer", re: /Needs review\b.*\binfer\b/i },
  { name: "Needs review — check", re: /Needs review\b.*\bcheck\b/i },
  { name: "Needs review — add", re: /Needs review\b.*\badd\b/i },
  { name: "Needs review — read", re: /Needs review\b.*\bread\b/i },
];

// ---------------------------------------------------------------------------
// Category keywords (D2 stub — extended later)
// ---------------------------------------------------------------------------

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  decision: ["decision", "решение", "chosen", "выбран", "selected", "adopted"],
  mechanics: [
    "mechanism",
    "механизм",
    "process",
    "процесс",
    "pipeline",
    "конвейер",
    "flow",
    "поток",
  ],
  rationale: [
    "rationale",
    "обоснование",
    "why",
    "почему",
    "reason",
    "причина",
    "constraint",
    "ограничение",
  ],
  alternative: [
    "alternative",
    "альтернатива",
    "option",
    "вариант",
    "instead",
    "вместо",
  ],
  consequence: [
    "consequence",
    "последствие",
    "trade-off",
    "компромисс",
    "impact",
    "влияние",
  ],
  flow: [
    "sequence",
    "последовательность",
    "step",
    "шаг",
    "fallback",
    "откат",
  ],
};

// ---------------------------------------------------------------------------
// Verb patterns for scoring
// ---------------------------------------------------------------------------

const VERB_PATTERNS = [
  /\buses\b/i,
  /\bcalls\b/i,
  /\bfilters\b/i,
  /\bchecks\b/i,
  /долж/,
  /использ/,
  /провер/,
];

// ---------------------------------------------------------------------------
// All entity types — used for deriving excludes
// ---------------------------------------------------------------------------

const ALL_ENTITY_TYPES = [
  "module",
  "scenario",
  "decision",
  "proposal",
  "historical",
  "conflict",
  "open_question",
  "architecture",
  "product_map",
  "ontology",
  "readme",
  "flow",
  "ops",
  "gotchas",
  "task_routing",
  "testing",
  "reference",
  "project",
  "routing",
  "index",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan card body sections for boilerplate / placeholder content.
 */
export function detectBoilerplate(body: string): BoilerplateMatch[] {
  // Split body into ## sections
  const rawSections = body.split(/^## /m);
  const matches: BoilerplateMatch[] = [];

  // Track absolute line offset
  let lineOffset = 0;

  for (let i = 0; i < rawSections.length; i++) {
    const raw = rawSections[i];
    if (i === 0) {
      // Before the first ## — skip or treat as preamble
      lineOffset = raw.split("\n").length;
      continue;
    }

    // The first line is the section heading
    const lines = raw.split("\n");
    const sectionName = lines[0].trim();
    const bodyLines = lines.slice(1);
    const sectionBody = bodyLines.join("\n");

    for (const { name, re } of BOILERPLATE_PATTERNS) {
      const m = sectionBody.match(re);
      if (m) {
        const matchLine = bodyLines.findIndex((l) => re.test(l));
        matches.push({
          sectionName,
          pattern: name,
          position: {
            line: lineOffset + 1 + Math.max(0, matchLine),
            column: matchLine >= 0 ? (bodyLines[matchLine]?.search(re) ?? 0) : 0,
          },
        });
      }
    }

    lineOffset += lines.length;
  }

  return matches;
}

/**
 * Derive card-scoped include/exclude tokens from card metadata.
 */
export function computeCardScope(card: MemoryCard): CardScope {
  const titleTokens = tokenize(card.meta.title);
  const typeTokens = card.meta.knowledge_types.flatMap(tokenize);

  const includes = [...new Set([...titleTokens, ...typeTokens])];

  // Derive excludes from entity types that don't match
  const entityType = card.meta.entity_type;
  const otherTypes = ALL_ENTITY_TYPES.filter((t) => t !== entityType);
  const excludes = otherTypes.map(tokenize).flat();

  // Adjacent keyword pairs from title tokens
  const allowPairs: [string, string][] = [];
  for (let i = 0; i < titleTokens.length - 1; i++) {
    allowPairs.push([titleTokens[i], titleTokens[i + 1]]);
  }

  return { includes, excludes, allowPairs };
}

/**
 * Extract high-scoring sentences from content maps, scoped to a card.
 */
export function extractCardScopedSentences(
  card: MemoryCard,
  contentMaps: SourceContentMap[],
): ExtractedSentence[] {
  const scope = computeCardScope(card);
  const cardTokens = new Set(tokenize(card.meta.title));
  const seen = new Set<string>();
  const results: ExtractedSentence[] = [];

  const relevantMaps = contentMaps.filter((cm) =>
    cm.targetCards.includes(card.meta.id),
  );

  for (const cm of relevantMaps) {
    const text = cm.sectionMap
      .map((s) => s.heading)
      .join(" ")
      .concat(" ")
      .concat(cm.topics.join(" "));

    // We need actual text content — use topics + headings as proxy,
    // and section summaries if available
    const fullText = cm.sectionMap
      .map((s) => [s.heading, s.summary].filter(Boolean).join(" "))
      .join("\n");

    const sentences = splitSentences(fullText);

    for (const sentence of sentences) {
      // Length bounds
      if (sentence.length < 35 || sentence.length > 360) continue;

      // Dedup by first 140 chars lowercased
      const dedupKey = sentence.slice(0, 140).toLowerCase();
      if (seen.has(dedupKey)) continue;

      let score = 0;

      // Topic overlap: card name tokens ∩ content map topics
      const cmTopics = new Set(cm.topics.map((t) => t.toLowerCase()));
      let topicOverlap = 0;
      for (const tok of cardTokens) {
        for (const topic of cmTopics) {
          if (topic.includes(tok) || tok.includes(topic)) {
            topicOverlap++;
          }
        }
      }
      if (topicOverlap >= 8) {
        score += topicOverlap;
      }

      // Category keyword hit
      const sentLower = sentence.toLowerCase();
      for (const [, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        for (const kw of keywords) {
          if (sentLower.includes(kw)) {
            score += 5;
            break;
          }
        }
      }

      // Card name in text
      if (sentLower.includes(card.meta.id.toLowerCase()) ||
          tokenize(card.meta.title).some((t) => sentLower.includes(t))) {
        score += 4;
      }

      // Verb detection
      for (const verbRe of VERB_PATTERNS) {
        if (verbRe.test(sentence)) {
          score += 3;
          break;
        }
      }

      // Card-scoped scoring
      let scopeScore = 0;
      for (const inc of scope.includes) {
        if (sentLower.includes(inc)) scopeScore++;
      }
      for (const [a, b] of scope.allowPairs) {
        if (sentLower.includes(a) && sentLower.includes(b)) scopeScore += 3;
      }
      for (const exc of scope.excludes) {
        if (sentLower.includes(exc)) scopeScore--;
      }
      if (scopeScore < 0) continue; // block cross-contamination
      score += scopeScore;

      // Minimum threshold
      if (score < 6) continue;

      seen.add(dedupKey);
      results.push({
        text: sentence,
        score,
        sourcePath: cm.path,
        category: findBestCategory(sentence),
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Run semantic repair on a single card.
 */
export function semanticRepairCard(
  card: MemoryCard,
  contentMaps: SourceContentMap[],
): RepairResult {
  const matches = detectBoilerplate(card.body);
  const boilerplateSections = new Set(matches.map((m) => m.sectionName));

  // Extract scoped sentences
  const sentences = extractCardScopedSentences(card, contentMaps);

  // Also quarantine if no content maps available for this card
  const relevantMaps = contentMaps.filter((cm) =>
    cm.targetCards.includes(card.meta.id),
  );
  if (relevantMaps.length === 0 && boilerplateSections.size > 0) {
    return {
      cardId: card.meta.id,
      repaired: false,
      filledSections: [],
      quarantined: true,
      reason: "No content maps available for this card",
    };
  }

  // Fill boilerplate sections — actually modify the body
  const filledSections: string[] = [];
  let newBody = card.body;
  let usedSentences = 0;

  for (const sectionName of boilerplateSections) {
    const available = sentences.slice(usedSentences, usedSentences + 3);
    if (available.length > 0) {
      const sectionContent = available.map((s) => s.text).join(" ");
      // Replace the boilerplate content under this section heading
      const sectionRegex = new RegExp(`(## ${sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\n[^#]*`, "m");
      newBody = newBody.replace(sectionRegex, `$1\n${sectionContent}\n`);
      filledSections.push(sectionName);
      usedSentences += available.length;
    }
  }

  // Determine if the card should be quarantined
  const allSections = getSectionNames(card.body);
  const boilerplateRatio =
    allSections.length > 0
      ? boilerplateSections.size / allSections.length
      : 0;
  const quarantined = boilerplateRatio > 0.5 && filledSections.length === 0;

  const repaired = filledSections.length > 0;

  // Apply the modified body to the card
  if (repaired) {
    card.body = newBody;
  }

  return {
    cardId: card.meta.id,
    repaired,
    filledSections,
    quarantined,
    reason: quarantined
      ? `Over 50% of sections are boilerplate (${boilerplateSections.size}/${allSections.length})`
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function getSectionNames(body: string): string[] {
  const headings = body.match(/^## .+$/gm);
  if (!headings) return [];
  return headings.map((h) => h.replace(/^## /, "").trim());
}

function findBestCategory(sentence: string): string | undefined {
  const lower = sentence.toLowerCase();
  let bestCategory: string | undefined;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let hits = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) hits++;
    }
    if (hits > bestScore) {
      bestScore = hits;
      bestCategory = category;
    }
  }

  return bestScore > 0 ? bestCategory : undefined;
}

// ---------------------------------------------------------------------------
// D2: Category-aware extraction + card writers
// ---------------------------------------------------------------------------

export function extractByCategory(
  sentences: ExtractedSentence[],
  category: keyof typeof CATEGORY_KEYWORDS,
): ExtractedSentence[] {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords) return [];
  return sentences
    .map((s) => {
      const lower = s.text.toLowerCase();
      let hits = 0;
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) hits++;
      }
      return { sentence: s, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.sentence.score - a.sentence.score)
    .map((x) => ({ ...x.sentence, category }));
}

function pick(arr: ExtractedSentence[], fallback: string): string {
  return arr.length > 0 ? arr[0].text : fallback;
}

export function writeDecisionCard(card: MemoryCard, extracted: ExtractedSentence[]): string {
  const mechanics = extractByCategory(extracted, "mechanics");
  const rationale = extractByCategory(extracted, "rationale");
  const alternatives = extractByCategory(extracted, "alternative");
  const consequences = extractByCategory(extracted, "consequence");

  return [
    `# ${card.meta.title}`,
    "",
    "## Context",
    pick(mechanics, "Needs review — what problem triggered this decision?"),
    "",
    "## Problem",
    pick(mechanics, "Needs review — what specific problem was solved?"),
    "",
    "## Decision",
    pick(mechanics, "Needs review — what was decided?"),
    "",
    "## Rationale",
    pick(rationale, "Needs review — why this decision?"),
    "",
    "## Alternatives considered",
    pick(alternatives, "Needs review — what alternatives were evaluated?"),
    "",
    "## Rejected alternatives",
    pick(alternatives, "See alternatives above."),
    "",
    "## Consequences",
    pick(consequences, "Needs review — what trade-offs were accepted?"),
    "",
    "## Current behavior evidence",
    "Needs review — does the decision still hold against current code?",
    "",
    "## Affected modules",
    "Needs review — which modules are affected by this decision?",
    "",
    "## Affected scenarios",
    "Needs review — which scenarios are affected by this decision?",
    "",
  ].join("\n");
}

export function writeFlowCard(card: MemoryCard, extracted: ExtractedSentence[]): string {
  const flow = extractByCategory(extracted, "flow");
  const rationale = extractByCategory(extracted, "rationale");

  return [
    `# ${card.meta.title}`,
    "",
    "## Goal",
    pick(flow, "Needs review — what is the goal of this flow?"),
    "",
    "## Actors",
    "Needs review — identify actors from code/tests/docs.",
    "",
    "## Sequence",
    pick(flow, "Needs review — describe the sequence of steps."),
    "",
    "## Fallback",
    pick(flow, "Needs review — what is the fallback?"),
    "",
    "## Constraints",
    "Needs review — identify constraints, limits, error conditions.",
    "",
    "## Error handling",
    "Needs review — identify known failure scenarios.",
    "",
    "## Related modules",
    "Needs review — link related module cards.",
    "",
    "## Related tests",
    "Needs review — link related test cards.",
    "",
    "## Rationale",
    pick(rationale, "Needs review — why does this flow exist?"),
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// D3: Post-repair fixes
// ---------------------------------------------------------------------------

import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { classifyRuntimeTier } from "./runtimeTier.js";
import type { FileRecord } from "../schemas/discovery.js";
import type { SourceCoverage } from "../schemas/sourceCoverage.js";

export function repairLinks(cards: MemoryCard[]): { fixed: number; unfixed: string[]; changedCards: MemoryCard[] } {
  let fixed = 0;
  const unfixed: string[] = [];
  const changedCards: MemoryCard[] = [];

  for (const card of cards) {
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    const cardDir = path.dirname(card.path);
    let newBody = card.body;
    let changed = false;

    let match;
    while ((match = linkPattern.exec(card.body)) !== null) {
      const linkPath = match[2];
      if (/^https?:\/\//.test(linkPath) || linkPath.startsWith("#")) continue;
      const resolved = path.resolve(cardDir, linkPath);
      if (existsSync(resolved)) continue;

      // Try to find by basename
      const basename = path.basename(linkPath);
      const candidates = cards
        .filter((c) => path.basename(c.path) === basename)
        .map((c) => path.relative(cardDir, c.path));
      if (candidates.length > 0) {
        newBody = newBody.replace(`(${linkPath})`, `(${candidates[0]})`);
        changed = true;
        fixed++;
      } else {
        unfixed.push(`${card.meta.id}: ${linkPath}`);
      }
    }
    if (changed) {
      card.body = newBody;
      changedCards.push(card);
    }
  }
  return { fixed, unfixed, changedCards };
}

export function repairModuleTiers(cards: MemoryCard[], discovery: FileRecord[]): { updated: number; changedCards: MemoryCard[] } {
  let updated = 0;
  const changedCards: MemoryCard[] = [];
  for (const card of cards) {
    if (card.meta.runtime_tier === "unknown" || !card.meta.runtime_tier) {
      const tier = classifyRuntimeTier(card, discovery);
      if (tier !== "unknown") {
        card.meta.runtime_tier = tier;
        updated++;
        changedCards.push(card);
      }
    }
  }
  return { updated, changedCards };
}

export function repairArchitectureIndex(cards: MemoryCard[]): { updated: boolean } {
  const archCards = cards.filter((c) => c.meta.entity_type === "architecture");
  const moduleCards = cards.filter((c) => c.meta.entity_type === "module");
  if (moduleCards.length === 0) return { updated: false };
  // Just signal that update is needed — actual write in command
  return { updated: archCards.length > 0 };
}

export function repairCoverage(coverage: SourceCoverage): { fixed: number } {
  let fixed = 0;
  for (const entry of coverage.entries) {
    if (entry.disposition === "historical-only" && entry.targetCards.length > 0) {
      entry.targetCards = [];
      fixed++;
    }
  }
  return { fixed };
}

export function rebuildIndexes(cards: MemoryCard[]): {
  decisions: boolean;
  flows: boolean;
  decisionsTable: string;
  flowsTable: string;
} {
  const decisionCards = cards.filter((c) => c.meta.entity_type === "decision");
  const flowCards = cards.filter((c) => c.meta.entity_type === "flow");

  // Build markdown table from child cards
  const decisionsTable = decisionCards.length > 0
    ? "| Title | ID | Status |\n|-------|----|--------|\n" +
      decisionCards.map((c) => `| ${c.meta.title} | ${c.meta.id} | ${c.meta.status || "current"} |`).join("\n") + "\n"
    : "";

  const flowsTable = flowCards.length > 0
    ? "| Title | ID | Status |\n|-------|----|--------|\n" +
      flowCards.map((c) => `| ${c.meta.title} | ${c.meta.id} | ${c.meta.status || "current"} |`).join("\n") + "\n"
    : "";

  return {
    decisions: decisionCards.length > 0,
    flows: flowCards.length > 0,
    decisionsTable,
    flowsTable,
  };
}
