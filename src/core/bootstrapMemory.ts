import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import yaml from "js-yaml";
import { discoverProject } from "./discoverProject.js";
import { resolveRoot, resolveMemoryRoot, toPosixPath } from "./paths.js";
import type { DiscoveryReport, CandidateModule, FileRecord } from "../schemas/discovery.js";

export type BootstrapResult = {
  written: string[];
  skipped: string[];
  report: DiscoveryReport;
};

export async function bootstrapMemory(options: { root?: string; memoryRoot?: string; force?: boolean; dryRun?: boolean } = {}): Promise<BootstrapResult> {
  const root = resolveRoot(options);
  const memoryRoot = resolveMemoryRoot(options);
  const report = await discoverProject({ root, memoryRoot });
  const written: string[] = [];
  const skipped: string[] = [];

  // Helper: write or skip
  const writeCard = async (relativePath: string, content: string) => {
    const target = path.join(memoryRoot, relativePath);
    const rel = toPosixPath(path.relative(root, target));
    if (existsSync(target) && !options.force) {
      skipped.push(rel);
      return;
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
    const status = hasCode && hasTest ? "current" : "needs_review";
    const evidenceLevel = hasCode && hasTest ? "code_confirmed" : hasCode ? "code_confirmed" : "inferred";
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

function frontmatterYaml(data: Record<string, unknown>): string {
  return yaml.dump(data, { lineWidth: -1 }).trimEnd();
}

function renderModuleCard(mod: CandidateModule, status: string, evidenceLevel: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const fm = frontmatterYaml({
    entity_type: "module",
    id: mod.id,
    title: mod.title,
    status,
    authority: status === "current" ? "source_of_truth" : "reviewed_memory",
    evidence_level: evidenceLevel,
    stability: status === "current" ? "stable" : "evolving",
    source_confidence: mod.confidence === "high" ? "high" : mod.confidence === "medium" ? "medium" : "low",
    last_reviewed: today,
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
    "Needs review — not yet determined.",
    "",
    `## Related`,
    `- Code files: ${mod.codeFiles.length}`,
    `- Test files: ${mod.testFiles.length}`,
    `- Doc files: ${mod.docFiles.length}`,
    `- Demo files: ${mod.demoFiles.length} (NOT production evidence)`,
  ].join("\n");
  return `---\n${fm}\n---\n\n${body}\n`;
}

function renderScenarioCard(s: { id: string; title: string; topics: string[]; sourceFiles: string[] }): string {
  const today = new Date().toISOString().slice(0, 10);
  const fm = frontmatterYaml({
    entity_type: "scenario",
    id: s.id,
    title: s.title,
    status: "needs_review",
    authority: "reviewed_memory",
    evidence_level: "inferred",
    stability: "evolving",
    source_confidence: "low",
    last_reviewed: today,
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
  return `---\n${fm}\n---\n\n# ${s.title}\n\n## Goal\nInferred from: ${s.topics.join(", ")}\n\n## Flow\nNeeds review.\n`;
}

function renderDecisionCard(d: { id: string; title: string; rationale: string; sourceFile: string }): string {
  const today = new Date().toISOString().slice(0, 10);
  const fm = frontmatterYaml({
    entity_type: "decision",
    id: d.id,
    title: d.title,
    status: "current",
    authority: "reviewed_memory",
    evidence_level: "reviewed_doc",
    stability: "stable",
    source_confidence: "medium",
    last_reviewed: today,
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
  return `---\n${fm}\n---\n\n# ${d.title}\n\n## Rationale\n${d.rationale}\n`;
}

function renderHistoricalCard(file: FileRecord, id: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const fm = frontmatterYaml({
    entity_type: "historical",
    id,
    title: file.basename,
    status: "historical",
    authority: "historical_context",
    evidence_level: "spec_only",
    stability: "deprecated",
    source_confidence: "low",
    last_reviewed: today,
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
  return `---\n${fm}\n---\n\n# ${file.basename} (historical)\n\n## Prior approach\nLegacy spec preserved for rationale context. Not an implementation guide.\n`;
}

function renderProposalCard(file: FileRecord, id: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const fm = frontmatterYaml({
    entity_type: "proposal",
    id,
    title: file.basename,
    status: "proposed",
    authority: "proposed",
    evidence_level: "spec_only",
    stability: "experimental",
    source_confidence: "low",
    last_reviewed: today,
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
  return `---\n${fm}\n---\n\n# ${file.basename} (proposal)\n\n## Proposed behavior\nUnconfirmed spec — requires code/test evidence before becoming current behavior.\n`;
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
    if (file.signals.some((s) => /rationale|decision|why|alternative|constraint/i.test(s))) {
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
last_reviewed: ${new Date().toISOString().slice(0, 10)}
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
last_reviewed: ${new Date().toISOString().slice(0, 10)}
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
