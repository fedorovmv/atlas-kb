import path from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import matter from "gray-matter";
import { discoverProject } from "./discoverProject.js";
import { resolveRoot, resolveMemoryRoot, toPosixPath } from "./paths.js";
import { frontmatterYaml, today } from "./utils.js";
import { readDocSections, readDocSummary, findSection, findContent, extractSections, extractFirstParagraph, isBoilerplate } from "./docExtraction.js";
import { detectSpecRelations } from "./specRelations.js";
import { loadMemoryCards } from "./loadMemory.js";
import { classifyRuntimeTier } from "./runtimeTier.js";
import { createInitialCoverage, triageCoverage, triageSources } from "./sourceCoverage.js";
import type { DiscoveryReport, CandidateModule, FileRecord } from "../schemas/discovery.js";
import type { MemoryFrontmatter } from "../schemas/frontmatter.js";
import type { MemoryCard } from "./types.js";

export type BootstrapResult = {
  written: string[];
  skipped: string[];
  report: DiscoveryReport;
  topLevelCreated: string[];
  subdirsCreated: string[];
  coverageCreated?: string;      // NEW: path to source-coverage.json
  triageUpdated?: number;        // NEW: how many unknown -> concrete
  triageStillUnknown?: number;   // NEW: how many still unknown
  contentMapPath?: string;       // NEW: path to source-content-map.jsonl
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
  const topLevelCreated: string[] = [];
  const subdirsCreated: string[] = [];

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

  // --- Create top-level index cards if they don't exist ---
  const todayStr = today();

  const createIndexCard = async (fileName: string, template: string) => {
    const target = path.join(memoryRoot, fileName);
    if (existsSync(target)) {
      const skipReason = await shouldSkipExisting(target, options.force ?? false);
      if (skipReason) {
        skipped.push(`${fileName} (${skipReason})`);
        return;
      }
    }
    const content = template.replace("PLACEHOLDER_DATE", todayStr);
    if (!options.dryRun) {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
    }
    written.push(toPosixPath(path.relative(root, target)));
    topLevelCreated.push(fileName);
  };

  await createIndexCard("MEMORY.md", MEMORY_INDEX_TEMPLATE);
  await createIndexCard("MODULES.md", MODULES_INDEX_TEMPLATE);
  await createIndexCard("DECISIONS.md", DECISIONS_INDEX_TEMPLATE);
  await createIndexCard("ARCHITECTURE.md", ARCHITECTURE_INDEX_TEMPLATE);

  // --- Create subdirectories with .gitkeep if they don't exist ---
  const createSubdir = async (subdirName: string) => {
    const gitkeepPath = path.join(memoryRoot, subdirName, ".gitkeep");
    const dirPath = path.join(memoryRoot, subdirName);
    if (!existsSync(dirPath) || !existsSync(gitkeepPath)) {
      if (!options.dryRun) {
        await mkdir(dirPath, { recursive: true });
        await writeFile(gitkeepPath, "", "utf8");
      }
      const relDir = toPosixPath(path.relative(root, dirPath));
      subdirsCreated.push(relDir);
      written.push(toPosixPath(path.relative(root, gitkeepPath)));
    }
  };

  await createSubdir("flows");
  await createSubdir("architecture");

  // Module cards from candidate modules (confidence >= medium)
  for (const mod of report.candidateModules) {
    if (mod.confidence === "low" && mod.codeFiles.length === 0) continue;
    const hasCode = mod.codeFiles.length > 0;
    const status = "needs_review";
    const evidenceLevel = hasCode ? "heuristic_match" : "inferred";

    // Read attached docs for real content — try sections + bold labels
    // Prefer docs that share a path prefix with the module's code files
    const codePaths = mod.codeFiles.map((f) => f.toLowerCase());
    const sortedDocFiles = [...mod.docFiles].sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aScore = codePaths.reduce((max, cp) => {
        // Score by shared path segments
        const aSegs = aLower.split("/");
        const cSegs = cp.split("/");
        let shared = 0;
        for (let i = 0; i < Math.min(aSegs.length, cSegs.length); i++) {
          if (aSegs[i] === cSegs[i]) shared++;
          else break;
        }
        return Math.max(max, shared);
      }, 0);
      const bScore = codePaths.reduce((max, cp) => {
        const bSegs = bLower.split("/");
        const cSegs = cp.split("/");
        let shared = 0;
        for (let i = 0; i < Math.min(bSegs.length, cSegs.length); i++) {
          if (bSegs[i] === cSegs[i]) shared++;
          else break;
        }
        return Math.max(max, shared);
      }, 0);
      return bScore - aScore; // higher score = more path overlap = sort first
    });
    let docSummary = "";
    let docResponsibilities = "";
    let docOverview = "";
    for (const docPath of sortedDocFiles.slice(0, 3)) {
      const raw = await readFile(path.join(root, docPath), "utf8").catch(() => "");
      if (!raw) continue;
      if (!docSummary) docSummary = await readDocSummary(root, docPath);
      const sections = extractSections(raw);
      if (!docResponsibilities) docResponsibilities = findContent(sections, raw, ["responsibilities", "responsibility", "what it does", "functionality", "overview", "description", "ответственность", "назначение", "функции", "возможности", "описание"]) ?? "";
      if (!docOverview) docOverview = findContent(sections, raw, ["overview", "description", "about", "summary", "обзор", "описание", "о модуле", "сводка"]) ?? "";
    }

    const card = await renderModuleCard(mod, status, evidenceLevel, docSummary, docResponsibilities, docOverview, report.files);
    await writeCard(`modules/${mod.id}.md`, card);
  }

  // Scenario cards from spec/doc headings (deterministic extraction)
  const scenarios = extractScenarios(report);
  for (const scenario of scenarios) {
    // Read source file for content
    let scenarioGoal = "";
    let scenarioFlow = "";
    let scenarioActors = "";
    let scenarioConstraints = "";
    let scenarioErrors = "";
    let scenarioRationale = "";
    for (const srcPath of scenario.sourceFiles) {
      const sections = await readDocSections(root, srcPath);
      if (!scenarioGoal) scenarioGoal = findSection(sections, ["goal", "overview", "summary", "description", "purpose", "background", "цель", "задача", "описание", "назначение", "контекст"]) ?? "";
      if (!scenarioFlow) scenarioFlow = findSection(sections, ["flow", "process", "steps", "how it works", "workflow", "procedure", "поток", "процесс", "шаги", "сценарий", "алгоритм"]) ?? "";
      if (!scenarioActors) scenarioActors = findSection(sections, ["actors", "participants", "components involved", "участники", "компоненты", "стороны"]) ?? "";
      if (!scenarioConstraints) scenarioConstraints = findSection(sections, ["constraints", "limitations", "restrictions", "ограничения", "лимиты", "условия"]) ?? "";
      if (!scenarioErrors) scenarioErrors = findSection(sections, ["error cases", "errors", "failure", "fallback", "сценарии ошибок", "ошибки", "отказ", "fallback"]) ?? "";
      if (!scenarioRationale) scenarioRationale = findSection(sections, ["rationale", "why", "motivation", "обоснование", "почему", "причины"]) ?? "";
      if (scenarioGoal && scenarioFlow) break;
    }
    await writeCard(`scenarios/${scenario.slug}.md`, renderScenarioCard(scenario, scenarioGoal, scenarioFlow, scenarioActors, scenarioConstraints, scenarioErrors, scenarioRationale));
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
    const alternatives = findContent(sections, raw, ["alternatives", "options considered", "rejected", "prior approach", "альтернативы", "варианты", "отклонённые", "отвергнутые"]);
    const consequences = findContent(sections, raw, ["consequences", "trade-offs", "tradeoffs", "implications", "последствия", "компромиссы"]);
    const rejectedAlt = findContent(sections, raw, ["rejected", "declined", "dismissed", "отклонённые", "отвергнутые", "отклонено"]);
    const affectedModules = findContent(sections, raw, ["affected modules", "affected components", "changed modules", "затронутые модули", "изменяемые модули", "компоненты"]);
    const affectedScenarios = findContent(sections, raw, ["affected scenarios", "affected flows", "changed scenarios", "затронутые сценарии", "изменяемые сценарии", "потоки"]);

    await writeCard(`decisions/${decision.id}.md`, renderDecisionCard(decision, context, problem, decisionText, rationale, alternatives, consequences, rejectedAlt, affectedModules, affectedScenarios));
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
    const affectedModules = findContent(sections, specContent, ["affected modules", "affected components", "changed modules", "затронутые модули", "изменяемые модули", "компоненты"]);
    const affectedScenarios = findContent(sections, specContent, ["affected scenarios", "affected flows", "changed scenarios", "затронутые сценарии", "изменяемые сценарии", "потоки"]);
    const currentCodeCheck = findContent(sections, specContent, ["current code", "current implementation", "existing code", "текущий код", "существующий код", "текущая реализация"]);
    const claims = findContent(sections, specContent, ["claims", "assertions", "requirements", "утверждения", "требования"]);

    if (finalIsLegacy) {
      const priorApproach = findContent(sections, specContent, ["prior approach", "previous solution", "old approach", "предыдущий подход", "старое решение", "было раньше"]);
      const obsoleteIdeas = findContent(sections, specContent, ["obsolete", "deprecated", "outdated", "no longer", "устаревшие", "неприменимо", "больше не"]);
      const survivedDecisions = findContent(sections, specContent, ["survived", "carried forward", "kept", "выжившие", "перенесены", "сохранены"]);
      await writeCard(`historical/${slug}.md`, renderHistoricalCard(file, `historical-${slug}`, intro, problem, rationale, status, priorApproach, obsoleteIdeas, survivedDecisions));
    } else {
      await writeCard(`proposals/${slug}.md`, renderProposalCard(file, `proposal-${slug}`, intro, problem, requirements, rationale, affectedModules, affectedScenarios, currentCodeCheck, claims));
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

  // Create source-coverage.json from triage
  const triage = await triageSources({ root, buildDir: path.join(memoryRoot, "..", "memory-build", "latest"), dryRun: options.dryRun });
  const coverageFile = "source-coverage.json";
  if (!options.dryRun) {
    // Already written by triageSources
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

  return { written, skipped, report, topLevelCreated, subdirsCreated, coverageCreated: coverageFile, triageUpdated: triage.updated, triageStillUnknown: triage.stillUnknown, contentMapPath: triage.contentMapPath };
}

// --- Card renderers ---

async function renderModuleCard(
  mod: CandidateModule,
  status: string,
  evidenceLevel: string,
  docSummary: string,
  docResponsibilities: string,
  docOverview: string,
  discoveryFiles: FileRecord[],
): Promise<string> {
  const todayStr = today();

  // Classify runtime tier from code refs and discovery data
  const allRefPaths = [...mod.codeFiles, ...mod.testFiles, ...mod.demoFiles];
  const tierCard: MemoryCard = {
    path: mod.id,
    relativePath: mod.id,
    meta: {
      entity_type: "module",
      id: mod.id,
      title: mod.title,
      status: status as unknown as MemoryFrontmatter["status"],
      authority: "reviewed_memory",
      evidence_level: evidenceLevel as unknown as MemoryFrontmatter["evidence_level"],
      stability: "stable",
      source_confidence: "high",
      last_reviewed: "2026-01-01",
      review_required: false,
      knowledge_types: ["current_behavior"] as MemoryFrontmatter["knowledge_types"],
      usage_policy: {
        can_answer_current_behavior: true,
        can_generate_code_from: true,
        can_use_as_rationale: true,
        requires_code_check_before_change: true,
      },
      code_refs: allRefPaths.map((p) => ({ path: p })),
    } as MemoryFrontmatter,
    body: "",
    raw: "",
  };
  const tier = classifyRuntimeTier(tierCard, discoveryFiles);

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
    runtime_tier: tier,
  });
  // Filter boilerplate — if doc content looks like a template, use fallback instead
  const cleanResponsibilities = docResponsibilities && !isBoilerplate(docResponsibilities) ? docResponsibilities : "";
  const cleanOverview = docOverview && !isBoilerplate(docOverview) ? docOverview : "";
  const cleanSummary = docSummary && !isBoilerplate(docSummary) ? docSummary : "";

  const responsibility = cleanResponsibilities || cleanOverview || cleanSummary ||
    `Модуль с ${mod.codeFiles.length} файлами кода, ${mod.testFiles.length} тестовыми файлами. Темы: ${mod.topics.join(", ")}. См. code_refs и source_refs.`;
  const nonResponsibilities = "Требует ревью — определите по границам кода, импортам, соседним модулям.";
  const currentBehavior = cleanSummary || "Требует ревью — прочитайте code_refs для описания поведения.";

  const body = [
    `# ${mod.title}`,
    "",
    "## Ответственность",
    responsibility,
    "",
    "## Не входит в ответственность",
    nonResponsibilities,
    "",
    "## Текущее поведение",
    currentBehavior,
    "",
    "## Известные риски",
    "Требует ревью — проверьте TODO/FIXME/deprecated в code_refs.",
    "",
    "## Свидетельства из кода",
    ...mod.codeFiles.map((p) => `- Code file at ${p}:1`),
    "Предварительные свидетельства из code_refs — memory-coder должен подтвердить конкретные символы.",
    "",
    "## Свидетельства из тестов",
    ...mod.testFiles.map((p) => `- Test file at ${p}:1`),
    "Предварительные свидетельства из test_refs — memory-coder должен подтвердить покрытие тестами.",
    "",
    "## Связанные файлы",
    `- Файлов кода: ${mod.codeFiles.length}`,
    `- Тестовых файлов: ${mod.testFiles.length}`,
    `- Файлов документации: ${mod.docFiles.length}`,
    `- Demo-файлов: ${mod.demoFiles.length} (НЕ production-свидетельства)`,
    "",
    "## Открытые вопросы",
    "Требует ревью — добавьте вопросы, на которые нельзя ответить только из кода.",
  ].join("\n");
  return `---\n${fm}\n---\n\n${body}\n`;
}

function renderScenarioCard(s: { id: string; title: string; topics: string[]; sourceFiles: string[] }, goalContent: string, flowContent: string, actorsContent: string, constraintsContent: string, errorsContent: string, rationaleContent: string): string {
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
  return `---\n${fm}\n---\n\n# ${s.title}\n\n## Цель\n${goalContent || "Требует ревью — прочитайте source_refs для описания цели."}\n\n## Участники\n${actorsContent || "Требует ревью — определите участников из кода/тестов/документации."}\n\n## Поток выполнения\n${flowContent || "Требует ревью — прочитайте source_refs и код для описания потока."}\n\n## Ограничения\n${constraintsContent || "Требует ревью — определите ограничения, лимиты, условия ошибок."}\n\n## Сценарии ошибок\n${errorsContent || "Требует ревью — определите известные сценарии ошибок."}\n\n## Связанные модули\nНе выявлены — определите модули, участвующие в сценарии.\n\n## Связанные тесты\nНе выявлены — определите тесты, покрывающие сценарий.\n\n## Свидетельства из кода\nНе проверено — memory-coder должен подтвердить поток по коду.\n\n## Свидетельства из тестов\nНе проверено — memory-coder должен подтвердить покрытие тестами для этого сценария.\n\n## Обоснование\n${rationaleContent || "Требует ревью — почему существует этот сценарий, а не другой?"}\n`;
}

function renderDecisionCard(
  d: { id: string; title: string; rationale: string; sourceFile: string },
  context: string | null,
  problem: string | null,
  decisionText: string | null,
  rationale: string | null,
  alternatives: string | null,
  consequences: string | null,
  rejectedAlt: string | null,
  affectedModules: string | null,
  affectedScenarios: string | null,
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
  return `---\n${fm}\n---\n\n# ${d.title}\n\n## Контекст\n${context || "Требует ревью — какая проблема привела к этому решению?"}\n\n## Проблема\n${problem || "Требует ревью — какая конкретная проблема решена?"}\n\n## Решение\n${decisionText || "Требует ревью — что было решено?"}\n\n## Обоснование\n${rationale || d.rationale}\n\n## Рассмотренные альтернативы\n${alternatives || "Требует ревью — какие альтернативы были рассмотрены?"}\n\n## Отклонённые альтернативы\n${rejectedAlt || (alternatives ? "См. альтернативы выше." : "Требует ревью — что было отклонено и почему?")}\n\n## Последствия\n${consequences || "Требует ревью — какие компромиссы были приняты?"}\n\n## Свидетельства текущего поведения\nТребует ревью — действительно ли решение актуально для текущего кода?\n\n## Затронутые модули\n${affectedModules || "Требует ревью — какие модули затронуты этим решением?"}\n\n## Затронутые сценарии\n${affectedScenarios || "Требует ревью — какие сценарии затронуты этим решением?"}\n`;
}

function renderHistoricalCard(
  file: FileRecord,
  id: string,
  intro: string,
  problem: string | null,
  rationale: string | null,
  status: string | null,
  priorApproach: string | null,
  obsoleteIdeas: string | null,
  survivedDecisions: string | null,
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
  return `---\n${fm}\n---\n\n# ${file.basename} (historical)\n\n## Какая проблема решалась\n${problem || "Требует ревью — какую проблему пытался решить этот подход?"}\n\n## Актуальное обоснование\n${rationale || "Требует ревью — какие части обоснования остаются актуальными?"}\n\n## Устаревшие идеи\n${obsoleteIdeas || "Требует ревью — что больше не применимо?"}\n\n## Выжившие решения\n${survivedDecisions || "Требует ревью — какие решения из этой спецификации перенесены?"}\n\n## Ссылки на текущие решения\nТребует ревью — ссылки на текущие карточки решений, заменяющие эту.\n`;
}

function renderProposalCard(
  file: FileRecord,
  id: string,
  intro: string,
  problem: string | null,
  requirements: string | null,
  rationale: string | null,
  affectedModules: string | null,
  affectedScenarios: string | null,
  currentCodeCheck: string | null,
  claims: string | null,
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
  return `---\n${fm}\n---\n\n# ${file.basename} (proposal)\n\n## Исходная спецификация\n${file.path}\n\n## Предлагаемое поведение\n${requirements || "Требует ревью — извлеките предлагаемое поведение из исходной спецификации."}\n\n## Обоснование из спецификации\n${rationale || "Требует ревью — извлеките обоснование из исходной спецификации."}\n\n## Затронутые модули\n${affectedModules || "Требует ревью — какие модули изменит это предложение?"}\n\n## Затронутые сценарии\n${affectedScenarios || "Требует ревью — какие сценарии изменит это предложение?"}\n\n## Затронутые решения\nТребует ревью — какие решения затронет это предложение?\n\n## Проверка текущего кода\n${currentCodeCheck || "Требует ревью — memory-coder должен проверить, частично ли предложение уже реализовано."}\n\n## Утверждения\n${claims || "Требует ревью — классифицируйте каждое утверждение из спецификации."}\n\n## Решение по ревью\nТребует ревью — memory-reviewer решает: принять, отклонить или нужно больше свидетельств.\n`;
}

// --- Extractors ---

function slugifyPath(p: string): string {
  // Use basename only, not full path — avoids long slugs like
  // "docs-superpowers-specs-2026-06-23-ai-agent-search-reliability-design".
  const basename = path.basename(p).replace(/\.md$/, "");
  return basename
    // Strip leading date patterns: 2026-06-23-, 2026-06-23_
    .replace(/^\d{4}-\d{2}-\d{2}[-_]/, "")
    // Strip redundant trailing -design, -spec, -specification
    .replace(/[-_](design|spec|specification)$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "unnamed";
}

function extractScenarios(report: DiscoveryReport): { id: string; slug: string; title: string; topics: string[]; sourceFiles: string[] }[] {
  const scenarios: { id: string; slug: string; title: string; topics: string[]; sourceFiles: string[] }[] = [];
  const seen = new Set<string>();
  // Only doc files (runtime documentation), NOT spec files — specs become proposals/historical cards.
  // Mixing specs into scenarios creates duplicate cards for the same content.
  for (const file of report.files.filter((f) => f.kind === "doc")) {
    const baseTitle = file.basename.replace(/\.md$/, "").replace(/[-_]/g, " ");
    const slug = slugifyPath(file.path);
    const id = `scenario-${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);
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
title: Конфликты согласования
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

# Конфликты согласования

Записывайте здесь противоречия между памятью, кодом, тестами и спецификациями.
`;

const RECONCILIATION_QUESTIONS_TEMPLATE = `---
entity_type: open_question
id: reconciliation-open-questions
title: Открытые вопросы
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

# Открытые вопросы

Записывайте здесь неразрешённые вопросы вместо того, чтобы позволить агенту придумывать ответы.
`;

// --- Index card templates ---

const MEMORY_INDEX_TEMPLATE = `---
entity_type: index
id: memory-index
title: Индекс Memory Bank
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: high
last_reviewed: "PLACEHOLDER_DATE"
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: false
  requires_warning: false
---

# Индекс Memory Bank

## Обзор
<!-- LLM: краткое описание продукта -->

## Индекс модулей
<!-- LLM: список модулей со ссылками на modules/*.md -->

## Индекс архитектуры
<!-- LLM: ссылки на architecture/*.md -->

## Индекс потоков
<!-- LLM: ссылки на flows/*.md -->

## Индекс решений
<!-- LLM: ссылки на decisions/*.md -->
`;

const MODULES_INDEX_TEMPLATE = `---
entity_type: index
id: modules-index
title: Индекс модулей
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: high
last_reviewed: "PLACEHOLDER_DATE"
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: false
  requires_warning: false
---

# Индекс модулей

## Production-модули
<!-- LLM: runtime_tier=production модули со ссылками на modules/*.md -->

## Demo-модули
<!-- LLM: runtime_tier=demo модули со ссылками на modules/*.md -->

## Общие модули
<!-- LLM: runtime_tier=shared модули со ссылками на modules/*.md -->

## Исторические модули
<!-- LLM: runtime_tier=historical модули (архивные) -->
`;

const DECISIONS_INDEX_TEMPLATE = `---
entity_type: index
id: decisions-index
title: Индекс решений
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: high
last_reviewed: "PLACEHOLDER_DATE"
review_required: false
knowledge_types:
  - design_rationale
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: false
  requires_warning: false
---

# Индекс решений

## Активные решения
<!-- LLM: ссылки на decisions/*.md — текущие архитектурные решения -->

## Заменённые решения
<!-- LLM: ссылки на decisions/*.md или historical/*.md — перезапсенные решения -->
`;

const ARCHITECTURE_INDEX_TEMPLATE = `---
entity_type: architecture
id: architecture-index
title: Индекс архитектуры
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: high
last_reviewed: "PLACEHOLDER_DATE"
review_required: false
knowledge_types:
  - design_rationale
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: false
  requires_warning: false
---

# Индекс архитектуры

<!-- LLM: общая картина архитектуры проекта -->

## Обзор архитектуры
<!-- LLM: ссылки на architecture/*.md — архитектурные карточки по подмодулям -->

## Взаимодействие систем
<!-- LLM: описание взаимодействия между подсистемами -->
`;
