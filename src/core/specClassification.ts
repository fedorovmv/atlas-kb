import { ClaimSchema, EvidenceSchema } from "../schemas/claim.js";
import type { Claim, Evidence } from "../schemas/claim.js";
import type { DiscoveryReport, FileRecord } from "../schemas/discovery.js";
import type { MemoryCard } from "./types.js";

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
  const confirmedCount = evidence.filter((e) => e.status === "confirmed_by_code" || e.status === "confirmed_by_test").length;
  const specTopics = extractSpecTopics(spec.path, spec.content);
  const topicMatch = discovery.candidateModules.some((m) => m.topics.some((t) => specTopics.includes(t.toLowerCase())) || specTopics.some((t) => m.topics.includes(t.toLowerCase())));

  if (accepted && confirmedCount >= 1 && topicMatch) return "current_confirmed";
  if (confirmedCount >= 1 && topicMatch) return "partially_confirmed";

  // conflict
  const conflictEvidence = evidence.some((e) => e.status === "conflicts_with_code");
  const memoryConflict = memory.some((c) => c.meta.status === "conflict" && specTopics.some((t) => (c.meta.aliases.concat(c.meta.product_areas ?? [])).map((a)=>a.toLowerCase()).includes(t)));
  if (conflictEvidence || memoryConflict) return "conflicting";

  // draft/proposal
  const draftPath = ["proposals", "cr"].some((s) => pathSegments.includes(s));
  const draftContent = /status:\s*draft|\bdraft\b/.test(contentLower);
  if ((draftPath || draftContent) && confirmedCount === 0) return "proposed_unconfirmed";

  return "unknown_needs_review";
}

function extractSpecTopics(path: string, content: string): string[] {
  const segments = path.toLowerCase().split("/").filter((s) => !["specs", "docs", "spec", "doc", "legacy", "archive", "proposals", "cr"].includes(s));
  const headings = content.match(/^#+\s+(.+)$/gm) ?? [];
  const headingTopics = headings.map((h) => h.replace(/^#+\s+/, "").toLowerCase());
  return [...new Set([...segments.flatMap((s) => s.split(/[-_.]/)), ...headingTopics.flatMap((h) => h.split(/\s+/))])].filter((s) => s.length >= 3);
}

export function extractClaims(specContent: string, specPath: string): Claim[] {
  const claims: Claim[] = [];
  const lines = specContent.split("\n");
  let claimNum = 0;
  let currentSection = "";
  let currentAlternative: string | null = null;
  const rationalePattern = /rationale|why|decision|alternative|problem|constraint|consequence|trade.?off|non.?goal|value/i;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];

    const headingMatch = line.match(/^##+\s+(.+)$/);
    if (headingMatch) {
      const isSubheading = line.startsWith("###");
      if (isSubheading && currentSection.includes("alternative")) {
        currentAlternative = headingMatch[1];
        claimNum++;
        claims.push(makeClaim(claimNum, headingMatch[1], "design_rationale", specPath));
        continue;
      }
      currentAlternative = null;
      currentSection = headingMatch[1].toLowerCase();
      claimNum++;
      const type = inferClaimTypeFromSection(currentSection, headingMatch[1]);
      if (type) {
        claims.push(makeClaim(claimNum, headingMatch[1], type, specPath));
      }
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

    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);
    if (bulletMatch && /must|shall|should|will|does|is|filters|returns|accepts|rejects/i.test(bulletMatch[1])) {
      claimNum++;
      const type = rationalePattern.test(currentSection)
        ? "design_rationale"
        : "current_behavior";
      claims.push(makeClaim(claimNum, bulletMatch[1].trim(), type, specPath));
      continue;
    }

    // Paragraph extraction for rationale sections
    if (line.trim().length > 20 && !line.trim().startsWith("---") && !line.trim().startsWith("|") && !line.trim().startsWith("```")) {
      if (rationalePattern.test(currentSection)) {
        claimNum++;
        claims.push(makeClaim(claimNum, line.trim(), "design_rationale", specPath));
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
  if (/rationale|why|decision|alternatives|problem|constraint|consequence|trade.?off|non.?goal|value/.test(section)) return "design_rationale";
  if (/background|context|prior/.test(section)) return "historical_context";
  if (/requirement|claim|behavior|overview/.test(section)) return "current_behavior";
  if (/open question|unknown|tbd/.test(section)) return "open_question";
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
      status = "confirmed_by_code";
      confidence = "high";
      files = [...codeMatches, ...testMatches].map((f) => f.path);
    } else if (codeMatches.length >= 1) {
      status = "confirmed_by_code";
      confidence = "medium";
      files = codeMatches.map((f) => f.path);
    } else if (testMatches.length >= 1) {
      status = "confirmed_by_test";
      confidence = "medium";
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
