import { describe, expect, it } from "vitest";
import { extractCardSections, validateCardSections } from "../src/core/cardSections.js";
import type { MemoryCard } from "../src/core/types.js";

function makeCard(meta: Partial<MemoryCard["meta"]>, body: string): MemoryCard {
  return {
    path: "/tmp/test.md",
    relativePath: "test.md",
    meta: {
      entity_type: "module",
      id: "test-card",
      title: "Test Card",
      status: "current",
      authority: "reviewed_memory",
      evidence_level: "reviewed_doc",
      stability: "stable",
      source_confidence: "high",
      last_reviewed: "2026-07-08",
      review_required: false,
      knowledge_types: ["current_behavior"],
      usage_policy: {
        can_answer_current_behavior: true,
        can_generate_code_from: true,
        can_use_as_rationale: true,
        requires_code_check_before_change: true,
      },
      ...meta,
    } as MemoryCard["meta"],
    body,
    raw: "",
  };
}

describe("extractCardSections", () => {
  it("parses H2 headings", () => {
    const body = "# Title\n\n## Section One\n\ncontent\n\n## Section Two\n\nmore content";
    const sections = extractCardSections(body);
    expect(sections).toContain("## Section One");
    expect(sections).toContain("## Section Two");
    expect(sections.length).toBe(2);
  });

  it("ignores H3, H1, and H4 headings", () => {
    const body = "# H1\n## H2 Only\n### H3\n#### H4";
    const sections = extractCardSections(body);
    expect(sections).toEqual(["## H2 Only"]);
  });

  it("ignores ## inside code blocks", () => {
    const body = "```\n## Fake Section\n```\n## Real Section";
    const sections = extractCardSections(body);
    expect(sections).toEqual(["## Real Section"]);
  });

  it("handles indented H2 headings", () => {
    const body = "  ## Indented Section";
    const sections = extractCardSections(body);
    expect(sections).toContain("## Indented Section");
  });

  it("returns empty array for body with no H2 headings", () => {
    const sections = extractCardSections("# No H2 here\n### Only H3");
    expect(sections).toEqual([]);
  });
});

describe("validateCardSections", () => {
  it("module without required sections → missingRequired non-empty", () => {
    const card = makeCard({ entity_type: "module", id: "empty-module" }, "# Empty Module\n\nNo sections.");
    const result = validateCardSections(card);
    expect(result.ok).toBe(false);
    expect(result.missingRequired.length).toBeGreaterThan(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("missing required section");
  });

  it("module with all required sections → ok=true", () => {
    const requiredSections = [
      "## Ответственность",
      "## Не входит в ответственность",
      "## Текущее поведение",
      "## Связанные сценарии",
      "## Связанные решения",
      "## Свидетельства из кода",
      "## Свидетельства из тестов",
      "## Известные риски",
      "## Открытые вопросы",
      "## Почему такие границы",
      "## Публичный интерфейс",
    ];
    const body = "# Full Module\n\n" + requiredSections.map((s) => `${s}\n\ncontent`).join("\n");
    const card = makeCard({ entity_type: "module", id: "full-module" }, body);
    const result = validateCardSections(card);
    expect(result.ok).toBe(true);
    expect(result.missingRequired).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("index (no contract) → ok=true, empty arrays", () => {
    const card = makeCard({ entity_type: "index", id: "test-index" }, "# Index\n\ncontent");
    const result = validateCardSections(card);
    expect(result.ok).toBe(true);
    expect(result.missingRequired).toEqual([]);
    expect(result.missingRecommended).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("decision without Rationale → error contains '## Обоснование'", () => {
    const body = "# Decision\n\n## Контекст\n\nSome context\n## Проблема\n\nProblem here";
    const card = makeCard({ entity_type: "decision", id: "test-decision" }, body);
    const result = validateCardSections(card);
    expect(result.ok).toBe(false);
    const rationaleErrors = result.errors.filter((e) => e.includes("## Обоснование"));
    expect(rationaleErrors.length).toBeGreaterThan(0);
  });

  it("module without recommended sections → warning, ok=true", () => {
    const requiredSections = [
      "## Ответственность",
      "## Не входит в ответственность",
      "## Текущее поведение",
      "## Связанные сценарии",
      "## Связанные решения",
      "## Свидетельства из кода",
      "## Свидетельства из тестов",
      "## Известные риски",
      "## Открытые вопросы",
      "## Почему такие границы",
      "## Публичный интерфейс",
    ];
    const body = "# Partial Module\n\n" + requiredSections.map((s) => `${s}\n\ncontent`).join("\n");
    const card = makeCard({ entity_type: "module", id: "partial-module" }, body);
    const result = validateCardSections(card);
    expect(result.ok).toBe(true);
    expect(result.missingRecommended.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("module missing ## Публичный интерфейс → required error", () => {
    const requiredSections = [
      "## Ответственность",
      "## Не входит в ответственность",
      "## Текущее поведение",
      "## Связанные сценарии",
      "## Связанные решения",
      "## Свидетельства из кода",
      "## Свидетельства из тестов",
      "## Известные риски",
      "## Открытые вопросы",
      "## Почему такие границы",
    ];
    const body = "# Module without public API\n\n" + requiredSections.map((s) => `${s}\n\ncontent`).join("\n");
    const card = makeCard({ entity_type: "module", id: "no-public-api" }, body);
    const result = validateCardSections(card);
    expect(result.ok).toBe(false);
    expect(result.missingRequired).toContain("## Публичный интерфейс");
    const pubApiErrors = result.errors.filter((e) => e.includes("## Публичный интерфейс"));
    expect(pubApiErrors.length).toBeGreaterThan(0);
  });

  it("module missing ## Внутренняя реализация → warning only", () => {
    const requiredSections = [
      "## Ответственность",
      "## Не входит в ответственность",
      "## Текущее поведение",
      "## Связанные сценарии",
      "## Связанные решения",
      "## Свидетельства из кода",
      "## Свидетельства из тестов",
      "## Известные риски",
      "## Открытые вопросы",
      "## Почему такие границы",
      "## Публичный интерфейс",
    ];
    const body = "# Module no internal impl\n\n" + requiredSections.map((s) => `${s}\n\ncontent`).join("\n");
    const card = makeCard({ entity_type: "module", id: "no-internal-impl" }, body);
    const result = validateCardSections(card);
    expect(result.ok).toBe(true);
    expect(result.missingRecommended).toContain("## Внутренняя реализация");
    const implWarnings = result.warnings.filter((w) => w.includes("## Внутренняя реализация"));
    expect(implWarnings.length).toBeGreaterThan(0);
  });

  it("module missing ## Примеры использования → warning only", () => {
    const requiredSections = [
      "## Ответственность",
      "## Не входит в ответственность",
      "## Текущее поведение",
      "## Связанные сценарии",
      "## Связанные решения",
      "## Свидетельства из кода",
      "## Свидетельства из тестов",
      "## Известные риски",
      "## Открытые вопросы",
      "## Почему такие границы",
      "## Публичный интерфейс",
    ];
    const body = "# Module no examples\n\n" + requiredSections.map((s) => `${s}\n\ncontent`).join("\n");
    const card = makeCard({ entity_type: "module", id: "no-examples" }, body);
    const result = validateCardSections(card);
    expect(result.ok).toBe(true);
    expect(result.missingRecommended).toContain("## Примеры использования");
    const exampleWarnings = result.warnings.filter((w) => w.includes("## Примеры использования"));
    expect(exampleWarnings.length).toBeGreaterThan(0);
  });

  it("decision missing ## Примеры использования → warning only", () => {
    const decisionBody = `# Decision\n\n## Контекст\ncontent\n## Проблема\ncontent\n## Решение\ncontent\n## Обоснование\ncontent\n## Рассмотренные альтернативы\ncontent\n## Отклонённые альтернативы\ncontent\n## Последствия\ncontent\n## Свидетельства текущего поведения\ncontent\n## Затронутые модули\ncontent\n## Затронутые сценарии\ncontent`;
    const card = makeCard({ entity_type: "decision", id: "decision-no-examples" }, decisionBody);
    const result = validateCardSections(card);
    expect(result.ok).toBe(true);
    expect(result.missingRecommended).toContain("## Примеры использования");
  });
});
