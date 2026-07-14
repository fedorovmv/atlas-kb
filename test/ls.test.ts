import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { initMemory } from "../src/commands/init.js";
import { listMemory } from "../src/commands/ls.js";

// Helper to capture console.log output
function captureConsoleLog(): { logs: string[]; restore: () => void } {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
  };
  return {
    logs,
    restore: () => { console.log = orig; },
  };
}

function proposalFrontmatter(overrides: Record<string, unknown> = {}) {
  return {
    entity_type: "proposal",
    id: "test-proposal",
    title: "Test Proposal",
    status: "proposed",
    authority: "proposed",
    evidence_level: "spec_only",
    stability: "experimental",
    source_confidence: "low",
    last_reviewed: "2026-07-10",
    review_required: false,
    knowledge_types: ["proposed_behavior"],
    usage_policy: {
      can_answer_current_behavior: false,
      can_generate_code_from: false,
      can_use_as_rationale: true,
      requires_code_check_before_change: true,
    },
    ...overrides,
  };
}

function decisionFrontmatter(overrides: Record<string, unknown> = {}) {
  return {
    entity_type: "decision",
    id: "test-decision",
    title: "Test Decision",
    status: "current",
    authority: "reviewed_memory",
    evidence_level: "reviewed_doc",
    stability: "stable",
    source_confidence: "high",
    last_reviewed: "2026-07-10",
    review_required: false,
    knowledge_types: ["design_rationale"],
    usage_policy: {
      can_answer_current_behavior: false,
      can_generate_code_from: false,
      can_use_as_rationale: true,
      requires_code_check_before_change: true,
    },
    ...overrides,
  };
}

function architectureFrontmatter(overrides: Record<string, unknown> = {}) {
  return {
    entity_type: "architecture",
    id: "test-architecture",
    title: "Test Architecture",
    status: "current",
    authority: "reviewed_memory",
    evidence_level: "reviewed_doc",
    stability: "stable",
    source_confidence: "high",
    last_reviewed: "2026-07-10",
    review_required: false,
    knowledge_types: ["current_behavior"],
    usage_policy: {
      can_answer_current_behavior: true,
      can_generate_code_from: false,
      can_use_as_rationale: true,
      requires_code_check_before_change: true,
    },
    ...overrides,
  };
}

function moduleFrontmatter(overrides: Record<string, unknown> = {}) {
  return {
    entity_type: "module",
    id: "test-module",
    title: "Test Module",
    status: "current",
    authority: "reviewed_memory",
    evidence_level: "code_confirmed",
    stability: "stable",
    source_confidence: "high",
    last_reviewed: "2026-07-10",
    review_required: false,
    knowledge_types: ["current_behavior"],
    usage_policy: {
      can_answer_current_behavior: true,
      can_generate_code_from: true,
      can_use_as_rationale: true,
      requires_code_check_before_change: true,
    },
    ...overrides,
  };
}

function toFrontmatter(fm: Record<string, unknown>): string {
  return `---\n${Object.entries(fm).map(([k, v]) => {
    if (typeof v === "object" && v !== null) {
      if (Array.isArray(v)) return `${k}:\n${v.map((item) => `  - ${item}`).join("\n")}`;
      return `${k}:\n${Object.entries(v).map(([sk, sv]) => `  ${sk}: ${sv}`).join("\n")}`;
    }
    return `${k}: ${v}`;
  }).join("\n")}\n---`;
}

// All required sections for proposal (from cardSections.ts)
const PROPOSAL_ALL_SECTIONS = `## Исходная спецификация
content
## Предлагаемое поведение
content
## Обоснование из спецификации
content
## Затронутые модули
content
## Затронутые сценарии
content
## Затронутые решения
content
## Проверка текущего кода
content
## Утверждения
content
## Решение по ревью
content`;

// All required sections for decision
const DECISION_ALL_SECTIONS = `## Контекст
content
## Проблема
content
## Решение
content
## Обоснование
content
## Рассмотренные альтернативы
content
## Отклонённые альтернативы
content
## Последствия
content
## Свидетельства текущего поведения
content
## Затронутые модули
content
## Затронутые сценарии
content`;

// All required sections for architecture
const ARCHITECTURE_ALL_SECTIONS = `## Обзор архитектуры
content`;

// All required sections for module
const MODULE_ALL_SECTIONS = `## Ответственность
content
## Не входит в ответственность
content
## Текущее поведение
content
## Связанные сценарии
content
## Связанные решения
content
## Свидетельства из кода
content
## Свидетельства из тестов
content
## Известные риски
content
## Открытые вопросы
content
## Почему такие границы
content`;

function writeCard(root: string, subdir: string, filename: string, fm: Record<string, unknown>, body: string) {
  const dir = path.join(root, ".ai/memory", subdir);
  return writeFile(path.join(dir, filename), `${toFrontmatter(fm)}\n\n# ${fm.title}\n\n${body}`, "utf8");
}

describe("listMemory --needs-enrichment (Phase 1 + Phase 6)", () => {
  let root: string;

  async function setup() {
    root = await initTempProject();
  }

  async function teardown() {
    await rm(root, { recursive: true, force: true });
  }

  // Helper: run listMemory with needsEnrichment + json, return parsed card IDs
  async function getNeedsEnrichmentIds(): Promise<string[]> {
    const cap = captureConsoleLog();
    try {
      await listMemory({ needsEnrichment: true, json: true, root });
    } finally {
      cap.restore();
    }
    const jsonStr = cap.logs.filter((l) => l.trim().startsWith("[")).join("");
    if (!jsonStr) return [];
    const cards = JSON.parse(jsonStr) as Array<{ id: string }>;
    return cards.map((c) => c.id);
  }

  beforeEach(setup);
  afterEach(teardown);

  it("1. proposal spec_only + complete sections → excluded from --needs-enrichment", async () => {
    await mkdir(path.join(root, ".ai/memory/proposals"), { recursive: true });
    await writeCard(root, "proposals", "complete.md", proposalFrontmatter({ id: "prop-complete" }), PROPOSAL_ALL_SECTIONS);
    const ids = await getNeedsEnrichmentIds();
    expect(ids).not.toContain("prop-complete");
  });

  it("2. proposal spec_only + missing section → included (needs enrichment)", async () => {
    // Missing "## Обоснование из спецификации" — only provide 8 of 9 sections
    const missingSection = PROPOSAL_ALL_SECTIONS.replace("## Обоснование из спецификации\ncontent\n", "");
    await mkdir(path.join(root, ".ai/memory/proposals"), { recursive: true });
    await writeCard(root, "proposals", "missing-section.md", proposalFrontmatter({ id: "prop-missing" }), missingSection);
    const ids = await getNeedsEnrichmentIds();
    expect(ids).toContain("prop-missing");
  });

  it("3. proposal spec_only + placeholder content → included", async () => {
    const body = `${PROPOSAL_ALL_SECTIONS}\n\nТребует ревью`;
    await mkdir(path.join(root, ".ai/memory/proposals"), { recursive: true });
    await writeCard(root, "proposals", "placeholder.md", proposalFrontmatter({ id: "prop-placeholder" }), body);
    const ids = await getNeedsEnrichmentIds();
    expect(ids).toContain("prop-placeholder");
  });

  it("4. decision reviewed_doc + complete sections → excluded", async () => {
    await mkdir(path.join(root, ".ai/memory/decisions"), { recursive: true });
    await writeCard(root, "decisions", "complete.md", decisionFrontmatter({ id: "dec-complete" }), DECISION_ALL_SECTIONS);
    const ids = await getNeedsEnrichmentIds();
    expect(ids).not.toContain("dec-complete");
  });

  it("5. decision reviewed_doc + missing section → included", async () => {
    const missingSection = DECISION_ALL_SECTIONS.replace("## Обоснование\ncontent\n", "");
    await mkdir(path.join(root, ".ai/memory/decisions"), { recursive: true });
    await writeCard(root, "decisions", "missing.md", decisionFrontmatter({ id: "dec-missing" }), missingSection);
    const ids = await getNeedsEnrichmentIds();
    expect(ids).toContain("dec-missing");
  });

  it("6. architecture reviewed_doc + complete sections → excluded (Phase 1 P1-3)", async () => {
    await mkdir(path.join(root, ".ai/memory/architecture"), { recursive: true });
    await writeCard(root, "architecture", "complete.md", architectureFrontmatter({ id: "arch-complete" }), ARCHITECTURE_ALL_SECTIONS);
    const ids = await getNeedsEnrichmentIds();
    expect(ids).not.toContain("arch-complete");
  });

  it("7. architecture inferred + complete sections → INCLUDED (not terminal)", async () => {
    await mkdir(path.join(root, ".ai/memory/architecture"), { recursive: true });
    await writeCard(root, "architecture", "inferred.md", architectureFrontmatter({ id: "arch-inferred", evidence_level: "inferred" }), ARCHITECTURE_ALL_SECTIONS);
    const ids = await getNeedsEnrichmentIds();
    expect(ids).toContain("arch-inferred");
  });

  it("8. module code_confirmed + placeholder content → included", async () => {
    const body = `${MODULE_ALL_SECTIONS}\n\nТребует ревью`;
    await mkdir(path.join(root, ".ai/memory/modules"), { recursive: true });
    await writeCard(root, "modules", "placeholder.md", moduleFrontmatter({ id: "mod-placeholder" }), body);
    const ids = await getNeedsEnrichmentIds();
    expect(ids).toContain("mod-placeholder");
  });

  it("9. heading case mismatch: lowercase heading → NOT flagged as missing (case-insensitive match)", async () => {
    // Card has "## обоснование из спецификации" (lowercase) — should match "## Обоснование из спецификации"
    const lowercaseSection = PROPOSAL_ALL_SECTIONS.replace("## Обоснование из спецификации", "## обоснование из спецификации");
    await mkdir(path.join(root, ".ai/memory/proposals"), { recursive: true });
    await writeCard(root, "proposals", "lowercase-heading.md", proposalFrontmatter({ id: "prop-lc" }), lowercaseSection);
    const ids = await getNeedsEnrichmentIds();
    expect(ids).not.toContain("prop-lc");
  });

  // ========== Phase 3: split enrichment flags ==========

  // Helper: run listMemory with a specific flag + json, return parsed card IDs
  async function getNeedsEnrichmentIdsByFlag(flag: {
    needsEnrichment?: boolean;
    needsEnrichmentContent?: boolean;
    needsEnrichmentLinks?: boolean;
    needsEnrichmentReview?: boolean;
  }): Promise<string[]> {
    const cap = captureConsoleLog();
    try {
      await listMemory({ ...flag, json: true, root });
    } finally {
      cap.restore();
    }
    const jsonStr = cap.logs.filter((l) => l.trim().startsWith("[")).join("");
    if (!jsonStr) return [];
    const cards = JSON.parse(jsonStr) as Array<{ id: string; cross_link_attempts?: number; has_broken_relations?: boolean }>;
    return cards.map((c) => c.id);
  }

  it("10. --needs-enrichment-content returns card with weak evidence, NOT card with only empty cross-links", async () => {
    // Card A: weak evidence (inferred) — should be included
    await mkdir(path.join(root, ".ai/memory/modules"), { recursive: true });
    await writeCard(root, "modules", "weak-evidence.md", moduleFrontmatter({ id: "mod-weak", evidence_level: "inferred", related_scenarios: ["s1"] }), MODULE_ALL_SECTIONS);
    // Card B: strong evidence but empty cross-links — should NOT be included by --content
    await writeCard(root, "modules", "no-links.md", moduleFrontmatter({ id: "mod-nolinks" }), MODULE_ALL_SECTIONS);
    const ids = await getNeedsEnrichmentIdsByFlag({ needsEnrichmentContent: true });
    expect(ids).toContain("mod-weak");
    expect(ids).not.toContain("mod-nolinks");
  });

  it("11. --needs-enrichment-links returns card with empty cross-links, NOT card with only weak evidence", async () => {
    // Card A: strong evidence but empty cross-links — should be included
    await mkdir(path.join(root, ".ai/memory/modules"), { recursive: true });
    await writeCard(root, "modules", "no-links.md", moduleFrontmatter({ id: "mod-nolinks" }), MODULE_ALL_SECTIONS);
    // Card B: weak evidence but has cross-links — should NOT be included by --links
    await writeCard(root, "modules", "weak-evidence.md", moduleFrontmatter({ id: "mod-weak", evidence_level: "inferred", related_scenarios: ["s1"] }), MODULE_ALL_SECTIONS);
    const ids = await getNeedsEnrichmentIdsByFlag({ needsEnrichmentLinks: true });
    expect(ids).toContain("mod-nolinks");
    expect(ids).not.toContain("mod-weak");
  });

  it("12. --needs-enrichment-review returns card with status=needs_review", async () => {
    // Card A: needs_review status — should be included
    await mkdir(path.join(root, ".ai/memory/modules"), { recursive: true });
    await writeCard(root, "modules", "needs-review.md", moduleFrontmatter({ id: "mod-review", status: "needs_review", related_scenarios: ["s1"] }), MODULE_ALL_SECTIONS);
    // Card B: current status — should NOT be included
    await writeCard(root, "modules", "current.md", moduleFrontmatter({ id: "mod-current", related_scenarios: ["s1"] }), MODULE_ALL_SECTIONS);
    const ids = await getNeedsEnrichmentIdsByFlag({ needsEnrichmentReview: true });
    expect(ids).toContain("mod-review");
    expect(ids).not.toContain("mod-current");
  });

  it("13. ENABLE_CROSS_LINK_TRACKING=1: cross_link_attempts=2 + no broken relations → excluded from --links", async () => {
    const prevFlag = process.env.ENABLE_CROSS_LINK_TRACKING;
    process.env.ENABLE_CROSS_LINK_TRACKING = "1";
    try {
      await mkdir(path.join(root, ".ai/memory/modules"), { recursive: true });
      await writeCard(root, "modules", "accepted.md", moduleFrontmatter({ id: "mod-accepted", cross_link_attempts: 2, has_broken_relations: false }), MODULE_ALL_SECTIONS);
      const ids = await getNeedsEnrichmentIdsByFlag({ needsEnrichmentLinks: true });
      expect(ids).not.toContain("mod-accepted");
    } finally {
      process.env.ENABLE_CROSS_LINK_TRACKING = prevFlag;
    }
  });

  it("14. ENABLE_CROSS_LINK_TRACKING=1: cross_link_attempts=2 + has_broken_relations=true → INCLUDED in --links", async () => {
    const prevFlag = process.env.ENABLE_CROSS_LINK_TRACKING;
    process.env.ENABLE_CROSS_LINK_TRACKING = "1";
    try {
      await mkdir(path.join(root, ".ai/memory/modules"), { recursive: true });
      await writeCard(root, "modules", "broken.md", moduleFrontmatter({ id: "mod-broken", cross_link_attempts: 2, has_broken_relations: true }), MODULE_ALL_SECTIONS);
      const ids = await getNeedsEnrichmentIdsByFlag({ needsEnrichmentLinks: true });
      expect(ids).toContain("mod-broken");
    } finally {
      process.env.ENABLE_CROSS_LINK_TRACKING = prevFlag;
    }
  });

  it("15. Without ENABLE_CROSS_LINK_TRACKING: card with empty cross-links always included in --links (no accept-empty)", async () => {
    // Explicitly unset the flag
    const prevFlag = process.env.ENABLE_CROSS_LINK_TRACKING;
    delete process.env.ENABLE_CROSS_LINK_TRACKING;
    try {
      await mkdir(path.join(root, ".ai/memory/modules"), { recursive: true });
      // Card with cross_link_attempts=2 but tracking is OFF → should still be included
      await writeCard(root, "modules", "no-tracking.md", moduleFrontmatter({ id: "mod-notracking", cross_link_attempts: 2, has_broken_relations: false }), MODULE_ALL_SECTIONS);
      const ids = await getNeedsEnrichmentIdsByFlag({ needsEnrichmentLinks: true });
      expect(ids).toContain("mod-notracking");
    } finally {
      process.env.ENABLE_CROSS_LINK_TRACKING = prevFlag;
    }
  });
});

async function initTempProject(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");
  const dir = await mkdtemp(path.join(tmpdir(), "ls-test-"));
  // Suppress init output
  const orig = console.log;
  console.log = () => {};
  try {
    await initMemory({ root: dir });
  } finally {
    console.log = orig;
  }
  return dir;
}
