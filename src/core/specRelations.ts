import type { MemoryCard } from "./types.js";

export type DetectedRelation = {
  fromId: string;
  toId: string;
  type: "supersedes" | "conflicts_with" | "related_specs";
  reason: string;
  confidence: "high" | "medium" | "low";
};

/**
 * Local copy of extractSpecTopics from specClassification.ts (lines 51-56).
 * Duplicated to avoid circular dependency risk and keep specRelations.ts
 * self-contained. If logic diverges, extract to a shared utility module.
 * @see src/core/specClassification.ts
 */
function extractSpecTopics(path: string, content: string): string[] {
  const segments = path
    .toLowerCase()
    .split("/")
    .filter(
      (s) =>
        !["specs", "docs", "spec", "doc", "legacy", "archive", "proposals", "cr"].includes(s),
    );
  const headings = content.match(/^#+\s+(.+)$/gm) ?? [];
  const headingTopics = headings.map((h) => h.replace(/^#+\s+/, "").toLowerCase());
  return [
    ...new Set([
      ...segments.flatMap((s) => s.split(/[-_.]/)),
      ...headingTopics.flatMap((h) => h.split(/\s+/)),
    ]),
  ].filter((s) => s.length >= 3);
}

function jaccard(setA: Set<string>, setB: Set<string>): number {
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 0;
  return intersection / union;
}

function extractYear(str: string): number | null {
  const match = str.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1], 10) : null;
}

function isHistoricalOrDeprecated(card: MemoryCard): boolean {
  if (card.meta.status === "historical" || card.meta.status === "deprecated") return true;
  const lower = card.body.toLowerCase();
  return (
    lower.includes("deprecated") || lower.includes("obsolete") || lower.includes("legacy")
  );
}

function isProposalOrCurrent(card: MemoryCard): boolean {
  return card.meta.entity_type === "proposal" || card.meta.status === "current";
}

function isAccepted(card: MemoryCard): boolean {
  const topSection = card.body.slice(0, 500);
  const statusSectionMatch = card.body.match(/^##\s+Status\s*\n[\s\S]*?(?=\n##|$)/im);
  const statusSection = statusSectionMatch ? statusSectionMatch[0] : "";
  const searchBody = topSection + "\n" + statusSection;
  return /\bstatus\s*:\s*(accepted|implemented)\b/i.test(searchBody);
}

/**
 * Check if cardB's body contains an explicit "replaces"/"supersedes" keyword
 * plus a reference to cardA (by id, title, basename, or year).
 */
function hasReplaceReference(cardB: MemoryCard, cardA: MemoryCard): boolean {
  const lower = cardB.body.toLowerCase();
  if (!/\breplaces\b|\bsupersedes\b/.test(lower)) return false;

  const aId = cardA.meta.id.toLowerCase();
  const aTitle = cardA.meta.title.toLowerCase();
  const basename = cardA.relativePath.split("/").pop()?.toLowerCase() ?? "";
  const aYear = extractYear(cardA.relativePath);

  if (lower.includes(aId)) return true;
  if (aTitle && lower.includes(aTitle)) return true;
  if (basename && lower.includes(basename)) return true;
  if (aYear && lower.includes(String(aYear))) return true;
  return false;
}

/**
 * Detect cross-spec relations (supersedes, conflicts_with, related_specs)
 * between a set of memory cards by comparing topic overlap and metadata signals.
 */
export function detectSpecRelations(
  cards: MemoryCard[],
  options: { topicThreshold?: number } = {}
): DetectedRelation[] {
  const { topicThreshold = 0.3 } = options;

  // 1. Filter to spec-derived cards only
  const specCards = cards.filter(
    (c) =>
      c.meta.entity_type === "proposal" || c.meta.entity_type === "historical"
  );

  // Sort for deterministic pair ordering
  specCards.sort((a, b) => a.meta.id.localeCompare(b.meta.id));

  const relations: DetectedRelation[] = [];
  const emitted = new Set<string>(); // dedup key: "fromId|toId|type"

  function emit(
    fromId: string,
    toId: string,
    type: DetectedRelation["type"],
    reason: string,
    confidence: DetectedRelation["confidence"]
  ) {
    const key = `${fromId}|${toId}|${type}`;
    if (!emitted.has(key)) {
      emitted.add(key);
      relations.push({ fromId, toId, type, reason, confidence });
    }
  }

  // 2. Compare each unordered pair
  for (let i = 0; i < specCards.length; i++) {
    for (let j = i + 1; j < specCards.length; j++) {
      const A = specCards[i];
      const B = specCards[j];

      // Compute topic sets and Jaccard similarity
      const topicsA = new Set(extractSpecTopics(A.relativePath, A.body));
      const topicsB = new Set(extractSpecTopics(B.relativePath, B.body));
      const topicSim = jaccard(topicsA, topicsB);

      // --- Supersedes detection (B supersedes A) ---
      const bSupersedesA =
        isHistoricalOrDeprecated(A) &&
        isProposalOrCurrent(B) &&
        (topicSim >= topicThreshold || hasReplaceReference(B, A));

      // --- Supersedes detection (A supersedes B) ---
      const aSupersedesB =
        isHistoricalOrDeprecated(B) &&
        isProposalOrCurrent(A) &&
        (topicSim >= topicThreshold || hasReplaceReference(A, B));

      if (bSupersedesA) {
        const aYear = extractYear(A.relativePath);
        const bYear = extractYear(B.relativePath);
        const explicitReplace = hasReplaceReference(B, A);
        const yearSignal = aYear !== null && bYear !== null && bYear > aYear;
        const confidence = explicitReplace ? "high" : "medium";
        emit(
          B.meta.id,
          A.meta.id,
          "supersedes",
          `${B.meta.id} supersedes ${A.meta.id}: ${A.meta.id} is historical/deprecated, topic overlap=${topicSim.toFixed(2)}${yearSignal ? ", B has later year" : ""}${explicitReplace ? ", explicit replaces keyword" : ""}`,
          confidence
        );
        continue; // supersedes takes priority – skip related_specs/conflicts for this pair
      }

      if (aSupersedesB) {
        const explicitReplace = hasReplaceReference(A, B);
        const confidence = explicitReplace ? "high" : "medium";
        emit(
          A.meta.id,
          B.meta.id,
          "supersedes",
          `${A.meta.id} supersedes ${B.meta.id}: ${B.meta.id} is historical/deprecated, topic overlap=${topicSim.toFixed(2)}${explicitReplace ? ", explicit replaces keyword" : ""}`,
          confidence
        );
        continue;
      }

      // --- Conflict detection ---
      const bothCurrent = A.meta.status === "current" && B.meta.status === "current";
      const bothAccepted = isAccepted(A) && isAccepted(B);

      if ((bothCurrent || bothAccepted) && topicSim >= topicThreshold) {
        const label = bothCurrent ? "current" : "accepted";
        const sharedTopics = [...topicsA].filter((t) => topicsB.has(t));
        emit(
          A.meta.id,
          B.meta.id,
          "conflicts_with",
          `${A.meta.id} and ${B.meta.id} are both ${label} with overlapping topics (${sharedTopics.join(", ")}) – Jaccard=${topicSim.toFixed(2)}`,
          "medium"
        );
        emit(
          B.meta.id,
          A.meta.id,
          "conflicts_with",
          `${B.meta.id} and ${A.meta.id} are both ${label} with overlapping topics (${sharedTopics.join(", ")}) – Jaccard=${topicSim.toFixed(2)}`,
          "medium"
        );
        continue; // conflicts take priority – skip related_specs for this pair
      }

      // --- Related specs (topic overlap) ---
      if (topicSim >= topicThreshold) {
        const confidence = topicSim >= 0.5 ? "high" : "medium";
        emit(
          A.meta.id,
          B.meta.id,
          "related_specs",
          `${A.meta.id} and ${B.meta.id} share overlapping topics (Jaccard=${topicSim.toFixed(2)})`,
          confidence
        );
        emit(
          B.meta.id,
          A.meta.id,
          "related_specs",
          `${B.meta.id} and ${A.meta.id} share overlapping topics (Jaccard=${topicSim.toFixed(2)})`,
          confidence
        );
      }
    }
  }

  return relations;
}
