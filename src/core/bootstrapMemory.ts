import path from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import matter from "gray-matter";
import { discoverProject } from "./discoverProject.js";
import { resolveRoot, resolveMemoryRoot, toPosixPath } from "./paths.js";
import { frontmatterYaml, today } from "./utils.js";
import type { DiscoveryReport, CandidateModule, FileRecord } from "../schemas/discovery.js";

export type BootstrapResult = {
  written: string[];
  skipped: string[];
  report: DiscoveryReport;
};

// --- Skip logic ---

async function shouldSkipExisting(target: string, force: boolean): Promise<string | null> {
  if (!force) return "exists";
  // With --force: skip enriched cards to prevent data loss
  try {
    const raw = await readFile(target, "utf8");
    if (!raw.trimStart().startsWith("---")) return null; // no frontmatter — overwrite
    const parsed = matter(raw);
    const meta = parsed.data as { review_required?: boolean; evidence_level?: string; status?: string };
    // Skip if card is enriched (review completed or evidence confirmed)
    if (meta.review_required === false) return "already reviewed";
    if (meta.evidence_level === "code_confirmed" || meta.evidence_level === "test_confirmed") return "evidence confirmed";
    return null; // needs_review or unconfirmed — safe to overwrite
  } catch {
    return null; // can't read — overwrite
  }
}

export async function bootstrapMemory(options: { root?: string; memoryRoot?: string; force?: boolean; dryRun?: boolean } = {}): Promise<BootstrapResult> {
  const root = resolveRoot(options);
  const memoryRoot = resolveMemoryRoot(options);
  const report = await discoverProject({ root, memoryRoot });
  const written: string[] = [];
  const skipped: string[] = [];

  // Helper: write or skip. Skip enriched cards even with --force to prevent data loss.
  const writeCard = async (relativePath: string, content: string) => {
    const target = path.join(memoryRoot, relativePath);
    const rel = toPosixPath(path.relative(root, target));
    if (existsSync(target)) {
      const skipReason = await shouldSkipExisting(target, options.force ?? false);
      if (skipReason) {
        skipped.push(`${rel} (${skipReason})`);
        return;
      }
    }
    if (!options.dryRun) {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
    }
    written.push(rel);
  };

  // Module cards from candidate modules (confidence >= medium)
  for (const mod of report.candidateModules) {
    if (mod.confidence === "low" && mod.codeFiles.length === 0) continue;
    const hasCode = mod.codeFiles.length > 0;
    const hasTest = mod.testFiles.length > 0;
    const status = "needs_review";
    const evidenceLevel = hasCode ? "heuristic_match" : "inferred";
    const card = renderModuleCard(mod, status, evidenceLevel);
    await writeCard(`modules/${mod.id}.md`, card);
  }

  // Scenario cards from spec/doc headings (deterministic extraction)
  const scenarios = extractScenarios(report);
  for (const scenario of scenarios) {
    await writeCard(`scenarios/${scenario.slug}.md`, renderScenarioCard(scenario));
  }

  // Decision cards from explicit rationale sections
  const decisions = extractDecisions(report);
  for (const decision of decisions) {
    await writeCard(`decisions/${decision.id}.md`, renderDecisionCard(decision));
  }

  // Historical/proposal cards from spec files
  for (const file of report.files.filter((f) => f.kind === "spec" || f.kind === "legacy")) {
    const isLegacy = file.kind === "legacy" || file.signals.includes("legacy") || file.signals.includes("deprecated") || file.dirname.includes("legacy");
    const slug = slugifyPath(file.path);
    if (isLegacy) {
      await writeCard(`historical/${slug}.md`, renderHistoricalCard(file, `historical-${slug}`));
    } else {
      await writeCard(`proposals/${slug}.md`, renderProposalCard(file, `proposal-${slug}`));
    }
  }

  // Ensure reconciliation dir exists
  const conflictsPath = path.join(memoryRoot, "reconciliation", "conflicts.md");
  const questionsPath = path.join(memoryRoot, "reconciliation", "open-questions.md");
  if (!existsSync(conflictsPath) || options.force) {
    await writeCard("reconciliation/conflicts.md", RECONCILIATION_CONFLICTS_TEMPLATE);
  }
  if (!existsSync(questionsPath) || options.force) {
    await writeCard("reconciliation/open-questions.md", RECONCILIATION_QUESTIONS_TEMPLATE);
  }

  return { written, skipped, report };
}

// --- Card renderers ---

function renderModuleCard(mod: CandidateModule, status: string, evidenceLevel: string): string {
  const todayStr = today();
  const fm = frontmatterYaml({
    entity_type: "module",
    id: mod.id,
    title: mod.title,
    status,
    authority: status === "current" ? "source_of_truth" : "reviewed_memory",
    evidence_level: evidenceLevel,
    stability: status === "current" ? "stable" : "evolving",
    source_confidence: mod.confidence === "high" ? "high" : mod.confidence === "medium" ? "medium" : "low",
    last_reviewed: todayStr,
    review_required: status !== "current",
    knowledge_types: ["current_behavior"],
    product_areas: mod.topics.slice(0, 3),
    code_refs: mod.codeFiles.map((p) => ({ path: p, kind: "production" })),
    test_refs: mod.testFiles.map((p) => ({ path: p, kind: "unit" })),
    source_refs: mod.docFiles.map((p) => ({ path: p, role: "current_doc" })),
    usage_policy: {
      can_answer_current_behavior: status === "current",
      can_generate_code_from: false,
      can_use_as_rationale: true,
      requires_code_check_before_change: true,
    },
  });
  const body = [
    `# ${mod.title}`,
    "",
    `## Responsibility`,
    `Preliminary responsibility inferred from: ${mod.signals.join(", ") || mod.topics.join(", ")}.`,
    "",
    `## Non-responsibilities`,
    "Needs review — EXAMPLE: 'Filters agent cards by caller service identity at internal/registry/access_filter.go (FilterCardsForCaller)'",
    "",
    `## Current behavior`,
    "Needs review — EXAMPLE: 'Does NOT choose target agents. Does NOT transform request payloads.'",
    "",
    `## Known risks`,
    "Needs review — EXAMPLE: 'TODO at internal/registry/access_filter.go:42: refactor caller filtering'",
    "",
    `## Code evidence`,
    ...mod.codeFiles.map((p) => `- Code file at ${p}:1`),
    "Preliminary evidence from code_refs — memory-coder must confirm specific symbols.",
    "",
    `## Test evidence`,
    ...mod.testFiles.map((p) => `- Test file at ${p}:1`),
    "Preliminary evidence from test_refs — memory-coder must confirm test coverage.",
    "",
    `## Related`,
    `- Code files: ${mod.codeFiles.length}`,
    `- Test files: ${mod.testFiles.length}`,
    `- Doc files: ${mod.docFiles.length}`,
    `- Demo files: ${mod.demoFiles.length} (NOT production evidence)`,
    "",
    `## Open questions`,
    "Needs review — add questions that cannot be answered from code alone.",
  ].join("\n");
  return `---\n${fm}\n---\n\n${body}\n`;
}

function renderScenarioCard(s: { id: string; title: string; topics: string[]; sourceFiles: string[] }): string {
  const todayStr = today();
  const fm = frontmatterYaml({
    entity_type: "scenario",
    id: s.id,
    title: s.title,
    status: "needs_review",
    authority: "reviewed_memory",
    evidence_level: "inferred",
    stability: "evolving",
    source_confidence: "low",
    last_reviewed: todayStr,
    review_required: true,
    knowledge_types: ["current_behavior"],
    product_areas: s.topics.slice(0, 3),
    source_refs: s.sourceFiles.map((p) => ({ path: p, role: "current_doc" })),
    usage_policy: {
      can_answer_current_behavior: false,
      can_generate_code_from: false,
      can_use_as_rationale: true,
      requires_code_check_before_change: true,
    },
  });
  return `---\n${fm}\n---\n\n# ${s.title}\n\n## Goal\nInferred from: ${s.topics.join(", ")}\n\n## Actors\nNeeds review — identify actors from code/tests/docs.\n\n## Flow\nNeeds review — read source_refs and code to describe the flow.\n\n## Constraints\nNeeds review — identify constraints, limits, error conditions.\n\n## Failure cases\nNeeds review — identify known failure scenarios.\n\n## Code evidence\nNot yet verified — memory-coder must confirm flow against code.\n\n## Test evidence\nNot yet verified — memory-coder must confirm test coverage for this scenario.\n\n## Rationale\nNeeds review — why does this scenario exist and not another?\n`;
}

function renderDecisionCard(d: { id: string; title: string; rationale: string; sourceFile: string }): string {
  const todayStr = today();
  const fm = frontmatterYaml({
    entity_type: "decision",
    id: d.id,
    title: d.title,
    status: "current",
    authority: "reviewed_memory",
    evidence_level: "reviewed_doc",
    stability: "stable",
    source_confidence: "medium",
    last_reviewed: todayStr,
    review_required: false,
    knowledge_types: ["design_rationale"],
    source_refs: [{ path: d.sourceFile, role: "rationale" }],
    usage_policy: {
      can_answer_current_behavior: false,
      can_generate_code_from: false,
      can_use_as_rationale: true,
      requires_code_check_before_change: true,
    },
  });
  return `---\n${fm}\n---\n\n# ${d.title}\n\n## Context\nNeeds review — what problem triggered this decision?\n\n## Problem\nNeeds review — what specific problem was solved?\n\n## Decision\nNeeds review — what was decided?\n\n## Rationale\n${d.rationale}\n\n## Alternatives considered\nNeeds review — what alternatives were evaluated?\n\n## Rejected alternatives\nNeeds review — what was rejected and why?\n\n## Consequences/trade-offs\nNeeds review — what trade-offs were accepted?\n\n## Current behavior evidence\nNeeds review — does the decision still hold against current code?\n`;
}

function renderHistoricalCard(file: FileRecord, id: string): string {
  const todayStr = today();
  const fm = frontmatterYaml({
    entity_type: "historical",
    id,
    title: file.basename,
    status: "historical",
    authority: "historical_context",
    evidence_level: "spec_only",
    stability: "deprecated",
    source_confidence: "low",
    last_reviewed: todayStr,
    review_required: false,
    knowledge_types: ["historical_context"],
    source_refs: [{ path: file.path, role: "historical" }],
    usage_policy: {
      can_answer_current_behavior: false,
      can_generate_code_from: false,
      can_use_as_rationale: true,
      requires_code_check_before_change: true,
    },
  });
  return `---\n${fm}\n---\n\n# ${file.basename} (historical)\n\n## Problems attempted\nNeeds review — what problem did this approach try to solve?\n\n## Prior approach\nLegacy spec preserved for rationale context. Not an implementation guide.\n\n## Rationale still useful\nNeeds review — which parts of the rationale remain relevant?\n\n## Obsolete/unconfirmed ideas\nNeeds review — what is no longer applicable?\n\n## Decisions that survived\nNeeds review — which decisions from this spec carried forward?\n\n## Links to current decisions\nNeeds review — link to current decision cards that supersede this.\n`;
}

function renderProposalCard(file: FileRecord, id: string): string {
  const todayStr = today();
  const fm = frontmatterYaml({
    entity_type: "proposal",
    id,
    title: file.basename,
    status: "proposed",
    authority: "proposed",
    evidence_level: "spec_only",
    stability: "experimental",
    source_confidence: "low",
    last_reviewed: todayStr,
    review_required: true,
    knowledge_types: ["proposed_behavior"],
    source_refs: [{ path: file.path, role: "spec" }],
    usage_policy: {
      can_answer_current_behavior: false,
      can_generate_code_from: false,
      can_use_as_rationale: true,
      requires_code_check_before_change: true,
    },
  });
  return `---\n${fm}\n---\n\n# ${file.basename} (proposal)\n\n## Source spec\n${file.path}\n\n## Proposed behavior\nUnconfirmed spec — requires code/test evidence before becoming current behavior.\n\n## Rationale from spec\nNeeds review — extract rationale from the source spec.\n\n## Affected modules\nNeeds review — which modules would this proposal change?\n\n## Affected scenarios\nNeeds review — which scenarios would this proposal change?\n\n## Current code check\nNeeds review — memory-coder must check if proposal is already partially implemented.\n\n## Confirmed/not found/conflicting claims\nNeeds review — classify each claim from the spec.\n\n## Suggested memory updates\nNeeds review — what should change in current memory if this proposal is accepted?\n\n## Review decision\nNeeds review — memory-reviewer decides: accept, reject, or needs more evidence.\n`;
}

// --- Extractors ---

function slugifyPath(p: string): string {
  return toPosixPath(p).replace(/\.md$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "unnamed";
}

function extractScenarios(report: DiscoveryReport): { id: string; slug: string; title: string; topics: string[]; sourceFiles: string[] }[] {
  const scenarios: { id: string; slug: string; title: string; topics: string[]; sourceFiles: string[] }[] = [];
  const seen = new Set<string>();
  for (const file of report.files.filter((f) => f.kind === "doc" || f.kind === "spec")) {
    // headings extracted as topics in discovery; derive scenario from filename
    const baseTitle = file.basename.replace(/\.md$/, "").replace(/[-_]/g, " ");
    const slug = slugifyPath(file.path);
    const id = `scenario-${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (/agent|registry|discovery|routing|gateway|tool/i.test(baseTitle)) {
      scenarios.push({ id, slug, title: baseTitle.charAt(0).toUpperCase() + baseTitle.slice(1), topics: file.topics, sourceFiles: [file.path] });
    }
  }
  return scenarios.slice(0, 10);
}

function extractDecisions(report: DiscoveryReport): { id: string; title: string; rationale: string; sourceFile: string }[] {
  const decisions: { id: string; title: string; rationale: string; sourceFile: string }[] = [];
  const seen = new Set<string>();
  for (const file of report.files.filter((f) => f.kind === "doc")) {
    if (file.topics.some((t) => /rationale|decision|why|alternative|constraint|problem/i.test(t))) {
      const id = slugifyPath(file.path);
      if (seen.has(id)) continue;
      seen.add(id);
      decisions.push({ id, title: file.basename.replace(/\.md$/, ""), rationale: `Inferred rationale signals from ${file.path}: ${file.signals.join(", ")}`, sourceFile: file.path });
    }
  }
  return decisions.slice(0, 5);
}

const RECONCILIATION_CONFLICTS_TEMPLATE = `---
entity_type: conflict
id: reconciliation-conflicts
title: Reconciliation conflicts
status: needs_review
authority: reviewed_memory
evidence_level: unknown
stability: evolving
source_confidence: unknown
last_reviewed: ${today()}
review_required: true
knowledge_types: ["conflict"]
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: false
  requires_code_check_before_change: true
---

# Reconciliation conflicts

Record contradictions between memory, code, tests, and specs here.
`;

const RECONCILIATION_QUESTIONS_TEMPLATE = `---
entity_type: open_question
id: reconciliation-open-questions
title: Open questions
status: needs_review
authority: reviewed_memory
evidence_level: unknown
stability: evolving
source_confidence: unknown
last_reviewed: ${today()}
review_required: true
knowledge_types: ["open_question"]
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: false
  requires_code_check_before_change: true
---

# Open questions

Record unresolved questions here instead of letting the agent invent answers.
`;
