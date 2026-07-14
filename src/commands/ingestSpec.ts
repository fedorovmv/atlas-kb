import path from "node:path";
import { mkdir, writeFile, readFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import fg from "fast-glob";
import { dedupClaims } from "../core/claimDedup.js";
import { linkClaimsToCards } from "../core/claimLinking.js";
import { discoverProject } from "../core/discoverProject.js";
import { classifySpecActuality, extractClaims, checkEvidence } from "../core/specClassification.js";
import { loadMemoryCards, findCardById } from "../core/loadMemory.js";
import { updateMemoryCard } from "../core/updateMemory.js";
import { resolveRoot, resolveMemoryRoot } from "../core/paths.js";
import { detectSpecRelations } from "../core/specRelations.js";
import { frontmatterYaml, today, readFileIfExists } from "../core/utils.js";
import { RELATION_FIELDS, type RelationField } from "../core/relations.js";
import type { RepoMemoryOptions } from "../core/types.js";
import type { StoredClaim } from "../schemas/claim.js";

function extractSection(content: string, sectionName: string): string | null {
  const pattern = new RegExp(`^##\\s+${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "im");
  const match = content.match(pattern);
  if (!match) return null;
  return match[1].trim();
}

async function writeCard(memoryRoot: string, relPath: string, content: string, force: boolean, dryRun: boolean): Promise<"written" | "skipped"> {
  const target = path.join(memoryRoot, relPath);
  if (existsSync(target) && !force) return "skipped";
  if (!dryRun) {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  return "written";
}

export async function ingestSpecCommand(
  specArg: string,
  options: { root?: string; memoryRoot?: string; force?: boolean; dryRun?: boolean; json?: boolean; topicThreshold?: number } = {},
) {
  const root = resolveRoot(options);
  const memoryRoot = resolveMemoryRoot(options);
  const discovery = await discoverProject({ root, memoryRoot });
  const memory = await loadMemoryCards({ root, memoryRoot });
  const specPaths = fg.sync(specArg, { cwd: root, absolute: false, ignore: ["**/node_modules/**", "**/.ai/**"] });
  const results: { spec: string; actuality: string; claims: number; cardWritten: boolean }[] = [];

  for (const specRel of specPaths) {
    const content = await readFile(path.join(root, specRel), "utf8");
    const claims = extractClaims(content, specRel);
    const evidence = checkEvidence(claims, discovery);
    const storedClaims: StoredClaim[] = claims.map((c) => {
      const ev = evidence.find((e) => e.claim_id === c.id);
      return {
        ...c,
        evidence: ev ?? { claim_id: c.id, status: "not_checked" as const, confidence: "unknown" as const, files: [] as string[], notes: [] as string[] },
        last_checked: today(),
      };
    });
    const dedupedClaims = dedupClaims(storedClaims);
    const linkedClaims = linkClaimsToCards(dedupedClaims, memory);
    const actuality = classifySpecActuality({ path: specRel, content }, discovery, memory, evidence);
    const slug = specRel.replace(/\.md$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

    let cardWritten = false;
    if (actuality === "historical_context") {
      const card = `---\n${frontmatterYaml({ entity_type: "historical", id: `historical-${slug}`, title: path.basename(specRel), status: "historical", authority: "historical_context", evidence_level: "spec_only", stability: "deprecated", source_confidence: "low", last_reviewed: today(), review_required: true, knowledge_types: ["historical_context"], source_refs: [{ path: specRel, role: "historical" }], claims: linkedClaims, usage_policy: { can_answer_current_behavior: false, can_generate_code_from: false, can_use_as_rationale: true, requires_code_check_before_change: true } })}\n---\n\n# ${path.basename(specRel)} (historical)\n\nLegacy spec preserved for rationale. Not implementation guide.\n\n---\n\n${content}\n`;
      cardWritten = (await writeCard(memoryRoot, `historical/${slug}.md`, card, options.force ?? false, options.dryRun ?? false)) === "written";
    } else if (actuality === "proposed_unconfirmed" || actuality === "unknown_needs_review") {
      const card = `---\n${frontmatterYaml({ entity_type: "proposal", id: `proposal-${slug}`, title: path.basename(specRel), status: "proposed", authority: "proposed", evidence_level: "spec_only", stability: "experimental", source_confidence: "low", last_reviewed: today(), review_required: true, knowledge_types: ["proposed_behavior"], source_refs: [{ path: specRel, role: "spec" }], claims: linkedClaims, usage_policy: { can_answer_current_behavior: false, can_generate_code_from: false, can_use_as_rationale: true, requires_code_check_before_change: true } })}\n---\n\n# ${path.basename(specRel)} (proposal)\n\nProposed behavior — requires evidence before becoming current.\n\n---\n\n${content}\n`;
      cardWritten = (await writeCard(memoryRoot, `proposals/${slug}.md`, card, options.force ?? false, options.dryRun ?? false)) === "written";
    } else if (actuality === "partially_confirmed") {
      const card = `---\n${frontmatterYaml({ entity_type: "proposal", id: `proposal-${slug}`, title: path.basename(specRel), status: "proposed", authority: "proposed", evidence_level: "heuristic_match", stability: "evolving", source_confidence: "medium", last_reviewed: today(), review_required: true, knowledge_types: ["proposed_behavior", "code_evidence"], source_refs: [{ path: specRel, role: "spec" }], claims: linkedClaims, usage_policy: { can_answer_current_behavior: false, can_generate_code_from: false, can_use_as_rationale: true, requires_code_check_before_change: true } })}\n---\n\n# ${path.basename(specRel)}\n\nSpec with heuristic code match. Review before promoting to current.\n\n---\n\n${content}\n`;
      cardWritten = (await writeCard(memoryRoot, `proposals/${slug}.md`, card, options.force ?? false, options.dryRun ?? false)) === "written";
    } else if (actuality === "conflicting") {
      const conflictsPath = path.join(memoryRoot, "reconciliation", "conflicts.md");
      const note = `\n- Conflict from ${specRel}: ${claims.length} claims, actuality=${actuality}\n`;
      if (!options.dryRun) {
        await mkdir(path.dirname(conflictsPath), { recursive: true });
        await appendFile(conflictsPath, note);
      }
      cardWritten = true;
    }
    results.push({ spec: specRel, actuality, claims: claims.length, cardWritten });

    // Create decision card if spec has rationale content (Problem/Decision/Rationale headings)
    const hasRationale = /##\s+(problem|decision|rationale)\b/im.test(content);
    const hasRequirements = /##\s+(requirements?|claims?)\b/im.test(content);
    if (hasRationale && actuality !== "historical_context" && !options.dryRun) {
      const rationaleClaims = dedupedClaims.filter((c) => c.type === "design_rationale");
      const decisionCard = `---\n${frontmatterYaml({ entity_type: "decision", id: `decision-${slug}`, title: path.basename(specRel), status: "current", authority: "reviewed_memory", evidence_level: "reviewed_doc", stability: "stable", source_confidence: "medium", last_reviewed: today(), review_required: true, knowledge_types: ["design_rationale"], source_refs: [{ path: specRel, role: "rationale" }], claims: rationaleClaims, usage_policy: { can_answer_current_behavior: false, can_generate_code_from: false, can_use_as_rationale: true, requires_code_check_before_change: true } })}\n---\n\n# ${path.basename(specRel)} (decision)\n\n## Context\nExtracted from spec. Review for completeness.\n\n## Problem\n${extractSection(content, "Problem") || "Needs review"}\n\n## Decision\n${extractSection(content, "Decision") || "Needs review"}\n\n## Rationale\n${extractSection(content, "Rationale") || "Needs review"}\n\n## Alternatives considered\n${extractSection(content, "Alternatives") || "Needs review"}\n\n## Consequences\n${extractSection(content, "Consequences") || "Needs review"}\n`;
      const decisionWritten = (await writeCard(memoryRoot, `decisions/${slug}.md`, decisionCard, options.force ?? false, false)) === "written";
      if (decisionWritten && !hasRequirements) {
        // Spec was only rationale — mark decision as primary card
      }
    }
  }

  // Post-comparison pass: detect and apply cross-spec relations
  const allCards = await loadMemoryCards({ root, memoryRoot });
  const relations = detectSpecRelations(allCards, { topicThreshold: options.topicThreshold ?? 0.3 });

  if (relations.length > 0 && !options.dryRun) {
    // Group relations by cardId+type to batch-update
    const updatesByCard = new Map<string, Record<string, string[]>>();

    for (const rel of relations) {
      if (!updatesByCard.has(rel.fromId)) updatesByCard.set(rel.fromId, {});
      const cardUpdates = updatesByCard.get(rel.fromId)!;
      if (!cardUpdates[rel.type]) cardUpdates[rel.type] = [];
      if (!cardUpdates[rel.type].includes(rel.toId)) {
        cardUpdates[rel.type].push(rel.toId);
      }
    }

    // For supersedes relations, also set reverse: superseded_by on the target
    for (const rel of relations.filter((r) => r.type === "supersedes")) {
      if (!updatesByCard.has(rel.toId)) updatesByCard.set(rel.toId, {});
      const cardUpdates = updatesByCard.get(rel.toId)!;
      if (!cardUpdates.superseded_by) cardUpdates.superseded_by = [];
      if (!cardUpdates.superseded_by.includes(rel.fromId)) {
        cardUpdates.superseded_by.push(rel.fromId);
      }
    }

    // Apply updates — with change detection to avoid unnecessary writes
    for (const [cardId, newRelations] of updatesByCard) {
      const card = findCardById(allCards, cardId);
      if (!card) continue;
      const merged: Record<string, string[]> = {};
      let hasChanges = false;
      for (const [field, newIds] of Object.entries(newRelations)) {
        const relField = field as RelationField;
        const existing = card.meta[relField] ?? [];
        const deduped = [...new Set([...existing, ...newIds])];
        merged[field] = deduped;
        // Check if anything actually changed
        if (deduped.length !== existing.length || !deduped.every((id, idx) => existing[idx] === id)) {
          hasChanges = true;
        }
      }
      if (hasChanges) {
        await updateMemoryCard(cardId, { root, memoryRoot, fields: merged });
      }
    }

    // Append conflicts to reconciliation/conflicts.md (idempotent)
    const conflictRelations = relations.filter((r) => r.type === "conflicts_with");
    if (conflictRelations.length > 0) {
      const memoryRootForConflicts = resolveMemoryRoot(options);
      const conflictsPath = path.join(memoryRootForConflicts, "reconciliation", "conflicts.md");
      const todayStr = today();
      const existing = await readFileIfExists(conflictsPath);
      const newLines: string[] = [];
      for (const rel of conflictRelations) {
        const line = `- [ingest ${todayStr}] Conflict: card=${rel.fromId} conflicts_with=${rel.toId} — ${rel.reason}`;
        if (!existing.includes(line)) {
          newLines.push(`\n${line}\n`);
        }
      }
      if (newLines.length > 0) {
        await mkdir(path.dirname(conflictsPath), { recursive: true });
        await appendFile(conflictsPath, newLines.join(""));
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  console.log("# Spec ingest");
  console.log(`\nSpecs processed: ${results.length}`);
  for (const r of results) console.log(`- ${r.spec}: ${r.actuality} (${r.claims} claims, card ${r.cardWritten ? "written" : "skipped"})`);
}
