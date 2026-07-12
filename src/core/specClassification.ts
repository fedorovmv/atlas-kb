import { ClaimSchema, EvidenceSchema } from "../schemas/claim.js";
import type { Claim, Evidence } from "../schemas/claim.js";
import type { DiscoveryReport, FileRecord } from "../schemas/discovery.js";
import type { MemoryCard } from "./types.js";
import { extractSpecTopics } from "./topics.js";

export type SpecActuality =
  | "current_confirmed"
  | "partially_confirmed"
  | "proposed_unconfirmed"
  | "historical_context"
  | "conflicting"
  | "unknown_needs_review";

export function classifySpecActuality(
  spec: { path: string; content: string; mtime?: string },
  discovery: DiscoveryReport,
  memory: MemoryCard[],
  evidence: Evidence[]
): SpecActuality {
  const pathLower = spec.path.toLowerCase();
  const contentLower = spec.content.toLowerCase();
  const pathSegments = pathLower.split("/");

  // historical signals
  const historicalPath = ["legacy", "archive", "deprecated", "old"].some((s) => pathSegments.includes(s));
  const historicalContent = /status:\s*deprecated|status:\s*obsolete|\bobsolete\b|\blegacy\b/.test(contentLower);
  if (historicalPath || historicalContent) return "historical_context";

  // accepted/implemented with code evidence
  const accepted = /status:\s*accepted|status:\s*implemented|\baccepted\b|\bimplemented\b/.test(contentLower);
  const heuristicCount = evidence.filter((e) => e.status === "heuristic_code_match" || e.status === "heuristic_test_match").length;
  const specTopics = extractSpecTopics(spec.path, spec.content);
  const topicMatch = discovery.candidateModules.some((m) => m.topics.some((t) => specTopics.includes(t.toLowerCase())) || specTopics.some((t) => m.topics.includes(t.toLowerCase())));

  if (accepted && heuristicCount >= 1 && topicMatch) return "partially_confirmed";
  if (heuristicCount >= 1 && topicMatch) return "partially_confirmed";

  // conflict
  const conflictEvidence = evidence.some((e) => e.status === "conflicts_with_code");
  const memoryConflict = memory.some((c) => c.meta.status === "conflict" && specTopics.some((t) => (c.meta.aliases.concat(c.meta.product_areas ?? [])).map((a)=>a.toLowerCase()).includes(t)));
  if (conflictEvidence || memoryConflict) return "conflicting";

  // draft/proposal
  const draftPath = ["proposals", "cr"].some((s) => pathSegments.includes(s));
  const draftContent = /status:\s*draft|\bdraft\b/.test(contentLower);
  if ((draftPath || draftContent) && heuristicCount === 0) return "proposed_unconfirmed";

  return "unknown_needs_review";
}

export function extractClaims(specContent: string, specPath: string): Claim[] {
  const claims: Claim[] = [];
  const lines = specContent.split("\n");
  let claimNum = 0;
  let currentSection = "";
  let currentAlternative: string | null = null;
  const rationalePattern = /rationale|why|decision|alternative|problem|constraint|consequence|trade.?off|non.?goal|value|out.?of.?scope|обоснование|почему|решение|альтернатив|проблема|ограничение|последств|компромисс|цель|задача/i;
  // Broader behavioral verb pattern — catches prose without explicit modal verbs
  // English + Russian patterns
  const behaviorPattern = /must|shall|should|will|does|is|are|filters?|returns?|accepts?|rejects?|handles?|provides?|supports?|requires?|enforces?|validates?|registers?|discovers?|stores?|maintains?|controls?|manages?|processes?|transforms?|routes?|caches?|logs?|monitors?|tracks?|limits?|restricts?|scopes?|isolates?|должен|должно|обязан|реализует|предоставляет?|поддерживает?|требует?|проверяет?|регистрирует?|обнаруживает?|хранит|управляет|обрабатывает|преобразует|маршрутизирует|кэширует|логирует|контролирует|ограничивает|возвращает|принимает|отклоняет|фильтрует|выполняет|создаёт|генерирует|обновляет|удаляет|читает|записывает|запускает|останавливает|настраивает|вызывает|получает|отправляет|сохраняет|обновля/i;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];

    const headingMatch = line.match(/^##+\s+(.+)$/);
    if (headingMatch) {
      const isSubheading = line.startsWith("###");
      if (isSubheading && currentSection.includes("alternative")) {
        // Subheadings under "alternatives" section ARE claims (they name alternatives)
        currentAlternative = headingMatch[1];
        claimNum++;
        claims.push(makeClaim(claimNum, headingMatch[1], "design_rationale", specPath));
        continue;
      }
      // Regular headings set the current section but are NOT claims themselves.
      // Only content under headings (bullets, numbered items, prose) becomes claims.
      currentAlternative = null;
      currentSection = headingMatch[1].toLowerCase();
      continue;
    }

    // Rejected alternatives detection
    if (currentAlternative && /status\s*:\s*rejected/i.test(line)) {
      const reasonLine = lines.slice(li + 1).find((l) => /reason\s*:/i.test(l));
      const reason = reasonLine ? reasonLine.replace(/.*reason\s*:\s*/i, "").trim() : "rejected";
      claimNum++;
      claims.push(makeClaim(claimNum, `${currentAlternative} — rejected: ${reason}`, "design_rationale", specPath));
      continue;
    }

    // Bullet list items — with broader verb pattern
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);
    if (bulletMatch && behaviorPattern.test(bulletMatch[1])) {
      claimNum++;
      const type = rationalePattern.test(currentSection)
        ? "design_rationale"
        : inferClaimTypeFromSection(currentSection, bulletMatch[1]) ?? "current_behavior";
      claims.push(makeClaim(claimNum, bulletMatch[1].trim(), type, specPath));
      continue;
    }

    // Numbered list items — "1. The registry SHALL..." or "1. The registry filters..."
    const numberedMatch = line.match(/^\s*(\d+)\.\s+(.+)/);
    if (numberedMatch && behaviorPattern.test(numberedMatch[2])) {
      claimNum++;
      const type = rationalePattern.test(currentSection)
        ? "design_rationale"
        : inferClaimTypeFromSection(currentSection, numberedMatch[2]) ?? "current_behavior";
      claims.push(makeClaim(claimNum, numberedMatch[2].trim(), type, specPath));
      continue;
    }

    // Non-goal / out-of-scope bullet items — capture even without behavior verbs
    if (bulletMatch && /non.?goal|out.?of.?scope|not.?included|excluded|explicitly/i.test(currentSection)) {
      claimNum++;
      claims.push(makeClaim(claimNum, bulletMatch[1].trim(), "design_rationale", specPath));
      continue;
    }

    // Acceptance criteria bullets — "Definition of done", "Success criteria"
    if (bulletMatch && /acceptance|definition.?of.?done|success.?criteria|exit.?criteria/i.test(currentSection)) {
      claimNum++;
      claims.push(makeClaim(claimNum, bulletMatch[1].trim(), "proposed_behavior", specPath));
      continue;
    }

    // Paragraph extraction for rationale sections
    if (line.trim().length > 20 && !line.trim().startsWith("---") && !line.trim().startsWith("|") && !line.trim().startsWith("```")) {
      if (rationalePattern.test(currentSection)) {
        claimNum++;
        claims.push(makeClaim(claimNum, line.trim(), "design_rationale", specPath));
        continue;
      }
      // Prose with behavioral verbs in requirements/behavior sections
      if (behaviorPattern.test(line) && /requirement|claim|behavior|overview|background/i.test(currentSection)) {
        claimNum++;
        const type = inferClaimTypeFromSection(currentSection, line.trim()) ?? "current_behavior";
        claims.push(makeClaim(claimNum, line.trim(), type, specPath));
        continue;
      }
    }

    const codeRefMatch = line.match(/`([a-z0-9_\-/.]+\.(?:go|ts|js|py|java))`/i);
    if (codeRefMatch) {
      claimNum++;
      claims.push(makeClaim(claimNum, `References ${codeRefMatch[1]}`, "current_behavior", specPath));
    }
  }

  return claims.map((c) => {
    const parsed = ClaimSchema.safeParse(c);
    return parsed.success ? parsed.data : c;
  });
}

function inferClaimTypeFromSection(section: string, _heading: string): Claim["type"] | null {
  if (/rationale|why|decision|alternatives|problem|constraint|consequence|trade.?off|non.?goal|out.?of.?scope|value|обоснование|почему|решение|альтернатив|проблема|ограничение|последств|компромисс|цель|задача/.test(section)) return "design_rationale";
  if (/acceptance|definition.?of.?done|success.?criteria|exit.?criteria|критер/.test(section)) return "proposed_behavior";
  if (/background|context|prior|контекст|предыстор/.test(section)) return "historical_context";
  if (/requirement|claim|behavior|overview|требован|поведен|описан/.test(section)) return "current_behavior";
  if (/open question|unknown|tbd|вопрос|неизвест/.test(section)) return "open_question";
  return null;
}

function makeClaim(num: number, text: string, type: Claim["type"], source_path: string): Claim {
  return {
    id: `claim-${String(num).padStart(3, "0")}`,
    text,
    type,
    evidence_required: true,
    source_path,
  };
}

function keywordsForMatch(text: string): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
  return new Set(words);
}

function fileMatchesClaim(fileBasename: string, claimText: string): boolean {
  const nameWithoutExt = fileBasename.toLowerCase().replace(/\.\w+$/, "");
  const nameTokens = new Set(nameWithoutExt.split(/[-_.]/).filter((t) => t.length >= 3));
  const claimTokens = keywordsForMatch(claimText);
  const overlap = [...nameTokens].filter((t) => [...claimTokens].some((c) => c.includes(t) || t.includes(c)));
  return overlap.length > 0;
}

export function checkEvidence(claims: Claim[], discovery: DiscoveryReport): Evidence[] {
  return claims.map((claim) => {
    const codeMatches = discovery.files.filter((f) => f.kind === "code" && fileMatchesClaim(f.basename, claim.text));
    const testMatches = discovery.files.filter((f) => f.kind === "test" && fileMatchesClaim(f.basename, claim.text));
    const docMatches = discovery.files.filter((f) => f.kind === "doc" && fileMatchesClaim(f.basename, claim.text));

    let status: Evidence["status"];
    let confidence: Evidence["confidence"];
    let files: string[];

    if (codeMatches.length >= 1 && testMatches.length >= 1) {
      status = "heuristic_code_match";
      confidence = "medium";
      files = [...codeMatches, ...testMatches].map((f) => f.path);
    } else if (codeMatches.length >= 1) {
      status = "heuristic_code_match";
      confidence = "low";
      files = codeMatches.map((f) => f.path);
    } else if (testMatches.length >= 1) {
      status = "heuristic_test_match";
      confidence = "low";
      files = testMatches.map((f) => f.path);
    } else if (docMatches.length >= 1) {
      status = "documented_only";
      confidence = "low";
      files = docMatches.map((f) => f.path);
    } else {
      status = "not_found";
      confidence = "unknown";
      files = [];
    }

    const evidence = { claim_id: claim.id, status, confidence, files, notes: [] };
    const parsed = EvidenceSchema.safeParse(evidence);
    return parsed.success ? parsed.data : evidence;
  });
}
