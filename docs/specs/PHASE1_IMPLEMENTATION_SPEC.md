# Спецификация Phase 1: Contract-first memory foundation

> Версия: 0.5.0-target | Документ-источник: GAP_CLOSURE_SPEC.md §3 Домены A, B, C
> Целевая реализация: TypeScript, `ts-kb-flow` (`repo-memory-opencode-kit`)
> Стек: TypeScript 5.9.2 (strict), Node ≥20 ESM, Zod 3.25, Commander.js 12, Vitest 3.2

## 0. Назначение документа

Детальная спецификация 9 эпиков Phase 1 с точными:
- Zod-схемами (новые и расширяемые)
- TypeScript-типами и сигнатурами функций
- Путями файлов (src/...)
- Integration points с существующим кодом
- Acceptance criteria и тестами

Phase 1 = Foundation: модель памяти + source coverage + dispatch advisory.

### 0.1. Архитектурное решение

**Утверждённый подход**: Incremental Layer Cake — изолированные модули поверх существующего core, validate становится координатором, вызывающим каждый валидатор. Каждая новая возможность получает свой module boundary.

**Рассмотренные альтернативы**:

1. **Incremental Layer Cake (утверждено)** — изолированные модули, validate-координатор, 13 новых файлов. Low risk, high testability, reversible via flags. Лучше всего подходит для soft advisory dispatch + content maps only + hybrid structure + soft compatibility.
2. **Pipeline Architecture** — явные build stages discover→classify→triage→validate, stage artifacts. Отклонено: over-engineers текущий scope, pipeline runner complexity unnecessary.
3. **Contract-First Validator with Lazy Enrichment** — bootstrap создаёт stubs, отдельная enrich команда, contracts abstraction. Отклонено: 2-step workflow unnecessary, contracts abstraction over-engineers для прямого v3 port.

**Decision matrix**:

| Dimension | Layer Cake | Pipeline | Contract-First |
|---|---|---|---|
| Correctness risk | Low | Medium (stale artifacts) | Low |
| Complexity | Medium | High | Medium |
| Maintainability | High | Medium | High |
| Migration safety | High | High | Medium (2-step) |
| Operability | High | Medium | Medium |
| Testability | High | High | High |
| Reversibility | High | Medium | High |
| Phase 2 readiness | Medium | High | Medium |
| New files | 13 | 11 | 10 |

**Rationale**: Layer Cake лучше всего подходит для soft advisory dispatch (простой JSONL recorder), content maps only (изолированный модуль), hybrid structure (additive scaffold), soft compatibility (optional fields + migration).

### 0.2. Пользовательские решения (binding)

4 решения приняты в ходе design discovery и являются binding-ограничениями для Phase 1:

1. **Dispatch gating**: Soft advisory — записывать dispatch attempts в JSONL, предупреждать о несоответствиях, БЕЗ hard-gate validation. OpenCode fresh-subagent-isolation уже обеспечивает изоляцию.
2. **Build pipeline**: Content maps only — перенести source content maps (navigation index). SKIP specialist findings JSONL и builder input pack. Agents читают cards directly.
3. **Card structure**: Hybrid — сохранить существующие README.md, ontology.md, product-map.md. Добавить 4 index cards: MEMORY.md, MODULES.md, DECISIONS.md, ARCHITECTURE.md. Добавить 2 subdirs: flows/, architecture/. Skip OPS/GOTCHAS/TESTING/TASK_ROUTING до более поздних фаз.
4. **Compatibility**: Soft constraint — существующие cards должны работать, minor breaking changes допустимы. Migration command. Bump to v0.5.0.

### 0.3. Зависимости (внутри Phase 1)

```
A1 ─┬─→ A2
     ├─→ A3
     ├─→ A4
     ├─→ B1 ──→ B3 ──→ C1 ──→ C4
     └─→ B2 ──┘
```

> **Note**: C2 (findings JSONL) и C3 (builder pack) — DEFERRED из Phase 1. Phase 1 = 9 эпиков. См. 0.2 Решение 2.

---

## 1. Текущий baseline (что есть)

### Существующие schemas (src/schemas/)

| Файл | Экспорты |
|---|---|
| frontmatter.ts | `EntityTypeSchema` (11 значений), `StatusSchema`, `AuthoritySchema`, `EvidenceLevelSchema` (8 значений), `StabilitySchema`, `ConfidenceSchema`, `KnowledgeTypeSchema` (7 значений), `RefSchema`, `UsagePolicySchema`, `MemoryFrontmatterSchema` (.passthrough, 28 полей), типы: `EntityType`, `Status`, `MemoryFrontmatter`, `KnowledgeType` |
| discovery.ts | `FileKindSchema` (10 значений), `FileRecordSchema`, `CandidateModuleSchema`, `DiscoveryReportSchema`, типы: `FileRecord`, `FileKind`, `CandidateModule`, `DiscoveryReport` |
| claim.ts | `ClaimTypeSchema`, `EvidenceStatusSchema` (10 значений), `ClaimSchema`, `EvidenceSchema`, `StoredClaimSchema`, типы: `Claim`, `Evidence`, `StoredClaim` |
| sourcePriority.ts | `SourcePrioritySchema`, тип `SourcePriority` |

### Существующие core-модули (src/core/)

| Файл | Экспорты |
|---|---|
| types.ts | `MemoryCard`, `RepoMemoryOptions`, `ValidationResult`, `ContextPack` |
| validate.ts | `validateMemory(): Promise<ValidationResult>` (10 шагов), `checkEnrichmentStatus()` |
| bootstrapMemory.ts | `BootstrapResult`, `bootstrapMemory()` (5 рендереров, 2 экстрактора, skip-logic) |
| loadMemory.ts | `loadMemoryCards()`, `loadMemoryCardsBestEffort()`, `LoadMemoryError`, `findCardById()`, `findMemoryMarkdownFiles()` |
| discoverProject.ts | `discoverProject()` (classifyFile, groupCandidateModules) |
| context.ts | `loadSourcePriority()`, `buildMemoryContext()` |
| score.ts | `tokenize()`, `cardHaystack()`, `scoreCard()` |
| relations.ts | `RELATION_FIELDS` (12 полей), `getDirectRelatedIds()`, `getReverseRelated()`, `getRelatedCards()` |
| reconcile.ts | `ReconcileReport`, `reconcileMemory()` (9 проверок) |
| reconcileFix.ts | `AppliedFixes`, `applyReconcileFixes()` (4 категории) |
| updateMemory.ts | `UpdateOptions`, `UpdateResult`, `updateMemoryCard()` (evidence guard, atomic write) |
| specClassification.ts | `SpecActuality`, `classifySpecActuality()`, `extractClaims()`, `checkEvidence()` |
| specRelations.ts | `DetectedRelation`, `detectSpecRelations()` |
| claimDedup.ts | `canonicalClaimText()`, `dedupClaims()`, `findCrossCardDuplicates()` |
| claimLinking.ts | `linkClaimsToCards()` (6 сигналов) |
| evidenceSection.ts | `hasEvidenceSection()`, `hasQualityEvidenceSection()` |
| docExtraction.ts | 6 утилит |
| topics.ts | `extractSpecTopics()` |
| paths.ts | `resolveRoot()`, `resolveMemoryRoot()`, `toPosixPath()` |
| utils.ts | `frontmatterYaml()`, `readFileIfExists()`, `today()` |

### Существующие CLI-команды (11): init, ls, show, related, context, validate, discover, bootstrap, ingest-spec, reconcile, update

### Существующие scaffold-файлы (28) в src/scaffold/templates.ts

### Существующие OpenCode tools (6) в templates/tools/memory.ts: context, validate, related, discover, bootstrap, updateCard

---

## 2. Эпик A1 — Расширение набора card types

### 2.1. Постановка

v3 имеет 10 card types: module, flow, decision, reference, project, routing, testing, ops, gotchas, index. ts-kb-flow имеет 11 entity_type: module, scenario, decision, proposal, historical, conflict, open_question, architecture, product_map, ontology, readme.

**Гэп**: Нет `flow`, `ops`, `gotchas`, `task_routing`, `testing`, `reference` как самостоятельных типов.

**Решение**: Аддитивно расширить `EntityTypeSchema` + добавить `runtime_tier` поле. Существующие типы не меняются.

### 2.2. Изменения

#### Файл: `src/schemas/frontmatter.ts`

Расширить `EntityTypeSchema`:

```typescript
// БЫЛО:
export const EntityTypeSchema = z.enum([
  "module", "scenario", "decision", "proposal", "historical",
  "conflict", "open_question", "architecture", "product_map",
  "ontology", "readme",
]);

// СТАЛО (20 значений):
export const EntityTypeSchema = z.enum([
  // существующие (11)
  "module", "scenario", "decision", "proposal", "historical",
  "conflict", "open_question", "architecture", "product_map",
  "ontology", "readme",
  // новые из v3 (9)
  "flow", "ops", "gotchas", "task_routing", "testing",
  "reference", "project", "routing", "index",
]);
```

Добавить `RuntimeTierSchema`:

```typescript
export const RuntimeTierSchema = z.enum([
  "production", "demo", "shared", "mixed", "historical", "unknown",
]);
export type RuntimeTier = z.infer<typeof RuntimeTierSchema>;
```

Добавить `SourceStatusSchema` (v3-аналог, не путать с существующим `StatusSchema`):

```typescript
export const SourceStatusSchema = z.enum([
  "current", "active-rationale", "partially-active",
  "superseded", "historical-only", "unknown",
]);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;
```

Расширить `MemoryFrontmatterSchema` двумя опциональными полями:

```typescript
// Добавить в MemoryFrontmatterSchema:
export const MemoryFrontmatterSchema = z.object({
  // ... все существующие 28 полей без изменений ...
  runtime_tier: RuntimeTierSchema.optional(),
  source_status: SourceStatusSchema.optional(),
}).passthrough();
```

> **Важно**: поля опциональны для обратной совместимости. Bootstrap проставляет их для module/flow/decision карточек.

#### Файл: `src/scaffold/templates.ts`

Расширить `scaffoldFiles` — добавить index cards (hybrid structure, см. 0.2 Решение 3).

Текущие scaffold-файлы `.ai/memory/`:
- README.md, ontology.md, product-map.md, modules/agent-tool-registry.md, modules/mcp-gateway.md, scenarios/*.md, decisions/.gitkeep, proposals/.gitkeep, reconciliation/conflicts.md, reconciliation/open-questions.md

Добавить (новые scaffold-файлы, hybrid — только 4 index cards + 2 subdirs):

| Путь | Назначение |
|---|---|
| `.ai/memory/MEMORY.md` | Top-level index memory card (entity_type=index) |
| `.ai/memory/MODULES.md` | Module index card (entity_type=index, runtime_tier split) |
| `.ai/memory/DECISIONS.md` | Decisions index card (entity_type=index) |
| `.ai/memory/ARCHITECTURE.md` | Architecture index card (entity_type=architecture, "Architecture by submodule" section) |
| `.ai/memory/flows/.gitkeep` | Flows subdir |
| `.ai/memory/architecture/.gitkeep` | Architecture subdir |

> **Не добавляются в Phase 1** (deferred): PROJECT.md, TASK_ROUTING.md, FLOWS.md (как index, не subdir), TESTING.md, OPS.md, GOTCHAS.md, reference/. entity_type enum всё ещё включает все 20 значений, но scaffold создаёт только 4 index cards + 2 subdirs.

Каждый файл — Markdown с YAML frontmatter, заполненный placeholder-секциями для LLM-заполнения.

Пример `MEMORY.md`:

```markdown
---
entity_type: index
id: memory-index
title: Memory Bank Index
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: high
last_reviewed: "2025-01-01"
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

# Memory Bank Index

## Overview
<!-- LLM: краткое описание продукта -->

## Module index
<!-- LLM: список модулей со ссылками на modules/*.md -->

## Architecture index
<!-- LLM: ссылки на architecture/*.md -->

## Flow index
<!-- LLM: ссылки на flows/*.md -->

## Decision index
<!-- LLM: ссылки на decisions/*.md -->
```

#### Файл: `src/core/bootstrapMemory.ts`

Расширить `bootstrapMemory()` — после discover и перед созданием module cards:
1. Создать 4 index cards если не существуют (MEMORY.md, MODULES.md, DECISIONS.md, ARCHITECTURE.md)
2. Создать 2 поддиректории (flows/, architecture/) если не существуют
3. Не перезаписывать существующие enriched карточки (skip-logic сохраняется)

Добавить в `BootstrapResult`:

```typescript
export type BootstrapResult = {
  written: string[];       // существующее
  skipped: string[];       // существующее
  report: DiscoveryReport; // существующее
  topLevelCreated: string[]; // НОВОЕ: созданные топ-левел файлы
  subdirsCreated: string[]; // НОВОЕ: созданные поддиректории
};
```

### 2.3. Acceptance criteria

- [ ] `EntityTypeSchema` принимает все 20 значений
- [ ] `MemoryFrontmatterSchema` парсит карточку с `runtime_tier: production` без ошибки
- [ ] `MemoryFrontmatterSchema` парсит карточку без `runtime_tier` (опционально)
- [ ] `init` создаёт 4 index cards + 2 новые поддиректории
- [ ] `bootstrap` создаёт index cards если их нет
- [ ] Существующие карточки без `runtime_tier` продолжают проходить validate
- [ ] `MemoryFrontmatterSchema` с `runtime_tier: "invalid"` → Zod error

### 2.4. Тесты

`test/frontmatter.test.ts`:
- Расширенный test: EntityTypeSchema валидирует все 20 значений
- Новый test: MemoryFrontmatterSchema с runtime_tier valid → ok
- Новый test: MemoryFrontmatterSchema с runtime_tier invalid → ZodError
- Новый test: MemoryFrontmatterSchema без runtime_tier → ok (опционально)

`test/bootstrap.test.ts`:
- Новый test: bootstrap создаёт 4 index cards
- Новый test: bootstrap создаёт flows/, reference/, architecture/
- Новый test: bootstrap не перезаписывает enriched топ-левел карточки
- Новый test: BootstrapResult.topLevelCreated содержит созданные файлы

---

## 3. Эпик A2 — Контракт обязательных секций карточек

### 3.1. Постановка

v3 валидирует обязательные секции Markdown body для каждого card type. ts-kb-flow валидирует frontmatter, но не секции body.

### 3.2. Изменения

#### Новый файл: `src/schemas/cardSections.ts`

```typescript
import { z } from "zod";

export type EntityType =
  | "module" | "scenario" | "decision" | "proposal" | "historical"
  | "conflict" | "open_question" | "architecture" | "product_map"
  | "ontology" | "readme" | "flow" | "ops" | "gotchas" | "task_routing"
  | "testing" | "reference" | "project" | "routing" | "index";

export interface SectionContract {
  required: string[];   // обязательные секции (H2 заголовки)
  recommended?: string[]; // рекомендуемые секции (warning, не error)
}

export const CARD_SECTION_CONTRACTS: Record<EntityType, SectionContract> = {
  module: {
    required: [
      "## Responsibilities",
      "## Non-responsibilities",
      "## Current behavior",
      "## Related scenarios",
      "## Related decisions",
      "## Code references",
      "## Test references",
      "## Known risks",
      "## Open questions",
      "## Why these boundaries",
    ],
    recommended: [
      "## Public surface",
      "## Dependencies",
    ],
  },
  flow: {
    required: [
      "## Goal",
      "## Actors",
      "## Sequence",
      "## Fallback",
      "## Constraints",
      "## Error handling",
      "## Related modules",
      "## Related tests",
      "## Rationale",
    ],
    recommended: ["## State transitions"],
  },
  decision: {
    required: [
      "## Context",
      "## Problem",
      "## Decision",
      "## Rationale",
      "## Alternatives considered",
      "## Rejected alternatives",
      "## Consequences",
      "## Current behavior evidence",
      "## Affected modules",
      "## Affected scenarios",
    ],
  },
  scenario: {
    required: [
      "## Goal",
      "## Actors",
      "## Flow",
      "## Constraints",
      "## Error cases",
      "## Related modules",
      "## Related tests",
      "## Rationale",
    ],
  },
  proposal: {
    required: [
      "## Source spec",
      "## Proposed behavior",
      "## Rationale from spec",
      "## Affected modules",
      "## Affected scenarios",
      "## Affected decisions",
      "## Current code check",
      "## Claims",
      "## Review decision",
    ],
  },
  historical: {
    required: [
      "## What problem was being solved",
      "## Rationale still useful",
      "## Obsolete ideas",
      "## Decisions that survived",
      "## Links to current decisions",
    ],
  },
  reference: {
    required: [
      "## Behaviors carried over",
      "## Behaviors intentionally not carried over",
      "## Invariants and state transitions",
      "## Failure/retry/cancellation/recovery",
      "## Compatibility/operational constraints",
      "## Derived scenarios and tests",
    ],
  },
  testing: {
    required: [
      "## Test layers",
      "## Commands",
      "## Coverage",
      "## Known gaps",
    ],
  },
  ops: {
    required: [
      "## Deployment",
      "## Configuration",
      "## Diagnostics",
    ],
  },
  gotchas: {
    required: [
      "## Pitfall",
      "## Avoidance",
      "## Evidence",
    ],
  },
  architecture: {
    required: [
      "## Architecture overview",
    ],
    recommended: [
      "## Components",
      "## Dependencies",
      "## Data flow",
    ],
  },
  // Типы без обязательных секций (index, product_map, ontology, readme, conflict, open_question, task_routing, project, routing)
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
```

#### Новый файл: `src/core/cardSections.ts`

```typescript
import { MemoryCard } from "./types";
import { CARD_SECTION_CONTRACTS, EntityType } from "../schemas/cardSections";

/**
 * Извлекает H2 заголовки из Markdown body.
 * Возвращает массив вида "## Title" (с ##).
 */
export function extractCardSections(body: string): string[] {
  const lines = body.split("\n");
  const sections: string[] = [];
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (/^## /.test(trimmed)) {
      sections.push(trimmed);
    }
  }
  return sections;
}

export interface SectionValidationResult {
  ok: boolean;
  missingRequired: string[];
  missingRecommended: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Проверяет карточку на соответствие контракту секций.
 */
export function validateCardSections(card: MemoryCard): SectionValidationResult {
  const contract = CARD_SECTION_CONTRACTS[card.meta.entity_type as EntityType];
  const result: SectionValidationResult = {
    ok: true,
    missingRequired: [],
    missingRecommended: [],
    errors: [],
    warnings: [],
  };

  if (!contract) {
    // Нет контракта для этого типа — не проверяем
    return result;
  }

  const present = extractCardSections(card.body);
  const presentSet = new Set(present.map((s) => s.trim()));

  for (const required of contract.required) {
    if (!presentSet.has(required)) {
      result.missingRequired.push(required);
      result.errors.push(
        `Card "${card.meta.id}" (${card.meta.entity_type}): missing required section "${required}"`
      );
    }
  }

  if (contract.recommended) {
    for (const rec of contract.recommended) {
      if (!presentSet.has(rec)) {
        result.missingRecommended.push(rec);
        result.warnings.push(
          `Card "${card.meta.id}" (${card.meta.entity_type}): missing recommended section "${rec}"`
        );
      }
    }
  }

  result.ok = result.errors.length === 0;
  return result;
}
```

#### Файл: `src/core/validate.ts`

Интегрировать `validateCardSections` в существующий `validateMemory()` pipeline.

Текущий pipeline (10 шагов) — добавить после шага 4 (policy invariants):

```typescript
// В validateMemory(), после проверки policy invariants (шаг 4):

// ШАГ 4b: Card sections validation
for (const card of cards) {
  const sectionResult = validateCardSections(card);
  for (const err of sectionResult.errors) {
    errors.push(err);
  }
  if (strictWarnings) {
    for (const warn of sectionResult.warnings) {
      errors.push(warn);  // strict mode: warnings → errors
    }
  } else {
    for (const warn of sectionResult.warnings) {
      warnings.push(warn);
    }
  }
}
```

`validateMemory` должен принимать `strictWarnings` (уже есть через `RepoMemoryOptions`? — проверить, если нет, добавить в опции).

Расширить `RepoMemoryOptions`:

```typescript
export type RepoMemoryOptions = {
  root?: string;
  memoryRoot?: string;
  staleProposalDays?: number;
  // НОВЫЕ:
  requireSourceCoverage?: boolean;      // C4
  checkDispatch?: boolean;        // C1: dispatch advisory warnings
  maxErrors?: number;                   // C4, default 50
  strictWarnings?: boolean;             // A2: warnings → errors
};
```

#### Файл: `src/core/updateMemory.ts`

Добавить soft warning при обновлении body без required-секций:

```typescript
// В updateMemoryCard(), после записи body:

const sectionResult = validateCardSections(updatedCard);
if (sectionResult.missingRequired.length > 0) {
  // Warning, не throw — body может быть в процессе заполнения
  console.warn(
    `Warning: card "${id}" is missing required sections: ${sectionResult.missingRequired.join(", ")}`
  );
}
```

### 3.3. Acceptance criteria

- [ ] `validateCardSections` находит missing required секции
- [ ] `validateMemory` выдаёт ERROR для карточки decision без `## Rationale`
- [ ] `validateMemory --strict-warnings` превращает missing recommended в ERROR
- [ ] `updateMemoryCard` выдаёт warning (не throw) при missing required секциях
- [ ] Типы без контракта (index, open_question, etc.) не вызывают ошибок
- [ ] `extractCardSections` корректно парсит `## ` заголовки (не `### ` или `# `)

### 3.4. Тесты

`test/cardSections.test.ts` (новый файл):
- `extractCardSections` парсит H2 заголовки
- `extractCardSections` игнорирует H3, H1, code blocks с ##
- `validateCardSections` для module без required секций → missingRequired непустой
- `validateCardSections` для module со всеми секциями → ok=true
- `validateCardSections` для index (нет контракта) → ok=true, пустые массивы
- `validateCardSections` для decision без Rationale → error содержит "## Rationale"
- `validateCardSections` для module без recommended → warning, ok=true

`test/validate.test.ts`:
- Новый test: validate на decision без required секций → errors содержат section errors
- Новый test: validate --strict-warnings на module без recommended → errors содержат warnings

`test/update.test.ts`:
- Новый test: updateMemoryCard с body без required секций → warning в stderr, update успешен

---

## 4. Эпик A3 — Knowledge ontology: docs / drafts / memory

### 4.1. Постановка

v3 разделяет `knowledge/docs/` (канонические), `knowledge/drafts/` (нерешённые, исключены из context), `knowledge/memory/` (компактные карточки). ts-kb-flow имеет только `.ai/memory/`.

### 4.2. Изменения

#### Новый файл: `src/schemas/docFrontmatter.ts`

```typescript
import { z } from "zod";

export const DocNodeTypeSchema = z.enum([
  "service", "reference", "decision", "runbook", "gotcha", "guide", "index",
]);
export type DocNodeType = z.infer<typeof DocNodeTypeSchema>;

export const DocStatusSchema = z.enum([
  "active", "draft", "deprecated", "archived",
]);
export type DocStatus = z.infer<typeof DocStatusSchema>;

export const DocFrontmatterSchema = z.object({
  node_type: DocNodeTypeSchema,
  title: z.string().min(1),
  service: z.string(),
  status: DocStatusSchema,
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tags: z.array(z.string()),
  links: z.record(z.string(), z.string()),
}).passthrough();
export type DocFrontmatter = z.infer<typeof DocFrontmatterSchema>;
```

#### Новый файл: `src/core/docValidate.ts`

```typescript
import { DocFrontmatterSchema, DocNodeType } from "../schemas/docFrontmatter";
import { MemoryCard } from "./types";

export interface DocValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface DocFile {
  path: string;
  relativePath: string;
  meta: DocFrontmatter;
  body: string;
  raw: string;
}

/**
 * Загружает и парсит docs из .ai/docs/.
 */
export async function loadDocs(options?: { root?: string }): Promise<DocFile[]>;

/**
 * Валидирует docs: frontmatter, evidence для active, body length, markdown links.
 */
export async function validateDocs(options?: { root?: string }): Promise<DocValidationResult>;
```

Правила валидации docs:
1. Frontmatter парсится через `DocFrontmatterSchema`
2. `status=active` docs (кроме node_type index/decision/guide) должны иметь `## Evidence` секцию в body
3. Body ≥ 40 символов
4. Минимум одна Markdown-ссылка в body
5. Все локальные Markdown-ссылки разрешаются (относительно doc path)

#### Файл: `src/core/context.ts`

В `buildMemoryContext()` исключить `.ai/drafts/` из результатов по умолчанию.

Текущий `buildMemoryContext` грузит cards из `.ai/memory/`. Не нужно менять — drafts не в `.ai/memory/`. Но добавить проверку: если в `.ai/memory/` есть файлы с `status: draft` — они грузятся (это memory cards, не docs).

Drafts (`/.ai/drafts/`) — отдельная директория, не сканируется `findMemoryMarkdownFiles`.

#### Файл: `src/scaffold/templates.ts`

Добавить scaffold-файлы:

| Путь | Назначение |
|---|---|
| `.ai/docs/.gitkeep` | Docs directory placeholder |
| `.ai/drafts/.gitkeep` | Drafts directory placeholder |

#### Файл: `src/core/bootstrapMemory.ts`

После создания memory cards, bootstrap НЕ создаёт docs/drafts — они создаются вручную или legacy ingestion (Phase 2).

### 4.3. Acceptance criteria

- [ ] `DocFrontmatterSchema` валидирует doc с node_type=service, status=active
- [ ] `validateDocs` отклоняет doc без frontmatter
- [ ] `validateDocs` отклоняет active doc (не index/decision/guide) без `## Evidence`
- [ ] `validateDocs` отклоняет doc с body < 40 символов
- [ ] `validateDocs` отклоняет doc с broken markdown link
- [ ] `buildMemoryContext` не включает `.ai/drafts/` в results
- [ ] `init` создаёт `.ai/docs/.gitkeep` и `.ai/drafts/.gitkeep`

### 4.4. Тесты

`test/docFrontmatter.test.ts` (новый):
- DocFrontmatterSchema valid → ok
- DocFrontmatterSchema без node_type → ZodError
- DocFrontmatterSchema с invalid status → ZodError
- DocFrontmatterSchema с non-ISO date → ZodError

`test/docValidate.test.ts` (новый):
- validateDocs на empty dir → ok
- validateDocs на valid doc → ok
- validateDocs на active service doc без Evidence → error
- validateDocs на doc с body < 40 → error
- validateDocs на doc с broken link → error
- validateDocs на index doc без Evidence → ok (exempt)

---

## 5. Эпик A4 — Runtime tier классификация

### 5.1. Постановка

v3 классифицирует карточки по `runtime_tier` (production, demo, shared, mixed, historical, unknown). Добавлено поле в A1, нужна логика классификации.

### 5.2. Изменения

#### Новый файл: `src/core/runtimeTier.ts`

```typescript
import { MemoryCard } from "./types";
import { FileRecord } from "../schemas/discovery";
import { RuntimeTier } from "../schemas/frontmatter";

/**
 * Классифицирует runtime_tier карточки по её code_refs и discovery.
 */
export function classifyRuntimeTier(
  card: MemoryCard,
  discovery: FileRecord[]
): RuntimeTier {
  const codeRefs = card.meta.code_refs ?? [];
  const paths = codeRefs.map((r) => r.path);

  const isDemo = paths.some((p) =>
    /\/(demo|example|examples|testdata)\//.test(p) || /\/(demo|example)\./.test(p)
  );
  const isProduction = paths.some((p) =>
    !/(test|spec|demo|example|examples|testdata|legacy|archive)\//.test(p)
  );
  const isTest = paths.some((p) => /\/(test|tests)\//.test(p) || /_test\.|\.test\./.test(p));
  const isHistorical = card.meta.source_status === "historical-only"
    || card.meta.status === "historical";

  if (isHistorical) return "historical";
  if (isDemo && isProduction) return "mixed";
  if (isDemo && isTest && !isProduction) return "demo";
  if (isDemo) return "demo";
  if (isProduction && isTest) return "mixed";
  if (isProduction) return "production";
  if (isTest) return "shared";

  // Проверяем shared: code_refs указывают на paths shared между несколькими модулями
  // (упрощённая эвристика: путь содержит /shared/ или /common/)
  if (paths.some((p) => /\/(shared|common)\//.test(p))) return "shared";

  return "unknown";
}

/**
 * Проверяет, что runtime_tier соответствует code_refs.
 * Возвращает warnings при mismatch.
 */
export function checkRuntimeTierMismatch(card: MemoryCard): string[] {
  const warnings: string[] = [];
  if (!card.meta.runtime_tier) return warnings;

  const codeRefs = card.meta.code_refs ?? [];
  const paths = codeRefs.map((r) => r.path);

  const hasDemoRefs = paths.some((p) =>
    /\/(demo|example|examples|testdata)\//.test(p)
  );

  if (card.meta.runtime_tier === "production" && hasDemoRefs) {
    warnings.push(
      `Card "${card.meta.id}" has runtime_tier=production but references demo/example paths`
    );
  }

  return warnings;
}
```

#### Файл: `src/core/bootstrapMemory.ts`

В `renderModuleCard` — после создания frontmatter, проставить `runtime_tier`:

```typescript
// В renderModuleCard():
const tier = classifyRuntimeTier(card, discovery.files);
frontmatter.runtime_tier = tier;
```

#### Файл: `src/core/validate.ts`

Добавить `checkRuntimeTierMismatch` в pipeline (после шага evidence checks):

```typescript
// ШАГ 8b: Runtime tier mismatch
for (const card of cards) {
  const tierWarnings = checkRuntimeTierMismatch(card);
  warnings.push(...tierWarnings);
}
```

### 5.3. Acceptance criteria

- [ ] `classifyRuntimeTier` возвращает `demo` для карточки с code_refs на `examples/`
- [ ] `classifyRuntimeTier` возвращает `production` для карточки с code_refs на `internal/`
- [ ] `classifyRuntimeTier` возвращает `historical` для карточки с status=historical
- [ ] `classifyRuntimeTier` возвращает `mixed` для карточки с production + test refs
- [ ] `bootstrap` проставляет `runtime_tier` для module cards
- [ ] `validate` выдаёт warning для production tier с demo refs
- [ ] `checkRuntimeTierMismatch` возвращает пустой массив если tier не задан

### 5.4. Тесты

`test/runtimeTier.test.ts` (новый):
- classifyRuntimeTier: только demo refs → "demo"
- classifyRuntimeTier: только production refs → "production"
- classifyRuntimeTier: production + test refs → "mixed"
- classifyRuntimeTier: demo + production refs → "mixed"
- classifyRuntimeTier: status=historical → "historical"
- classifyRuntimeTier: пустые code_refs → "unknown"
- classifyRuntimeTier: /shared/ в пути → "shared"
- checkRuntimeTierMismatch: production + demo refs → warning
- checkRuntimeTierMismatch: без tier → пустой массив

---

## 6. Эпик B1 — Source coverage contract: disposition ledger

### 6.1. Постановка

v3 требует что каждый source document получает ровно одну disposition из 7 значений. Хранится в `source-coverage.json`.

### 6.2. Изменения

#### Новый файл: `src/schemas/sourceCoverage.ts`

```typescript
import { z } from "zod";

export const DispositionSchema = z.enum([
  "extracted", "rationale-only", "superseded",
  "historical-only", "rejected", "deferred", "unknown",
]);
export type Disposition = z.infer<typeof DispositionSchema>;

export const SourceKindSchema = z.enum([
  "git-tracked", "working-tree", "submodule-working-tree",
]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const SourceCoverageEntrySchema = z.object({
  path: z.string(),
  sha256: z.string().optional(),
  moduleBoundary: z.string().optional(),
  sourceKind: SourceKindSchema.default("git-tracked"),
  docState: z.string().optional(),
  title: z.string().optional(),
  disposition: DispositionSchema,
  reason: z.string().optional(),
  targetCards: z.array(z.string()).default([]),
});
export type SourceCoverageEntry = z.infer<typeof SourceCoverageEntrySchema>;

export const SourceCoverageSchema = z.object({
  entries: z.array(SourceCoverageEntrySchema),
  counts: z.record(z.string(), z.number()).default({}),
});
export type SourceCoverage = z.infer<typeof SourceCoverageSchema>;
```

#### Новый файл: `src/core/sourceCoverage.ts`

```typescript
import { SourceCoverage, SourceCoverageEntry, Disposition } from "../schemas/sourceCoverage";
import { FileRecord } from "../schemas/discovery";
import * as path from "path";
import * as fs from "fs/promises";
import { createHash } from "crypto";

export interface TriageResult {
  coverage: SourceCoverage;
  updated: number;  // сколько unknown → concrete
  stillUnknown: number;
}

/**
 * Определяет disposition для файла по его content и signals.
 */
export function triageDisposition(
  file: FileRecord,
  content: string,
  cards: MemoryCard[]
): { disposition: Disposition; reason?: string; targetCards?: string[] } {
  // 1. Пустой/бинарный → rejected
  if (content.length === 0 || file.sizeBytes === 0) {
    return { disposition: "rejected", reason: "empty file" };
  }
  if (isBinaryFile(file)) {
    return { disposition: "rejected", reason: "binary file" };
  }

  // 2. Содержит deprecated/superseded теги → superseded
  if (/\b(deprecated|superseded|obsolete)\b/i.test(content)) {
    return { disposition: "superseded", reason: "deprecated/superseded markers in content" };
  }

  // 3. Legacy/archive пути
  const isLegacyPath = /(legacy|archive|old|deprecated)\//.test(file.path);
  const hasArchSignals = /\b(architecture|rationale|decision|constraint)\b/i.test(content);

  if (isLegacyPath && !hasArchSignals) {
    return { disposition: "historical-only", reason: "legacy path without architecture signals" };
  }
  if (isLegacyPath && hasArchSignals) {
    return { disposition: "rationale-only", reason: "legacy path with rationale signals" };
  }

  // 4. Rationale теги → rationale-only
  if (/\b(rationale|why|reason|ADR|decision record)\b/i.test(content)) {
    return { disposition: "rationale-only", reason: "rationale markers in content" };
  }

  // 5. Current-doc signals → extracted
  const currentDocSignals = /\b(architecture|flow|deploy|config|test|ops|API|runtime)\b/i.test(content);
  if (currentDocSignals && file.kind === "doc") {
    const targetCards = findTargetCards(file, cards);
    return {
      disposition: "extracted",
      reason: "current documentation with durable signals",
      targetCards,
    };
  }

  // 6. Headings + current-candidate → extracted (low confidence)
  if (file.kind === "doc" && /^#{1,3}\s/m.test(content)) {
    const targetCards = findTargetCards(file, cards);
    return {
      disposition: "extracted",
      reason: "document with headings (low confidence)",
      targetCards,
    };
  }

  // 7. Fallback → rejected
  return { disposition: "rejected", reason: "no durable signals detected" };
}

/**
 * Создаёт initial source-coverage.json из discovery.
 * Все dispositions = "unknown" изначально.
 */
export async function createInitialCoverage(
  discovery: DiscoveryReport,
  options?: { root?: string }
): Promise<SourceCoverage>;

/**
 * Применяет triage к coverage: заменяет unknown на concrete disposition.
 */
export async function triageCoverage(
  coverage: SourceCoverage,
  discovery: DiscoveryReport,
  cards: MemoryCard[],
  options?: { root?: string }
): Promise<TriageResult>;

/**
 * Валидирует source-coverage.json.
 */
export function validateSourceCoverage(
  coverage: SourceCoverage,
  cards: MemoryCard[]
): { errors: string[]; warnings: string[] };
```

Правила `validateSourceCoverage` (из v3 memoryctl.py L2171-2256):
1. Каждый file из discovery должен быть в coverage
2. `disposition` ∈ 7 значений
3. `unknown` после triage = ERROR
4. `rejected`/`deferred`/`unknown` требуют `reason`
5. `extracted`/`rationale-only`/`superseded` требуют `targetCards[]` (непустой)
6. `historical-only` НЕ должен иметь `targetCards` (L2215-2216)
7. `targetCards` пути должны существовать

#### Файл: `src/core/validate.ts`

Добавить source coverage валидацию (флаг `requireSourceCoverage`):

```typescript
// В validateMemory(), после шага 10 (code/test ref existence):

// ШАГ 11: Source coverage validation (если --require-source-coverage)
if (options?.requireSourceCoverage) {
  const coveragePath = path.join(memoryRoot, "source-coverage.json");
  const coverageContent = await readFileIfExists(coveragePath);
  if (!coverageContent) {
    errors.push("source-coverage.json not found (required by --require-source-coverage)");
  } else {
    const coverage = SourceCoverageSchema.parse(JSON.parse(coverageContent));
    const covResult = validateSourceCoverage(coverage, cards);
    errors.push(...covResult.errors);
    warnings.push(...covResult.warnings);
  }
}
```

#### Файл: `src/core/bootstrapMemory.ts`

После discover и создания cards, вызвать triage:

```typescript
// В bootstrapMemory(), после создания всех карточек:

// Создать initial coverage
const initialCoverage = await createInitialCoverage(report, { root });

// Загрузить cards для triage
const cards = await loadMemoryCards({ root, memoryRoot });

// Triage
const triage = await triageCoverage(initialCoverage, report, cards, { root });

// Сохранить coverage
const coveragePath = path.join(memoryRoot, "source-coverage.json");
await fs.writeFile(coveragePath, JSON.stringify(triage.coverage, null, 2));

// Добавить в BootstrapResult
result.coverageCreated = coveragePath;
result.triageUpdated = triage.updated;
result.triageStillUnknown = triage.stillUnknown;
```

Расширить `BootstrapResult`:

```typescript
export type BootstrapResult = {
  written: string[];
  skipped: string[];
  report: DiscoveryReport;
  topLevelCreated: string[];     // A1
  subdirsCreated: string[];      // A1
  coverageCreated?: string;      // НОВОЕ: путь к source-coverage.json
  triageUpdated?: number;        // НОВОЕ: сколько unknown → concrete
  triageStillUnknown?: number;   // НОВОЕ: сколько осталось unknown
};
```

### 6.3. Acceptance criteria

- [ ] `triageDisposition` возвращает `rejected` для пустого файла
- [ ] `triageDisposition` возвращает `superseded` для файла с "deprecated" в content
- [ ] `triageDisposition` возвращает `historical-only` для legacy path без arch signals
- [ ] `triageDisposition` возвращает `extracted` для current doc с signals
- [ ] `triageDisposition` возвращает `rationale-only` для ADR/decision doc
- [ ] `createInitialCoverage` создаёт coverage со всеми `unknown`
- [ ] `triageCoverage` обновляет `unknown` → concrete dispositions
- [ ] `validateSourceCoverage` отклоняет `unknown` после triage
- [ ] `validateSourceCoverage` отклоняет `extracted` без targetCards
- [ ] `validateSourceCoverage` отклоняет `historical-only` с targetCards
- [ ] `validate --require-source-coverage` проверяет coverage
- [ ] `bootstrap` создаёт source-coverage.json

### 6.4. Тесты

`test/sourceCoverage.test.ts` (новый):
- triageDisposition: empty file → rejected
- triageDisposition: binary file → rejected
- triageDisposition: deprecated content → superseded
- triageDisposition: legacy path + arch signals → rationale-only
- triageDisposition: legacy path + no arch signals → historical-only
- triageDisposition: ADR content → rationale-only
- triageDisposition: current doc with signals → extracted
- triageDisposition: doc with headings → extracted
- triageDisposition: no signals → rejected
- createInitialCoverage: все entries имеют disposition=unknown
- triageCoverage: обновляет unknown → concrete
- triageCoverage: возвращает updated count
- validateSourceCoverage: unknown after triage → error
- validateSourceCoverage: extracted без targetCards → error
- validateSourceCoverage: historical-only с targetCards → error
- validateSourceCoverage: rejected без reason → error
- validateSourceCoverage: все valid → ok

`test/validate.test.ts`:
- Новый test: validate --require-source-coverage без source-coverage.json → error
- Новый test: validate --require-source-coverage с valid coverage → ok

`test/bootstrap.test.ts`:
- Новый test: bootstrap создаёт source-coverage.json
- Новый test: bootstrap возвращает triageUpdated > 0
- Новый test: bootstrap triageStillUnknown == 0 для synapse-mini

---

## 7. Эпик B2 — Source content maps

### 7.1. Постановка

v3 строит `source-content-map.jsonl` — per-source навигационная карта с topics, components, services, section map, target-card hints.

### 7.2. Изменения

#### Новый файл: `src/schemas/sourceContentMap.ts`

```typescript
import { z } from "zod";

export const SectionMapEntrySchema = z.object({
  heading: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  summary: z.string().optional(),
  keywordTopics: z.array(z.string()).default([]),
});
export type SectionMapEntry = z.infer<typeof SectionMapEntrySchema>;

export const SourceContentMapSchema = z.object({
  contentMapId: z.string(),  // SHA-256[:16]
  path: z.string(),
  sha256: z.string(),
  title: z.string().optional(),
  moduleBoundary: z.string().optional(),
  classifiers: z.object({
    sourceType: z.string(),
    sourceStatus: z.string().optional(),
    memoryIntents: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
  }),
  topics: z.array(z.string()).default([]),
  components: z.array(z.string()).default([]),
  services: z.array(z.string()).default([]),
  referencedPaths: z.array(z.string()).default([]),
  targetCards: z.array(z.string()).default([]),
  sectionMap: z.array(SectionMapEntrySchema).default([]),
});
export type SourceContentMap = z.infer<typeof SourceContentMapSchema>;
```

#### Новый файл: `src/core/contentMap.ts`

```typescript
import { SourceContentMap, SectionMapEntry } from "../schemas/sourceContentMap";
import { FileRecord } from "../schemas/discovery";
import { MemoryCard } from "./types";
import { createHash } from "crypto";
import * as fs from "fs/promises";

/**
 * Строит content map для одного файла.
 */
export async function buildSourceContentMap(
  file: FileRecord,
  cards: MemoryCard[],
  options?: { root?: string }
): Promise<SourceContentMap>;

/**
 * Строит content maps для всех файлов из discovery.
 * Записывает .ai/memory-build/latest/source-content-map.jsonl
 */
export async function buildAllContentMaps(
  discovery: DiscoveryReport,
  cards: MemoryCard[],
  options?: { root?: string; buildDir?: string }
): Promise<{ maps: SourceContentMap[]; path: string }>;
```

Логика `buildSourceContentMap`:

1. **Парсить Markdown заголовки** → sectionMap:
   - `## ` и `### ` заголовки
   - startLine = позиция заголовка
   - endLine = позиция следующего заголовка или EOF
   - summary = первый параграф после заголовка (до 120 символов)
   - keywordTopics = существительные из заголовка

2. **Извлечь topics**:
   - Из заголовков (first 5)
   - Из первого параграфа
   - Из code blocks (импорты, package names)
   - Фильтровать stopwords, даты, цифры

3. **Определить components/services**:
   - Из path patterns: `internal/<component>/`, `pkg/<component>/`, `services/<service>/`
   - Из content: "Service: X", "Component: Y"
   - Из package declarations (Go: `package X`)

4. **Вычислить targetCards**:
   - Для каждой карточки: проверить пересечение topics (card.meta.aliases + card.meta.product_areas) ∩ file.topics
   - Проверить пересечение code_refs (card) ∩ file.path
   - Если пересечение ≥ 1 topic ИЛИ code_ref match → card в targetCards
   - targetCards = пути к карточкам (`.ai/memory/modules/<id>.md`)

5. **contentMapId** = SHA-256[:16] от sorted JSON записи

6. **referencedPaths**: извлечь из Markdown-ссылок `[text](path)` и code blocks

### 7.3. Acceptance criteria

- [ ] `buildSourceContentMap` возвращает map с sectionMap для Markdown файла
- [ ] sectionMap содержит heading, startLine, endLine
- [ ] topics извлекаются из заголовков и первого параграфа
- [ ] components извлекаются из path patterns
- [ ] targetCards указывают на существующие карточки
- [ ] contentMapId детерминирован (одинаковый для одного файла)
- [ ] `buildAllContentMaps` создаёт JSONL с записью для каждого файла
- [ ] JSONL валидируется через SourceContentMapSchema

### 7.4. Тесты

`test/contentMap.test.ts` (новый):
- buildSourceContentMap: Markdown с 3 заголовками → sectionMap длиной 3
- buildSourceContentMap: заголовок без content → summary пустой
- buildSourceContentMap: Go файл с package → component извлечён
- buildSourceContentMap: targetCards для файла с topics → карточка с matching alias
- buildSourceContentMap: contentMapId детерминирован
- buildAllContentMaps: JSONL с N записями для N файлов
- SourceContentMapSchema: valid → ok
- SourceContentMapSchema: без contentMapId → ZodError

---

## 8. Эпик B3 — Automatic source triage

### 8.1. Постановка

v3 имеет `triage-sources` команду которая детерминированно классифицирует все sources по content. Bootstrap должен автоматически вызывать triage.

### 8.2. Изменения

#### Файл: `src/core/sourceCoverage.ts` (расширение из B1)

Добавить `triageSources`:

```typescript
/**
 * Полный triage pipeline: discovery → content maps → coverage update.
 */
export async function triageSources(options?: {
  root?: string;
  buildDir?: string;
}): Promise<TriageResult & { contentMaps: SourceContentMap[]; contentMapPath: string }>;
```

Логика:
1. `discoverProject(root)` → DiscoveryReport
2. `loadMemoryCards({ root })` → cards
3. `createInitialCoverage(discovery, { root })` → coverage со всеми unknown
4. `buildAllContentMaps(discovery, cards, { root, buildDir })` → content maps
5. Для каждого файла: `triageDisposition(file, content, cards)` → обновить coverage
6. Если >30% still unknown после triage → throw с диагностикой
7. Сохранить coverage в `.ai/memory/source-coverage.json`
8. Сохранить content maps в `.ai/memory-build/latest/source-content-map.jsonl`
9. Вернуть TriageResult

#### Новый файл: `src/commands/triage.ts`

```typescript
export async function triageCommand(options: {
  root?: string;
  buildDir?: string;
  json?: boolean;
}): Promise<void>;
```

#### Файл: `src/cli.ts`

Добавить команду:

```typescript
program
  .command("triage")
  .description("Run automatic source triage")
  .option("--build-dir <dir>", "Build directory")
  .option("--json", "JSON output")
  .action(async (opts) => {
    await triageCommand({ root: program.opts().root, ...opts });
  });
```

#### Файл: `src/scaffold/templates/tools/memory.ts`

Добавить tool `triage`:

```typescript
tool({
  name: "triage",
  description: "Run automatic source triage",
  parameters: z.object({
    root: z.string().optional(),
  }),
  async execute({ root }) {
    // calls `repo-memory triage --json`
  },
}),
```

#### Файл: `src/core/bootstrapMemory.ts`

Bootstrap автоматически вызывает triage после создания cards (уже частично в B1, теперь с content maps):

```typescript
// В bootstrapMemory(), после создания cards:

const triage = await triageSources({ root, buildDir: buildDirPath });
result.triageUpdated = triage.updated;
result.triageStillUnknown = triage.stillUnknown;
result.contentMapPath = triage.contentMapPath;
```

### 8.3. Acceptance criteria

- [ ] `triageSources` обновляет все `unknown` dispositions
- [ ] `triageSources` создаёт source-content-map.jsonl
- [ ] Если >30% still unknown → throw с диагностикой
- [ ] CLI `repo-memory triage` работает
- [ ] OpenCode tool `triage` работает
- [ ] Bootstrap автоматически вызывает triage

### 8.4. Тесты

`test/triage.test.ts` (новый):
- triageSources на synapse-mini: все dispositions != unknown
- triageSources: >30% unknown → throw
- triageSources: создаёт source-content-map.jsonl
- triageSources: сохраняет source-coverage.json
- CLI triage: --json выводит valid JSON
- bootstrap: triageUpdated > 0

---

## 9. Эпик C1 — Specialist dispatch gating (soft advisory)

> **Пользовательское решение (binding)**: Soft advisory — record dispatch attempts in JSONL, warn on mismatches, NO hard-gate validation. OpenCode fresh-subagent-isolation already enforces isolation. `finalizeDispatch()`, `specialist-dispatch.json`, `--require-specialist-dispatch` (error-producing) — НЕ переносятся. Только `specialist-attempts.jsonl` с advisory warnings.

### 9.1. Постановка

v3 hard-gate'ит что specialist phases реально вызваны через `task` tool с точным agent name. В OpenCode-only контексте с fresh-subagent-isolation это избыточно — нужна только audit trail и advisory warnings.

### 9.2. Изменения

#### Новый файл: `src/schemas/dispatch.ts`

```typescript
import { z } from "zod";

export const SpecialistPhaseSchema = z.enum([
  "discovery-semantic",
  "code-evidence",
  "rationale-extraction",
  "quality-review",
]);
export type SpecialistPhase = z.infer<typeof SpecialistPhaseSchema>;

export const DispatchModeSchema = z.enum([
  "named-task",
  "skipped-no-applicable-work",
  "missing-attempt",
]);
export type DispatchMode = z.infer<typeof DispatchModeSchema>;

// Mapping phase → expected agent (ts-kb-flow agents)
export const SPECIALIST_PHASE_AGENTS: Record<SpecialistPhase, string> = {
  "discovery-semantic": "memory-extractor",
  "code-evidence": "memory-coder",
  "rationale-extraction": "memory-analyst",
  "quality-review": "memory-reviewer",
};

// Generic agent names, не могут быть specialists
export const GENERIC_AGENT_NAMES = new Set([
  "explore", "general", "plan", "task", "sonic",
  "librarian", "reviewer", "oracle", "designer",
]);

export const SpecialistAttemptSchema = z.object({
  attemptId: z.string(),  // SHA-256[:16]
  phase: SpecialistPhaseSchema,
  expectedAgent: z.string(),
  requestedAgent: z.string(),
  actualAgent: z.string(),
  tool: z.string(),  // must be "task"
  runtime: z.literal("opencode"),
  status: z.enum(["named-task", "skipped-no-applicable-work", "missing-attempt"]),
  session: z.string().optional(),
  toolCallId: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type SpecialistAttempt = z.infer<typeof SpecialistAttemptSchema>;

// NOTE: SpecialistDispatchEntrySchema, SpecialistDispatchSchema, SpecialistDispatch — НЕ переносятся (soft advisory, 0.2 Решение 1).
// Только specialist-attempts.jsonl с advisory warnings.
```

#### Новый файл: `src/core/dispatch.ts`

```typescript
import {
  SpecialistAttempt, SpecialistAttemptSchema,
  SpecialistPhase, SPECIALIST_PHASE_AGENTS,
  GENERIC_AGENT_NAMES,
} from "../schemas/dispatch";
import { createHash } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

const ATTEMPTS_PATH = ".ai/memory-build/latest/specialist-attempts.jsonl";

/**
 * Записывает dispatch attempt в JSONL.
 */
export async function recordDispatchAttempt(
  attempt: Omit<SpecialistAttempt, "attemptId" | "timestamp">,
  options?: { root?: string }
): Promise<string>;  // returns attemptId

/**
 * Детектирует impersonation в attempt.
 */
export function detectImpersonation(attempt: SpecialistAttempt): {
  isImpersonation: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const textToCheck = [attempt.notes, attempt.description]
    .filter(Boolean)
    .join(" ");

  // Regex patterns (из v3)
  const impersonationPatterns = [
    /ты\s—\s/i, /you\s+are\s+/i, /impersonat/i,
    /role\s+impersonation/i, /explore\s+task/i, /general\s+task/i,
  ];

  for (const pattern of impersonationPatterns) {
    if (pattern.test(textToCheck)) {
      reasons.push(`impersonation pattern matched: ${pattern.source}`);
    }
  }

  // Generic agent name check
  if (GENERIC_AGENT_NAMES.has(attempt.actualAgent)) {
    reasons.push(`generic agent name "${attempt.actualAgent}" cannot be specialist`);
  }

  // Builder self-execution check
  if (attempt.actualAgent === "memory-reviewer" && attempt.phase === "quality-review") {
    // memory-reviewer IS the expected agent for quality-review — ok
    // но если builder (orchestrator) пытается быть specialist — error
  }

  // Tool must be "task"
  if (attempt.tool !== "task") {
    reasons.push(`tool must be "task", got "${attempt.tool}"`);
  }

  return { isImpersonation: reasons.length > 0, reasons };
}

/**
 * Advisory проверка dispatch: загружает attempts, проверяет impersonation, возвращает warnings.
 * НЕ возвращает errors — soft advisory (0.2 Решение 1).
 */
export async function checkDispatchAdvisory(
  options?: { root?: string }
): Promise<{ warnings: string[]; attemptsChecked: number }>;
```

Логика `checkDispatchAdvisory`:
1. Загрузить `specialist-attempts.jsonl` (если нет — return empty warnings)
2. Для каждой попытки: `detectImpersonation()` → warnings (не errors)
3. Вернуть { warnings, attemptsChecked }

#### Файл: `src/core/validate.ts`

Добавить dispatch advisory (флаг `checkDispatch`, warnings only):

```typescript
// В validateMemory(), после шага 11 (source coverage):

// ШАГ 12: Specialist dispatch advisory (если --check-dispatch, warnings only)
if (options?.checkDispatch) {
  const advisory = await checkDispatchAdvisory({ root });
  warnings.push(...advisory.warnings);  // warnings, НЕ errors
}
```

### 9.3. Acceptance criteria

- [ ] `recordDispatchAttempt` записывает в JSONL
- [ ] `detectImpersonation` выдаёт warnings для generic agent names (explore, general, etc.)
- [ ] `detectImpersonation` выдаёт warnings для `tool != "task"`
- [ ] `detectImpersonation` выдаёт warnings для impersonation patterns (`ты — q-`, `you are q-`)
- [ ] `checkDispatchAdvisory` возвращает warnings (не errors)
- [ ] `validate --check-dispatch` показывает warnings
- [ ] NO `finalizeDispatch`, NO `specialist-dispatch.json`, NO `--require-specialist-dispatch`

### 9.4. Тесты

`test/dispatch.test.ts` (новый):
- recordDispatchAttempt: записывает в JSONL
- recordDispatchAttempt: attemptId = SHA-256[:16]
- detectImpersonation: generic agent name → isImpersonation=true
- detectImpersonation: `ты — q-` pattern → isImpersonation=true
- detectImpersonation: tool != "task" → isImpersonation=true
- detectImpersonation: valid attempt → isImpersonation=false
- checkDispatchAdvisory: возвращает warnings (не errors)
- checkDispatchAdvisory: empty JSONL → empty warnings
- checkDispatchAdvisory: impersonation attempt → warning

---

## 10. Эпик C2 — Specialist findings JSONL format (DEFERRED)

> **⏸️ DEFERRED (Phase 1 non-goal)**. **Пользовательское решение (binding)**: Specialist findings JSONL не переносится в Phase 1. Agents читают cards directly via context pack. Если в Phase 2+ понадобится bounded build context — revisit. См. 0.2 Решение 2.

---

## 11. Эпик C3 — Builder input pack (DEFERRED)

> **⏸️ DEFERRED (Phase 1 non-goal)**. **Пользовательское решение (binding)**: Builder input pack не переносится в Phase 1. Agents читают cards directly. Если в Phase 2+ понадобится bounded build context — revisit. См. 0.2 Решение 2.

---

## 12. Эпик C4 — Contract-first init/plan/check

### 12.1. Постановка

v3 `check` валидирует 9 категорий. ts-kb-flow `validate` валидирует frontmatter, policy, evidence, relations — но не structural completeness, source coverage, specialist dispatch. Нужно расширить validate до 9-уровневой проверки + добавить `plan` команду.

### 12.2. Изменения

#### Файл: `src/core/validate.ts`

Расширить `validateMemory()` до 12-уровневой проверки (существующие 10 + новые из A2, B1, C1):

```
1. Frontmatter existence и Zod-валидация (существующее)
2. Unknown frontmatter keys + Levenshtein suggestions (существующее)
3. Duplicate id detection (существующее)
4. Policy invariants (proposal/current, historical/code_gen, etc.) (существующее)
5. Evidence level vs status cross-checks (существующее)
6. Evidence sections (code_confirmed/test_confirmed require body sections) (существующее)
7. Broken relation ID checks (существующее)
8. Code/test ref path existence (существующее)
9. Card sections validation (A2) — НОВОЕ
10. Runtime tier mismatch warnings (A4) — НОВОЕ
11. Source coverage validation (B1, --require-source-coverage) — НОВОЕ
12. Specialist dispatch advisory (C1, --check-dispatch, warnings only) — НОВОЕ
13. Structural completeness — НОВОЕ
14. Markdown links resolution — НОВОЕ
15. Warnings: version mentions, long code blocks, error budget — НОВОЕ
```

Добавить `checkStructural()`:

```typescript
/**
 * Проверяет структурную полноту memory bank.
 */
export function checkStructural(
  memoryRoot: string,
  cards: MemoryCard[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 4 index cards (MEMORY.md, MODULES.md, DECISIONS.md, ARCHITECTURE.md)
  const requiredTopLevel = [
    "MEMORY.md", "PROJECT.md", "MODULES.md", "ARCHITECTURE.md",
    "TASK_ROUTING.md", "FLOWS.md", "TESTING.md", "OPS.md",
    "GOTCHAS.md", "DECISIONS.md",
  ];

  for (const file of requiredTopLevel) {
    const filePath = path.join(memoryRoot, file);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing required top-level file: ${file}`);
    }
  }

  // 5 поддиректорий
  const requiredSubdirs = ["modules", "flows", "decisions", "reference", "architecture"];
  for (const dir of requiredSubdirs) {
    const dirPath = path.join(memoryRoot, dir);
    if (!fs.existsSync(dirPath)) {
      errors.push(`Missing required subdirectory: ${dir}/`);
    }
  }

  // MODULES.md должен иметь production/demo/shared split
  const modulesPath = path.join(memoryRoot, "MODULES.md");
  if (fs.existsSync(modulesPath)) {
    const content = fs.readFileSync(modulesPath, "utf-8");
    if (!/production/i.test(content) || !/demo/i.test(content)) {
      warnings.push("MODULES.md should have production/demo/shared tier split");
    }
  }

  // ARCHITECTURE.md должен иметь "Architecture by submodule" section
  // OR architecture/*.md must exist
  const archPath = path.join(memoryRoot, "ARCHITECTURE.md");
  const archDir = path.join(memoryRoot, "architecture");
  if (fs.existsSync(archPath)) {
    const content = fs.readFileSync(archPath, "utf-8");
    if (!/Architecture by submodule/i.test(content) && !fs.existsSync(archDir)) {
      warnings.push('ARCHITECTURE.md should have "Architecture by submodule" section or architecture/*.md files');
    }
  }

  return { errors, warnings };
}
```

Добавить `checkMarkdownLinks()`:

```typescript
/**
 * Проверяет что все intra-repo Markdown links разрешаются.
 */
export function checkMarkdownLinks(
  cards: MemoryCard[],
  memoryRoot: string
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];

  for (const card of cards) {
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkPattern.exec(card.body)) !== null) {
      const linkPath = match[2];
      // Skip external links
      if (/^https?:\/\//.test(linkPath)) continue;
      // Skip anchor links
      if (linkPath.startsWith("#")) continue;

      // Resolve relative to card directory
      const cardDir = path.dirname(card.path);
      const resolved = path.resolve(cardDir, linkPath);
      if (!fs.existsSync(resolved)) {
        errors.push(`Card "${card.meta.id}": broken markdown link "${linkPath}"`);
      }
    }
  }

  return { errors, warnings: [] };
}
```

Добавить warnings (version mentions, long code blocks):

```typescript
// В validateMemory(), в конце:
// Long code blocks (25+ lines)
for (const card of cards) {
  const codeBlockPattern = /```[\s\S]*?```/g;
  const matches = card.body.match(codeBlockPattern) ?? [];
  for (const block of matches) {
    const lines = block.split("\n").length - 2;  // minus opening/closing ```
    if (lines > 25) {
      warnings.push(`Card "${card.meta.id}": code block with ${lines} lines (consider summarizing)`);
    }
  }
}

// Error budget
const maxErrors = options?.maxErrors ?? 50;
if (errors.length > maxErrors) {
  errors.splice(maxErrors);
  errors.push(`... truncated at ${maxErrors} errors (use --max-errors to increase)`);
}
```

#### Расширение `RepoMemoryOptions` (см. A2):

```typescript
export type RepoMemoryOptions = {
  root?: string;
  memoryRoot?: string;
  staleProposalDays?: number;
  requireSourceCoverage?: boolean;
  checkDispatch?: boolean;
  maxErrors?: number;
  strictWarnings?: boolean;
};
```

#### Файл: `src/commands/validate.ts`

Расширить команду `validate`:

```typescript
// Добавить флаги:
program
  .command("validate")
  .option("--json", "JSON output")
  .option("--strict-warnings", "Treat warnings as errors")
  .option("--require-source-coverage", "Require source-coverage.json")
  .option("--check-dispatch", "Check dispatch advisory (warnings only)")
  .option("--max-errors <n>", "Max errors before truncation", "50")
  .action(async (opts) => {
    await validateMemoryCommand({
      root: program.opts().root,
      ...opts,
      maxErrors: parseInt(opts.maxErrors, 10),
    });
  });
```

#### Новый файл: `src/core/plan.ts`

```typescript
export interface PlanResult {
  planPath: string;      // .ai/memory-build/latest/card-plan.md
  requiredCards: string[];
  candidateModuleCards: { id: string; runtimeTier: string }[];
  candidateArchitectureCards: { id: string }[];
}

/**
 * Генерирует card-plan.md — checklist необходимых карточек.
 */
export async function generatePlan(options?: {
  root?: string;
  buildDir?: string;
  scaffoldModules?: boolean;  // создать stub-файлы
}): Promise<PlanResult>;
```

Логика `generatePlan`:
1. `discoverProject(root)` → DiscoveryReport
2. Составить checklist:
   - Required top-level cards (10 файлов)
   - Candidate module cards per detected module с runtime tier
   - Candidate architecture cards per detected module
3. Если `scaffoldModules` — создать stub-файлы
4. Записать `card-plan.md`
5. Вернуть PlanResult

#### Новый файл: `src/commands/plan.ts`

```typescript
export async function planCommand(options: {
  root?: string;
  buildDir?: string;
  scaffoldModules?: boolean;
  json?: boolean;
}): Promise<void>;
```

#### Файл: `src/cli.ts`

Добавить команду `plan`:

```typescript
program
  .command("plan")
  .description("Generate card plan from discovery")
  .option("--build-dir <dir>", "Build directory")
  .option("--scaffold-modules", "Create module/architecture stubs")
  .option("--json", "JSON output")
  .action(async (opts) => {
    await planCommand({ root: program.opts().root, ...opts });
  });
```

#### Файл: `src/core/init.ts` (или `src/commands/init.ts`)

Расширить `init` — создавать `memory-contract.json`:

```typescript
// В initMemory():
const contractPath = path.join(memoryRoot, "memory-contract.json");
const contract = {
  version: 2,
  language: "ru",
  requiredTopLevel: [
    "MEMORY.md", "PROJECT.md", "MODULES.md", "ARCHITECTURE.md",
    "TASK_ROUTING.md", "FLOWS.md", "TESTING.md", "OPS.md",
    "GOTCHAS.md", "DECISIONS.md",
  ],
  requiredSubdirs: ["modules", "flows", "decisions", "reference", "architecture"],
  dispositions: ["extracted", "rationale-only", "superseded",
    "historical-only", "rejected", "deferred", "unknown"],
  specialistPhases: ["discovery-semantic", "code-evidence",
    "rationale-extraction", "quality-review"],
};
await fs.writeFile(contractPath, JSON.stringify(contract, null, 2));
```

### 12.3. Acceptance criteria

- [ ] `validate` без флагов: 15 шагов, существующие 8 + новые 7
- [ ] `validate --require-source-coverage` проверяет coverage (B1)
- [ ] `validate --check-dispatch` показывает dispatch warnings (C1)
- [ ] `validate --max-errors 10` обрезает после 10 ошибок
- [ ] `checkStructural` отклоняет missing top-level files
- [ ] `checkStructural` отклоняет missing subdirs
- [ ] `checkStructural` warns на MODULES.md без tier split
- [ ] `checkMarkdownLinks` отклоняет broken links
- [ ] `validate` warns на code blocks > 25 lines
- [ ] `init` создаёт `memory-contract.json`
- [ ] `plan` генерирует card-plan.md
- [ ] `plan --scaffold-modules` создаёт stub-файлы

### 12.4. Тесты

`test/validate.test.ts`:
- Расширить: validate с --require-source-coverage без coverage → error
- Расширить: validate с --check-dispatch без attempts → empty warnings (не error)
- Новый: validate --max-errors 5 → truncation после 5
- Новый: validate на missing top-level file → error
- Новый: validate на missing subdir → error
- Новый: validate на broken markdown link → error
- Новый: validate на code block > 25 lines → warning
- Новый: validate на MODULES.md без tier split → warning

`test/plan.test.ts` (новый):
- generatePlan: создаёт card-plan.md
- generatePlan: plan содержит 10 required top-level cards
- generatePlan: plan содержит candidate module cards
- generatePlan --scaffold-modules: создаёт stub-файлы
- CLI plan: --json outputs valid JSON

`test/init.test.ts` (новый или расширить):
- initMemory: создаёт memory-contract.json
- memory-contract.json содержит requiredTopLevel с 10 файлами
- memory-contract.json содержит dispositions с 7 значениями

---

## 13. Сводка изменений по файлам

### Новые файлы (13)

| Файл | Эпик |
|---|---|
| src/schemas/cardSections.ts | A2 |
| src/schemas/docFrontmatter.ts | A3 |
| src/schemas/sourceCoverage.ts | B1 |
| src/schemas/sourceContentMap.ts | B2 |
| src/schemas/dispatch.ts | C1 |
| src/core/cardSections.ts | A2 |
| src/core/docValidate.ts | A3 |
| src/core/runtimeTier.ts | A4 |
| src/core/sourceCoverage.ts | B1 |
| src/core/contentMap.ts | B2 |
| src/core/dispatch.ts | C1 |
| src/core/plan.ts | C4 |
| src/commands/triage.ts | B3 |
| src/commands/plan.ts | C4 |
| test/*.test.ts (10 новых) | All |

> **Note**: C2 (findings.ts, finding.ts) и C3 (builderPack.ts, pack.ts) файлы — НЕ создаются в Phase 1 (DEFERRED).

### Изменяемые файлы (8)

| Файл | Эпик | Что меняется |
|---|---|---|
| src/schemas/frontmatter.ts | A1 | EntityTypeSchema: 11→20 значений, +RuntimeTierSchema, +SourceStatusSchema, MemoryFrontmatterSchema +2 поля |
| src/core/types.ts | A2, B1, C1 | RepoMemoryOptions +4 поля (requireSourceCoverage, checkDispatch, maxErrors, strictWarnings) |
| src/core/validate.ts | A2, A4, B1, C1, C4 | +7 новых шагов валидации, +checkStructural, +checkMarkdownLinks, +checkDispatchAdvisory |
| src/core/bootstrapMemory.ts | A1, A4, B1, B3 | +4 index cards, +2 поддиректории, +triage, +runtime_tier, BootstrapResult расширен |
| src/core/updateMemory.ts | A2 | +soft warning для missing sections |
| src/core/context.ts | A3 | исключить drafts (фактически уже исключены, добавить тест) |
| src/commands/validate.ts | C4 | +3 флага (--require-source-coverage, --check-dispatch, --max-errors, --strict-warnings) |
| src/commands/init.ts | C4 | +memory-contract.json создание |
| src/cli.ts | B3, C4 | +2 команды (triage, plan) |
| src/scaffold/templates.ts | A1, A3 | +9 scaffold-файлов (4 index cards + 2 .gitkeep + docs/drafts .gitkeep + memory-contract.json) |
| src/scaffold/templates/tools/memory.ts | B3 | +1 tool (triage) |
| src/index.ts | All | экспорт новых модулей |

### CLI-команды: 11 → 13

Существующие (11): init, ls, show, related, context, validate, discover, bootstrap, ingest-spec, reconcile, update

Новые (2): triage, plan

### OpenCode tools: 6 → 7

Существующие (6): context, validate, related, discover, bootstrap, updateCard

Новые (1): triage

---

## 14. Порядок реализации

Рекомендуемая последовательность с учётом зависимостей:

```
A1 (card types + runtime_tier)           ────┐
    A2 (section contracts)                    ──┤
    A3 (docs/drafts ontology)                ──┤
    A4 (runtime tier logic)                  ──┤
    B1 (source coverage schema + triage)     ──┤── B3 (triage pipeline) ──┐
                                             │                         │
    B2 (content maps)                         ──┘                         │
                                                                       │
    C1 (dispatch advisory, soft)          ─────────────────────────────  ┤
                                                                       │
    C4 (contract-first validate + plan)    ─────────────────────────────  ┘
```

**Milestone 1** (A1-A4): Расширенная модель памяти. Можно валидировать и bootstrap с новыми типами.
**Milestone 2** (B1-B3): Source coverage + content maps. Bootstrap создаёт coverage, triage работает.
**Milestone 3** (C1): Dispatch advisory JSONL. Запись попыток, impersonation warnings.
**Milestone 4** (C4): Contract-first validate. Полная валидация + plan команда.

---

## 15. Метрики Phase 1

| Метрика | До | После |
|---|---|---|
| Entity types | 11 | 20 |
| CLI-команды | 11 | 13 |
| OpenCode tools | 6 | 7 |
| Scaffold-файлы | 28 | 37 |
| Validate шагов | 10 | 14 |
| Zod-схем | 11 | 17 |
| Core-модулей | 18 | 25 |
| Тестов | 115 | ~180 |
| Версия | 0.1.0 | 0.5.0 |

---

## 16. Execution status

Base commit: `0403353125eae5d727ab8d6c10d9d76894f1f69a` (branch `v/kb-openspec`)
Baseline: 127 tests pass, build clean.

| Lane key | Epic | Status | Session | Dispatch |
|---|---|---|---|---|
| implementation/A1-card-types-runtime-tier | A1 | COMPLETE | ses_0a97e736cffeUD0tzcT1o3NP7l | FRESH |
| implementation/A2-section-contracts | A2 | COMPLETE | ses_0a976d2abffecf5w9eB6tg7HeA | FRESH |
| implementation/A3-docs-drafts-ontology | A3 | COMPLETE | ses_0a97ae3e8ffekajzrXhHg0nS8u | FRESH |
| implementation/A4-runtime-tier-logic | A4 | COMPLETE | ses_0a96fef0bffeAfRZl9TM20E5hr | FRESH |
| implementation/B1-source-coverage | B1 | COMPLETE | ses_0a96cf97dffesn6nqtqox7dXzv | FRESH |
| implementation/B2-content-maps | B2 | COMPLETE | ses_0a97ac4e4ffeKvIIv1ULxWHarY | FRESH |
| implementation/B3-triage-pipeline | B3 | COMPLETE | ses_0a9678daeffe3tDB0OGuqZl1MY | FRESH (2 prior corrupted) |
| implementation/C1-dispatch-advisory | C1 | COMPLETE | ses_0a969d676ffecdUsp05u3ifnG5 | FRESH |
| implementation/C4-contract-first-validate | C4 | COMPLETE | ses_0a96315b7ffecWOEbrbHr2vuDK | FRESH (2 prior interrupted) |
| review-correction/phase1-fixes | REVISE | COMPLETE | ses_0a95190fdffezLjO6uYlN687Yu | FRESH |
| final-council | REVIEW | APPROVE | ses_0a94c308fffeuedU6bI3Xl1TTl | FRESH |

Execution order (respecting file-write conflicts on shared mutable files):
1. A1 (foundation: frontmatter.ts, templates.ts, bootstrapMemory.ts)
2. A3 + B2 (parallel: no shared files)
3. A2 (validate.ts, updateMemory.ts, types.ts)
4. A4 (validate.ts, bootstrapMemory.ts)
5. B1 (validate.ts, bootstrapMemory.ts)
6. C1 + B3 (parallel: C1→validate.ts, B3→bootstrapMemory.ts — no overlap)
7. C4 (validate.ts, commands, plan, cli, init, templates)

## 17. Non-goals Phase 1

Следующие возможности НЕ входят в Phase 1 (binding решения, см. 0.2):

- **Specialist findings JSONL (C2)** — deferred. Agents читают cards directly. Revisit в Phase 2 если нужен bounded build context.
- **Builder input pack (C3)** — deferred. Agents читают cards directly. Revisit в Phase 2.
- **Hard-gate dispatch validation (C1)** — not needed. OpenCode fresh-subagent-isolation обеспечивает изоляцию. Только soft advisory warnings.
- **specialist-dispatch.json** — только JSONL attempts, no finalized dispatch ledger.
- **OPS/GOTCHAS/TESTING/TASK_ROUTING cards** — deferred до Phase 2-3 когда их фичи переносятся (D, E, F, G домены). entity_type enum включает все 20 значений, но scaffold создаёт только 4 index cards.
- **Semantic repair (D1-D3)** — Phase 2.
- **Legacy ingestion (E1-E4)** — Phase 2.
- **Workflow routing (G1-G4)** — Phase 3.
- **Git hooks (H1)** — Phase 3.
- **CI integration (H2)** — Phase 3.
- **OpenSpec (H3)** — Phase 3 (опционально).