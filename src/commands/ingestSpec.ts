import path from "node:path";
import { mkdir, writeFile, readFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import fg from "fast-glob";
import yaml from "js-yaml";
import { discoverProject } from "../core/discoverProject.js";
import { classifySpecActuality, extractClaims, checkEvidence } from "../core/specClassification.js";
import { loadMemoryCards } from "../core/loadMemory.js";
import { resolveRoot, resolveMemoryRoot } from "../core/paths.js";
import type { RepoMemoryOptions } from "../core/types.js";
import type { StoredClaim } from "../schemas/claim.js";

function frontmatterYaml(data: Record<string, unknown>): string {
  return yaml.dump(data, { lineWidth: -1 }).trimEnd();
}

function today() {
  return new Date().toISOString().slice(0, 10);
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
  options: { root?: string; memoryRoot?: string; force?: boolean; dryRun?: boolean; json?: boolean } = {},
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
    const actuality = classifySpecActuality({ path: specRel, content }, discovery, memory, evidence);
    const slug = specRel.replace(/\.md$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

    let cardWritten = false;
    if (actuality === "historical_context") {
      const card = `---\n${frontmatterYaml({ entity_type: "historical", id: `historical-${slug}`, title: path.basename(specRel), status: "historical", authority: "historical_context", evidence_level: "spec_only", stability: "deprecated", source_confidence: "low", last_reviewed: today(), review_required: false, knowledge_types: ["historical_context"], source_refs: [{ path: specRel, role: "historical" }], claims: storedClaims, usage_policy: { can_answer_current_behavior: false, can_generate_code_from: false, can_use_as_rationale: true, requires_code_check_before_change: true } })}\n---\n\n# ${path.basename(specRel)} (historical)\n\nLegacy spec preserved for rationale. Not implementation guide.\n`;
      cardWritten = (await writeCard(memoryRoot, `historical/${slug}.md`, card, options.force ?? false, options.dryRun ?? false)) === "written";
    } else if (actuality === "proposed_unconfirmed" || actuality === "unknown_needs_review") {
      const card = `---\n${frontmatterYaml({ entity_type: "proposal", id: `proposal-${slug}`, title: path.basename(specRel), status: "proposed", authority: "proposed", evidence_level: "spec_only", stability: "experimental", source_confidence: "low", last_reviewed: today(), review_required: true, knowledge_types: ["proposed_behavior"], source_refs: [{ path: specRel, role: "spec" }], claims: storedClaims, usage_policy: { can_answer_current_behavior: false, can_generate_code_from: false, can_use_as_rationale: true, requires_code_check_before_change: true } })}\n---\n\n# ${path.basename(specRel)} (proposal)\n\nProposed behavior — requires evidence before becoming current.\n`;
      cardWritten = (await writeCard(memoryRoot, `proposals/${slug}.md`, card, options.force ?? false, options.dryRun ?? false)) === "written";
    } else if (actuality === "current_confirmed" || actuality === "partially_confirmed") {
      const card = `---\n${frontmatterYaml({ entity_type: "proposal", id: `proposal-${slug}`, title: path.basename(specRel), status: "proposed", authority: "proposed", evidence_level: actuality === "current_confirmed" ? "code_confirmed" : "spec_only", stability: "evolving", source_confidence: "medium", last_reviewed: today(), review_required: true, knowledge_types: ["proposed_behavior", "code_evidence"], source_refs: [{ path: specRel, role: "spec" }], claims: storedClaims, usage_policy: { can_answer_current_behavior: false, can_generate_code_from: false, can_use_as_rationale: true, requires_code_check_before_change: true } })}\n---\n\n# ${path.basename(specRel)}\n\nSpec with partial/full code evidence. Review before promoting to current.\n`;
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
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  console.log("# Spec ingest");
  console.log(`\nSpecs processed: ${results.length}`);
  for (const r of results) console.log(`- ${r.spec}: ${r.actuality} (${r.claims} claims, card ${r.cardWritten ? "written" : "skipped"})`);
}
