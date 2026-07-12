import path from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import matter from "gray-matter";
import { discoverProject } from "./discoverProject.js";
import { resolveRoot, resolveMemoryRoot, toPosixPath } from "./paths.js";
import { frontmatterYaml, today } from "./utils.js";
import { readDocSections, readDocSummary, findSection, findContent, extractSections, extractFirstParagraph } from "./docExtraction.js";
import { detectSpecRelations } from "./specRelations.js";
import { loadMemoryCards } from "./loadMemory.js";
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
    const status = "needs_review";
    const evidenceLevel = hasCode ? "heuristic_match" : "inferred";

    // Read attached docs for real content — try sections + bold labels
    let docSummary = "";
    let docResponsibilities = "";
    let docOverview = "";
    for (const docPath of mod.docFiles.slice(0, 3)) {
      const raw = await readFile(path.join(root, docPath), "utf8").catch(() => "");
      if (!raw) continue;
      if (!docSummary) docSummary = await readDocSummary(root, docPath);
      const sections = extractSections(raw);
      if (!docResponsibilities) docResponsibilities = findContent(sections, raw, ["responsibilities", "responsibility", "what it does", "functionality", "overview", "description"]) ?? "";
      if (!docOverview) docOverview = findContent(sections, raw, ["overview", "description", "about", "summary"]) ?? "";
    }

    const card = await renderModuleCard(mod, status, evidenceLevel, docSummary, docResponsibilities, docOverview);
    await writeCard(`modules/${mod.id}.md`, card);
  }

  // Scenario cards from spec/doc headings (deterministic extraction)
  const scenarios = extractScenarios(report);
  for (const scenario of scenarios) {
    // Read source file for content
    let scenarioGoal = "";
    let scenarioFlow = "";
    for (const srcPath of scenario.sourceFiles) {
      const sections = await readDocSections(root, srcPath);
      if (!scenarioGoal) scenarioGoal = findSection(sections, ["goal", "overview", "summary", "description", "purpose", "background"]) ?? "";
      if (!scenarioFlow) scenarioFlow = findSection(sections, ["flow", "process", "steps", "how it works", "workflow", "procedure"]) ?? "";
      if (scenarioGoal && scenarioFlow) break;
    }
    await writeCard(`scenarios/${scenario.slug}.md`, renderScenarioCard(scenario, scenarioGoal, scenarioFlow));
  }

  // Decision cards from explicit rationale sections
  const decisions = extractDecisions(report);
  for (const decision of decisions) {
    // Read source doc for decision content — try sections + bold labels
    const raw = await readFile(path.join(root, decision.sourceFile), "utf8").catch(() => "");
    const sections = extractSections(raw);
    const context = findContent(sections, raw, ["context", "background", "motivation", "introduction", "overview", "goal", "цель", "фон", "контекст", "описание"]);
    const problem = findContent(sections, raw, ["problem", "issue", "pain point", "challenge", "motivation", "goal", "проблема", "задача", "цель"]);
    const decisionText = findContent(sections, raw, ["decision", "solution", "approach", "design", "proposed solution", "architecture", "решение", "архитектура", "подход", "дизайн"]);
    const rationale = findContent(sections, raw, ["rationale", "why", "justification", "reasoning", "motivation", "обоснование", "почему", "причины"]);
    const alternatives = findContent(sections, raw, ["alternatives", "options considered", "rejected", "prior approach", "альтернативы", "варианты"]);
    const consequences = findContent(sections, raw, ["consequences", "trade-offs", "tradeoffs", "implications", "risks", "constraints", "ограничения", "последствия", "риски"]);

    await writeCard(`decisions/${decision.id}.md`, renderDecisionCard(decision, context, problem, decisionText, rationale, alternatives, consequences));
  }

  // Historical/proposal cards from spec files
  for (const file of report.files.filter((f) => f.kind === "spec" || f.kind === "legacy")) {
    const isLegacy = file.kind === "legacy" || file.signals.includes("legacy") || file.signals.includes("deprecated") || file.dirname.includes("legacy");
    const slug = slugifyPath(file.path);
    // Read spec content for card body
    const specContent = await readFile(path.join(root, file.path), "utf8").catch(() => "");
    const sections = extractSections(specContent);
    const intro = extractFirstParagraph(specContent);

    // Content-based historical detection — check for deprecated/obsolete/replaced signals
    const contentLower = specContent.toLowerCase();
    const contentHistorical = /status:\s*deprecated|status:\s*obsolete|\bobsolete\b|\blegacy\b|status:\s*replaced/.test(contentLower);
    const finalIsLegacy = isLegacy || contentHistorical;

    const problem = findContent(sections, specContent, ["problem", "motivation", "background", "context", "цель", "проблема", "фон", "контекст"]);
    const requirements = findContent(sections, specContent, ["requirements", "claims", "behavior", "specification", "требования", "поведение", "описание", "архитектура"]);
    const rationale = findContent(sections, specContent, ["rationale", "why", "decision", "alternatives", "обоснование", "решение", "альтернативы"]);
    const status = findContent(sections, specContent, ["status", "state", "статус", "состояние"]);

    if (finalIsLegacy) {
      await writeCard(`historical/${slug}.md`, renderHistoricalCard(file, `historical-${slug}`, intro, problem, rationale, status));
    } else {
      await writeCard(`proposals/${slug}.md`, renderProposalCard(file, `proposal-${slug}`, intro, problem, requirements, rationale));
    }
  }

  // Post-creation: detect supersede relations and reclassify old specs as historical
  if (!options.dryRun) {
    const allCards = await loadMemoryCards({ root, memoryRoot });
    const relations = detectSpecRelations(allCards);

    for (const rel of relations.filter((r) => r.type === "supersedes")) {
      const oldCard = allCards.find((c) => c.meta.id === rel.toId);
      if (!oldCard) continue;
      // Skip if already historical
      if (oldCard.meta.entity_type === "historical" || oldCard.meta.status === "historical") continue;

      // Reclassify: read existing content, rewrite as historical
      const target = path.join(memoryRoot, oldCard.relativePath);
      if (!existsSync(target)) continue;

      const raw = await readFile(target, "utf8");
      const parsed = matter(raw);
      const newMeta = {
        ...parsed.data,
        entity_type: "historical",
        status: "historical",
        authority: "historical_context",
        evidence_level: "spec_only",
        stability: "deprecated",
        review_required: false,
        superseded_by: [rel.fromId],
      };
      const newFm = frontmatterYaml(newMeta as Record<string, unknown>);
      const supersededNote = `\n\n> **Superseded by ${rel.fromId}** — ${rel.reason}\n`;
      const newContent = `---\n${newFm}\n---\n${parsed.content}${supersededNote}\n`;

      // Write to historical/ path, remove old proposal
      const oldRelPath = oldCard.relativePath;
      const historicalSlug = oldRelPath.replace(/^proposals\//, "").replace(/^scenarios\//, "").replace(/^decisions\//, "");
      const historicalPath = path.join(memoryRoot, "historical", historicalSlug);
      await mkdir(path.dirname(historicalPath), { recursive: true });
      await writeFile(historicalPath, newContent, "utf8");

      // Remove old card (proposal/scenario/decision)
      const { unlink } = await import("node:fs/promises");
      await unlink(target).catch(() => {});
      skipped.push(`${oldRelPath} (reclassified as historical: superseded by ${rel.fromId})`);
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

async function renderModuleCard(
  mod: CandidateModule,
  status: string,
  evidenceLevel: string,
  docSummary: string,
  docResponsibilities: string,
  docOverview: string,
): Promise<string> {
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
      can_generate_code_from: status === "current",
      can_use_as_rationale: true,
      requires_code_check_before_change: true,
    },
  });

  // Use real doc content if available, fallback to heuristic description
  const responsibility = docResponsibilities || docOverview || docSummary ||
    `Module with ${mod.codeFiles.length} code files, ${mod.testFiles.length} test files. Topics: ${mod.topics.join(", ")}. Read code_refs and source_refs for details.`;
  const nonResponsibilities = "Needs review — infer from code boundaries, imports, sibling modules.";
  const currentBehavior = docSummary || "Needs review — read code_refs for actual behavior.";

  const body = [
    `# ${mod.title}`,
    "",
    "## Responsibility",
    responsibility,
    "",
    "## Non-responsibilities",
    nonResponsibilities,
    "",
    "## Current behavior",
    currentBehavior,
    "",
    "## Known risks",
    "Needs review — check TODO/FIXME/deprecated in code_refs.",
    "",
    "## Code evidence",
    ...mod.codeFiles.map((p) => `- Code file at ${p}:1`),
    "Preliminary evidence from code_refs — memory-coder must confirm specific symbols.",
    "",
    "## Test evidence",
    ...mod.testFiles.map((p) => `- Test file at ${p}:1`),
    "Preliminary evidence from test_refs — memory-coder must confirm test coverage.",
    "",
    "## Related",
    `- Code files: ${mod.codeFiles.length}`,
    `- Test files: ${mod.testFiles.length}`,
    `- Doc files: ${mod.docFiles.length}`,
    `- Demo files: ${mod.demoFiles.length} (NOT production evidence)`,
    "",
    "## Open questions",
    "Needs review — add questions that cannot be answered from code alone.",
  ].join("\n");
  return `---\n${fm}\n---\n\n${body}\n`;
}

function renderScenarioCard(s: { id: string; title: string; topics: string[]; sourceFiles: string[] }, goalContent: string, flowContent: string): string {
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
  return `---\n${fm}\n---\n\n# ${s.title}\n\n## Goal\n${goalContent || `Inferred from: ${s.topics.join(", ")}. Read source_refs for details.`}\n\n## Actors\nNeeds review — identify actors from code/tests/docs.\n\n## Flow\n${flowContent || "Needs review — read source_refs and code to describe the flow."}\n\n## Constraints\nNeeds review — identify constraints, limits, error conditions.\n\n## Failure cases\nNeeds review — identify known failure scenarios.\n\n## Code evidence\nNot yet verified — memory-coder must confirm flow against code.\n\n## Test evidence\nNot yet verified — memory-coder must confirm test coverage for this scenario.\n\n## Rationale\nNeeds review — why does this scenario exist and not another?\n`;
}

function renderDecisionCard(
  d: { id: string; title: string; rationale: string; sourceFile: string },
  context: string | null,
  problem: string | null,
  decisionText: string | null,
  rationale: string | null,
  alternatives: string | null,
  consequences: string | null,
): string {
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
  return `---\n${fm}\n---\n\n# ${d.title}\n\n## Context\n${context || "Needs review — what problem triggered this decision?"}\n\n## Problem\n${problem || "Needs review — what specific problem was solved?"}\n\n## Decision\n${decisionText || "Needs review — what was decided?"}\n\n## Rationale\n${rationale || d.rationale}\n\n## Alternatives considered\n${alternatives || "Needs review — what alternatives were evaluated?"}\n\n## Rejected alternatives\n${alternatives ? "See alternatives above." : "Needs review — what was rejected and why?"}\n\n## Consequences/trade-offs\n${consequences || "Needs review — what trade-offs were accepted?"}\n\n## Current behavior evidence\nNeeds review — does the decision still hold against current code?\n`;
}

function renderHistoricalCard(
  file: FileRecord,
  id: string,
  intro: string,
  problem: string | null,
  rationale: string | null,
  status: string | null,
): string {
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
  return `---\n${fm}\n---\n\n# ${file.basename} (historical)\n\n## Summary\n${intro || "Legacy spec preserved for rationale context. Not an implementation guide."}\n\n## Status\n${status || "Deprecated/historical."}\n\n## Problems attempted\n${problem || "Needs review — what problem did this approach try to solve?"}\n\n## Prior approach\nLegacy spec preserved for rationale context. Not an implementation guide.\n\n## Rationale still useful\n${rationale || "Needs review — which parts of the rationale remain relevant?"}\n\n## Obsolete/unconfirmed ideas\nNeeds review — what is no longer applicable?\n\n## Decisions that survived\nNeeds review — which decisions from this spec carried forward?\n\n## Links to current decisions\nNeeds review — link to current decision cards that supersede this.\n`;
}

function renderProposalCard(
  file: FileRecord,
  id: string,
  intro: string,
  problem: string | null,
  requirements: string | null,
  rationale: string | null,
): string {
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
  return `---\n${fm}\n---\n\n# ${file.basename} (proposal)\n\n## Source spec\n${file.path}\n\n## Summary\n${intro || "Unconfirmed spec — requires code/test evidence before becoming current behavior."}\n\n## Problem\n${problem || "Needs review — what problem does this proposal solve?"}\n\n## Proposed behavior\n${requirements || "Needs review — extract proposed behavior from the source spec."}\n\n## Rationale from spec\n${rationale || "Needs review — extract rationale from the source spec."}\n\n## Affected modules\nNeeds review — which modules would this proposal change?\n\n## Affected scenarios\nNeeds review — which scenarios would this proposal change?\n\n## Current code check\nNeeds review — memory-coder must check if proposal is already partially implemented.\n\n## Confirmed/not found/conflicting claims\nNeeds review — classify each claim from the spec.\n\n## Suggested memory updates\nNeeds review — what should change in current memory if this proposal is accepted?\n\n## Review decision\nNeeds review — memory-reviewer decides: accept, reject, or needs more evidence.\n`;
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
    // No hardcoded keyword filter — create scenario cards for all doc/spec files
    scenarios.push({ id, slug, title: baseTitle.charAt(0).toUpperCase() + baseTitle.slice(1), topics: file.topics, sourceFiles: [file.path] });
  }
  return scenarios.slice(0, 20);
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
