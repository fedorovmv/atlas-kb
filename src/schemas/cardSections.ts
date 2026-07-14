import { z } from "zod";
import type { EntityType } from "../schemas/frontmatter.js";

/**
 * Card Section Contracts — exact H2 heading strings agents must use in card bodies.
 *
 * These strings are matched EXACTLY (case-sensitive) by the validator (validate.ts / cardSections.ts).
 * The ls.ts gate (hasMissingRequiredSections) uses case-insensitive matching for leniency,
 * but agents should always use the exact strings below to avoid any ambiguity.
 *
 * Sync these with the heading table in `src/scaffold/templates/agents/atlas-analyst.md`
 * and `src/scaffold/templates/agents/atlas-extractor.md` when adding/updating entity types.
 */

export interface SectionContract {
  required: string[];   // mandatory sections (H2 headings)
  recommended?: string[]; // recommended sections (warning, not error)
}

export const CARD_SECTION_CONTRACTS: Record<EntityType, SectionContract> = {
  module: {
    required: [
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
    ],
    recommended: [
      "## Публичный интерфейс",
      "## Зависимости",
    ],
  },
  flow: {
    required: [
      "## Цель",
      "## Участники",
      "## Последовательность",
      "## Fallback",
      "## Ограничения",
      "## Обработка ошибок",
      "## Связанные модули",
      "## Связанные тесты",
      "## Обоснование",
    ],
    recommended: ["## Переходы состояний"],
  },
  decision: {
    required: [
      "## Контекст",
      "## Проблема",
      "## Решение",
      "## Обоснование",
      "## Рассмотренные альтернативы",
      "## Отклонённые альтернативы",
      "## Последствия",
      "## Свидетельства текущего поведения",
      "## Затронутые модули",
      "## Затронутые сценарии",
    ],
  },
  scenario: {
    required: [
      "## Цель",
      "## Участники",
      "## Поток выполнения",
      "## Ограничения",
      "## Сценарии ошибок",
      "## Связанные модули",
      "## Связанные тесты",
      "## Обоснование",
    ],
  },
  proposal: {
    required: [
      "## Исходная спецификация",
      "## Предлагаемое поведение",
      "## Обоснование из спецификации",
      "## Затронутые модули",
      "## Затронутые сценарии",
      "## Затронутые решения",
      "## Проверка текущего кода",
      "## Утверждения",
      "## Решение по ревью",
    ],
  },
  historical: {
    required: [
      "## Какая проблема решалась",
      "## Актуальное обоснование",
      "## Устаревшие идеи",
      "## Выжившие решения",
      "## Ссылки на текущие решения",
    ],
  },
  reference: {
    required: [
      "## Перенесённое поведение",
      "## Намеренно не перенесённое поведение",
      "## Инварианты и переходы состояний",
      "## Отказ/повтор/отмена/восстановление",
      "## Совместимость/операционные ограничения",
      "## Производные сценарии и тесты",
    ],
  },
  testing: {
    required: [
      "## Слои тестирования",
      "## Команды",
      "## Покрытие",
      "## Известные пробелы",
    ],
  },
  ops: {
    required: [
      "## Развертывание",
      "## Конфигурация",
      "## Диагностика",
    ],
  },
  gotchas: {
    required: [
      "## Подводный камень",
      "## Как избежать",
      "## Свидетельства",
    ],
  },
  architecture: {
    required: [
      "## Обзор архитектуры",
    ],
    recommended: [
      "## Компоненты",
      "## Зависимости",
      "## Поток данных",
    ],
  },
  // Types without required sections (index, product_map, ontology, readme, conflict, open_question, task_routing, project, routing)
  index: { required: [] },
  product_map: { required: [] },
  ontology: { required: [] },
  readme: { required: [] },
  conflict: { required: [] },
  open_question: { required: [] },
  task_routing: { required: [] },
  project: { required: [] },
  routing: { required: [] },
};

export const CardSectionContractSchema = z.object({
  required: z.array(z.string()),
  recommended: z.array(z.string()).optional(),
});