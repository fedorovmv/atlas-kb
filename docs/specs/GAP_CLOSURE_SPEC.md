# Спецификация закрытия гэпов: перенос функционала v3 в ts-kb-flow

## 0. Контекст и цель

**Цель**: TypeScript-реализация `ts-kb-flow` (`repo-memory-opencode-kit`) объявляется целевой. Она должна получить весь функционал v3 (3.6.19), но только под OpenCode runtime (без OMP dual-runtime).

**Исключено из переноса**:
- Oh My Pi (OMP) адаптеры, плагины, расширения, watchdog
- Dual-runtime команды и декларативные адаптеры для OMP
- Всё, что не относится к memory bank и workflow orchestration

**Принципы переноса**:
1. Сохранить сильные стороны ts-kb-flow: Zod-типизация, claim-evidence модель, atomic writes, best-effort loading
2. Перенести недостающие механизмы v3, адаптировав к TypeScript-стеку
3. Не дублировать: если v3-фича уже есть в ts-kb-flow в другой форме — расширить, не переписывать
4. CLI/LLM-разделение труда сохраняется: CLI детерминирован, LLM вызывается через OpenCode agents
5. Контракт-first подход v3: required cards, source coverage, specialist dispatch gating — переносятся как обязательные

**Базовая paths-конвенция ts-kb-flow**:
- Memory: `.ai/memory/*.md`
- Config: `.ai/memory-tool/config/`
- Build intermediates: `.ai/memory-build/latest/`
- OpenCode: `.opencode/`

---

### 0.1. Пользовательские решения (binding)

Следующие 4 решения приняты в ходе design discovery и являются binding-ограничениями для ВСЕХ фаз, не только Phase 1.

#### Решение 1: Dispatch gating — Soft advisory

v3's hard-gate dispatch (impersonation detection, generic agent rejection, hard-gate validation) был разработан для OMP dual-runtime, где builder agents могут имперсонировать specialists. В контексте OpenCode-only с уже enforced fresh-subagent-isolation полный hard-gate не нужен.

**Binding решение**: Soft advisory — записывать dispatch попытки в JSONL для аудита, предупреждать о несоответствиях, БЕЗ hard-gate валидации, которая генерирует ошибки. OpenCode fresh-subagent-isolation уже обеспечивает изоляцию.

**Влияние**: C1 упрощён (нет finalizeDispatch, нет specialist-dispatch.json, только warnings). C2/C3 больше не нужны для dispatch enforcement.

#### Решение 2: Build pipeline — Content maps only

v3 разделяет детерминированный CLI и LLM-работу через build pipeline: specialist findings JSONL → bounded builder input pack (24KB) → synthesize. ts-kb-flow использует direct bootstrap + OpenCode agents, читающие cards напрямую.

**Binding решение**: Перенести source content maps (navigation index с topics/components/sectionMap/targetCards). ПРОПУСТИТЬ specialist findings JSONL и builder input pack. Agents читают cards напрямую через context pack.

**Влияние**: C2 (Specialist findings JSONL) — ОТЛОЖЕН до Phase 2+, только если будет доказана необходимость. C3 (Builder input pack) — ОТЛОЖЕН до Phase 2+, только если будет доказана необходимость. Content maps (B2) остаются в Phase 1.

#### Решение 3: Card structure — Hybrid

v3 имеет 10 top-level memory файлов. ts-kb-flow сейчас имеет README.md, ontology.md, product-map.md + subdirectories.

**Binding решение**: Сохранить существующие README.md, ontology.md, product-map.md. Добавить 4 index card: MEMORY.md, MODULES.md, DECISIONS.md, ARCHITECTURE.md. Добавить 2 subdirs: flows/, architecture/. Пропустить OPS.md, GOTCHAS.md, TESTING.md, TASK_ROUTING.md, reference/ до тех пор, пока они не потребуются в более поздних фазах.

**Влияние**: A1 scaffold создаёт 4 index card + 2 subdirs (не 10 top-level файлов + 5 subdirs). enum entity_type всё ещё расширяется до 20 значений (все типы доступны), но только 4 index card scaffold'ятся в Phase 1. OPS/GOTCHAS/TESTING/TASK_ROUTING cards отложены до Phase 2-3, когда их фичи будут перенесены (D, E, F, G домены).

#### Решение 4: Compatibility — Soft constraint

**Binding решение**: Существующие cards должны работать, но минорные breaking changes допустимы, если они улучшают модель. Предоставить migration command. Bump до v0.5.0 сигнализирует об изменении.

**Влияние**: Новые frontmatter поля (runtime_tier, source_status) опциональны. Существующие cards без этих полей продолжают валидироваться. Migration command (`repo-memory migrate`) auto-fills runtime_tier, создаёт отсутствующие index cards, запускает triage.

---

## 1. Таксономия гэпов

Гэпы сгруппированы по 8 доменам, каждый домен разбит на эпики. Полный перечень — 30 эпиков.

| Домен | Эпиков | Приоритет | Зависимости |
|---|---|---|---|
| A. Модель памяти и карточек | 4 | P0 | нет |
| B. Source coverage и triage | 3 | P0 | A |
| C. Build pipeline и specialist dispatch | 4 | P0 | B |
| D. Semantic repair | 3 | P1 | B, C |
| E. Legacy ingestion | 4 | P1 | A, B |
| F. Context и retrieval | 6 | P1 | A |
| G. Workflow orchestration | 4 | P2 | F |
| H. Integration и automation | 3 | P2 | G |

---

## 2. Существующее покрытие (не гэпы)

Следующие возможности ts-kb-flow уже покрывают v3-аналоги и не требуют переноса:

| Возможность | v3-аналог | Статус ts-kb-flow |
|---|---|---|
| Frontmatter-схема с типизацией | memory_card_type frontmatter | ✅ Zod-схема, 12 entity_type |
| Claim extraction + evidence | specialist findings (JSONL) | ✅ ClaimSchema + EvidenceSchema, канонизация, дедуп |
| Cross-spec relation detection | source coverage relations | ✅ Jaccard ≥0.3 + supersedes keyword |
| Card update с валидацией | memoryctl update | ✅ updateMemoryCard с evidence guard |
| Reconcile с fixes | memoryctl check | ✅ reconcileMemory + --fix (idempotent) |
| Spec actuality classification | triage-sources classification | ✅ classifySpecActuality (6 статусов) |
| Context pack | contextctl build_context | ✅ buildMemoryContext (лексический скоринг) |
| Model routing config | policy.json model routing | ✅ model-routing.yaml + 4 агента |
| OpenCode commands/skills/tools | .opencode/ commands | ✅ 4 slash-commands, 4 skills, 6 tools |
| Placeholder detection | placeholder regex (v3.6.19) | ✅ в validate.ts |

---

## 3. Детализация гэпов по доменам

---

### Домен A. Модель памяти и карточек (P0)

#### A1. Расширение набора card types

**Гэп**: v3 имеет 10 card types (module, flow, decision, reference, project, routing, testing, ops, gotchas, index). ts-kb-flow имеет 12 entity_type, но не моделирует: `flow`, `ops`, `gotchas`, `task_routing`, `reference`, `testing` как самостоятельные карточки.

**v3-механизм**: `CARD_TYPES` в memoryctl.py (L121-140) определяет обязательные секции для каждого типа карточки:
- module: 13 секций (responsibilities, non-responsibilities, current behavior, related scenarios, related decisions, code refs, test refs, known risks, open questions, rationale, public surface, dependencies, boundaries)
- flow: 10 секций (goal, actors, sequence, fallback, constraints, errors, related modules, related tests, rationale, state transitions)
- decision: 10 секций (context, problem, decision, rationale, alternatives, rejected, consequences, evidence, affected modules, affected scenarios)
- reference: 7 секций
- testing: секции (layers, commands, coverage, gaps)
- ops: секции (deployment, config, diagnostics)

**Требования к портированию**:

1. Расширить `MemoryFrontmatterSchema` (src/schemas/frontmatter.ts) новыми entity_type значениями:
   - `flow`, `ops`, `gotchas`, `task_routing`, `testing`, `reference`, `project`, `index`
   - Текущие: module, scenario, decision, proposal, historical, conflict, open_question, architecture, product_map, ontology, readme

2. Добавить `CARD_SECTION_CONTRACTS` — map entity_type → массив обязательных названий секций:
   ```typescript
   export const CARD_SECTION_CONTRACTS: Record<EntityType, SectionContract> = {
     module: {
       required: ['## Responsibilities', '## Non-responsibilities', '## Current behavior',
                  '## Related scenarios', '## Related decisions', '## Code references',
                  '## Test references', '## Known risks', '## Open questions',
                  '## Why these boundaries', '## Public surface', '## Dependencies'],
       recommended: [],
     },
     flow: {
       required: ['## Goal', '## Actors', '## Sequence', '## Fallback',
                  '## Constraints', '## Error handling', '## Related modules',
                  '## Related tests', '## Rationale'],
       recommended: ['## State transitions'],
     },
     decision: {
       required: ['## Context', '## Problem', '## Decision', '## Rationale',
                  '## Alternatives considered', '## Rejected alternatives',
                  '## Consequences', '## Current behavior evidence',
                  '## Affected modules', '## Affected scenarios'],
       recommended: [],
     },
     // ... остальные типы
   };
   ```

3. Добавить `runtime_tier` поле в frontmatter (v3: `production | demo | shared | mixed | historical | unknown`)

4. Расширить `init` и `bootstrapMemory` для создания топ-левел карточек v3-структуры:
   - `MEMORY.md`, `PROJECT.md`, `MODULES.md`, `ARCHITECTURE.md` (index only), `TASK_ROUTING.md`, `FLOWS.md`, `TESTING.md`, `OPS.md`, `GOTCHAS.md`, `DECISIONS.md`
   - Поддиректории: `modules/`, `flows/`, `decisions/`, `reference/`, `architecture/`

**Acceptance criteria**:
- `validate` отклоняет карточку с entity_type=module, у которой отсутствует любая required-секция из CARD_SECTION_CONTRACTS
- `bootstrap` создаёт все 10 топ-левел файлов + 5 поддиректорий
- `runtime_tier` валидируется как enum
- Существующие карточки (scenario, proposal, historical, conflict, open_question) продолжают работать

---

#### A2. Контракт обязательных секций карточек

**Гэп**: v3 валидирует обязательные секции для каждого card type. ts-kb-flow валидирует frontmatter, но не секции Markdown-body.

**Требования**:

1. Реализовать `validateCardSections(card: MemoryCard): ValidationResult` в src/core/validate.ts:
   - Определить текущие секции через парсинг `## ` заголовков
   - Сравнить с `CARD_SECTION_CONTRACTS[card.meta.entity_type].required`
   - Отсутствующая required-секция = ERROR
   - Ошибка указывает: `Card <id>: missing required section "## Rationale" for entity_type "decision"`

2. Интегрировать в `validateMemory` — добавить секционный чек в pipeline валидации

3. Добавить в `updateMemoryCard` проверку: при обновлении body карточки, проверить что все required-секции присутствуют (soft warning, не блокировать — body может быть в процессе заполнения)

**Acceptance criteria**:
- Тест: карточка decision без `## Rationale` → ERROR с указанием секции
- Тест: карточка module со всеми секциями → OK
- Тест: updateMemoryCard с body без required-секции → warning, не throw

---

#### A3. Knowledge ontology: разделение docs / drafts / memory

**Гэп**: v3 разделяет `knowledge/docs/` (канонические docs), `knowledge/drafts/` (нерешённые, исключены из context), `knowledge/memory/` (компактные карточки). ts-kb-flow имеет только `.ai/memory/`.

**v3-механизм**:
- `knowledge/docs/` — канонические human-readable docs с типами: service, reference, decision, runbook, gotcha, guide, index
- `knowledge/drafts/` — нерешённые отчёты, исключённые из normal context
- Статусы docs: active, draft, deprecated, archived
- `kbctl lint` валидирует frontmatter docs: `node_type`, `title`, `service`, `status`, `updated`, `tags`, `links`

**Требования**:

1. Добавить опциональные директории в scaffold:
   - `.ai/docs/` — канонические docs (канонические типы: service, reference, decision, runbook, gotcha, guide, index)
   - `.ai/drafts/` — нерешённые отчёты (исключаются из context pack по умолчанию)

2. Добавить `DocFrontmatterSchema` в src/schemas/:
   ```typescript
   export const DocFrontmatterSchema = z.object({
     node_type: z.enum(['service', 'reference', 'decision', 'runbook', 'gotcha', 'guide', 'index']),
     title: z.string(),
     service: z.string(),
     status: z.enum(['active', 'draft', 'deprecated', 'archived']),
     updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
     tags: z.array(z.string()),
     links: z.record(z.string(), z.string()),
   });
   ```

3. Добавить `validateDocs` в validate.ts:
   - Проверка frontmatter docs на соответствие DocFrontmatterSchema
   - Active docs (не index/decision/guide) должны иметь evidence
   - Body ≥ 40 символов, минимум одна Markdown-ссылка
   - Все локальные Markdown-ссылки должны разрешаться

4. В `buildMemoryContext` исключать `.ai/drafts/` из результатов по умолчанию (флаг `--include-drafts` для override)

**Acceptance criteria**:
- Doc без frontmatter → ERROR
- Doc со status=active без evidence → ERROR
- Drafts не попадают в context pack без `--include-drafts`
- Broken Markdown-ссылка в doc → ERROR

---

#### A4. Runtime tier классификация

**Гэп**: v3 классифицирует карточки по `runtime_tier` (production, demo, shared, mixed, historical, unknown) и валидирует что MODULES.md содержит split по tiers. ts-kb-flow не имеет runtime_tier.

**Требования**:

1. Добавить `runtime_tier` в MemoryFrontmatterSchema (A1 уже объявил enum)

2. Реализовать `classifyRuntimeTier(card: MemoryCard, discovery: DiscoveryReport): RuntimeTier`:
   - Если code_refs указывают на `demo/`, `example/`, `testdata/` → `demo`
   - Если code_refs указывают на production paths + test paths → `mixed`
   - Если только production paths → `production`
   - Если source_status=historical-only → `historical`
   - Если code_refs shared между модулями → `shared`
   - Fallback → `unknown`

3. Bootstrap должен проставлять runtime_tier автоматически

4. Validate должен предупреждать если модуль с demo refs имеет runtime_tier=production

**Acceptance criteria**:
- Demo-код не классифицируется как production
- Bootstrap проставляет runtime_tier для module cards
- Validate выдаёт warning при mismatch

---

### Домен B. Source coverage и triage (P0)

#### B1. Source coverage contract — disposition ledger

**Гэп**: v3 требует что каждый source document получает ровно одну disposition из 7 значений. Это хранится в `source-coverage.json`. ts-kb-flow не имеет этого.

**v3-механизм**:
- Dispositions: `extracted`, `rationale-only`, `superseded`, `historical-only`, `rejected`, `deferred`, `unknown`
- `rejected`/`deferred`/`unknown` требуют `reason`
- `extracted`/`rationale-only`/`superseded` требуют `targetCards[]`
- `historical-only` НЕ должен иметь targetCards
- Хранится в `knowledge/memory/source-coverage.json`

**Требования**:

1. Создать `SourceCoverageSchema` в src/schemas/sourceCoverage.ts:
   ```typescript
   export const DispositionSchema = z.enum([
     'extracted', 'rationale-only', 'superseded',
     'historical-only', 'rejected', 'deferred', 'unknown',
   ]);

   export const SourceCoverageEntrySchema = z.object({
     path: z.string(),
     sha256: z.string(),
     moduleBoundary: z.string().optional(),
     sourceKind: z.enum(['git-tracked', 'working-tree', 'submodule-working-tree']),
     docState: z.string().optional(),
     title: z.string().optional(),
     disposition: DispositionSchema,
     reason: z.string().optional(),
     targetCards: z.array(z.string()).default([]),
   });

   export const SourceCoverageSchema = z.object({
     entries: z.array(SourceCoverageEntrySchema),
     counts: z.record(z.string(), z.number()),
   });
   ```

2. Реализовать `triageDisposition(file: FileRecord, content: string): Disposition` в src/core/triage.ts:
   - Пустой/бинарный → `rejected` (reason: "empty or binary")
   - Содержит deprecated/superseded теги → `superseded`
   - Legacy/archive пути → `historical-only` (если нет arch signals) или `rationale-only` (если есть)
   - Rationale теги → `rationale-only`
   - Current-doc signals (arch/flow/deploy/config/test/ops/API) → `extracted`
   - Заголовки + current-candidate → `extracted` (low confidence)
   - Fallback → `rejected`

3. Интегрировать в `bootstrapMemory`: после discover, создать source-coverage.json с initial `unknown` dispositions, затем прогнать triage

4. Сохранять `source-coverage.json` в `.ai/memory/source-coverage.json`

5. Добавить `--require-source-coverage` флаг к `validate`:
   - Каждый файл из discovery должен быть в coverage
   - `unknown` после triage = ERROR (build bug, не оператор task)
   - `rejected`/`deferred`/`unknown` без reason = ERROR
   - `extracted`/`rationale-only`/`superseded` без targetCards = ERROR
   - `historical-only` с targetCards = ERROR
   - targetCards пути должны существовать

**Acceptance criteria**:
- После bootstrap все source files имеют disposition
- `unknown` после triage триггерит ERROR в validate
- Demo-файлы получают `rejected` или `historical-only`, не `extracted`
- Coverage ledger сохраняется и переживает перезапуск

---

#### B2. Source content maps

**Гэп**: v3 строит `source-content-map.jsonl` — per-source навигационная карта с topics, components, services, section map, target-card hints. ts-kb-flow имеет FileRecord с topics[], но не имеет content maps.

**v3-механизм** (memoryctl.py L1054-1106):
- Каждая запись: `contentMapId` (SHA-256), `path`, `sha256`, `title`, `moduleBoundary`, `classifiers` (sourceType, sourceStatus, memoryIntents[], tags[]), `topics[]`, `components[]`, `services[]`, `referencedPaths[]`, `targetCards[]`, `sectionMap[]` (headings, line ranges, summaries, keyword topics)

**Требования**:

1. Создать `SourceContentMapSchema` в src/schemas/sourceContentMap.ts

2. Реализовать `buildSourceContentMap(file: FileRecord, content: string, cards: MemoryCard[]): SourceContentMap` в src/core/contentMap.ts:
   - Парсить Markdown заголовки → sectionMap
   - Извлекать topics из заголовков, первого параграфа, code blocks
   - Определять components/services по path и content patterns
   - Вычислять targetCards: карточки чьи topics/components пересекаются с файлом
   - Хеш contentMapId = SHA-256 от отсортированного JSON

3. Сохранять `.ai/memory-build/latest/source-content-map.jsonl`

4. Использовать content maps в:
   - `bootstrapMemory` для определения target cards
   - `buildMemoryContext` для навигации
   - `ingestSpec` для связи spec → existing cards
   - `reconcileMemory` для проверки stale refs

**Acceptance criteria**:
- Каждому source file соответствует запись в content-map
- Section map содержит заголовки с line ranges
- targetCards указывают на существующие карточки
- Content map используется в context pack для навигации

---

#### B3. Automatic source triage

**Гэп**: v3 имеет `triage-sources` команду которая детерминированно классифицирует все sources по content. ts-kb-flow не имеет автоматической triage — bootstrap создаёт карточки, но не обеспечивает coverage ledger.

**Требования**:

1. Реализовать `triageSources(options: { root: string, buildDir?: string }): TriageResult` в src/core/triage.ts:
   - Читает source inventory (из discovery)
   - Для каждого файла: парсит content, извлекает signals, определяет disposition (B1)
   - Строит source content map (B2)
   - Обновляет source-coverage.json: заменяет `unknown` на конкретный disposition
   - Возвращает triage report

2. Добавить CLI-команду `triage`:
   ```bash
   repo-memory triage [--root <path>] [--build-dir <dir>] [--json]
   ```

3. Добавить OpenCode tool `triage` в tools/memory.ts

4. Bootstrap должен автоматически вызывать triage после discover

5. Если после triage много `unknown` — остановить с диагностикой (не требовать ручного заполнения)

**Acceptance criteria**:
- `triage` обновляет все `unknown` dispositions на конкретные
- Если >30% `unknown` после triage — ERROR с диагностикой
- CLI и OpenCode tool работают идентично
- Bootstrap автоматически вызывает triage

---

### Домен C. Build pipeline и specialist dispatch (P0)

#### C1. Specialist dispatch gating (soft advisory)

> **Пользовательское решение (binding)**: Soft advisory — record dispatch attempts in JSONL, warn on mismatches, NO hard-gate validation. OpenCode fresh-subagent-isolation already enforces isolation. Следовательно: `finalizeDispatch()`, `specialist-dispatch.json`, и `--require-specialist-dispatch` (как error-producing flag) — НЕ переносятся. Только `specialist-attempts.jsonl` с advisory warnings.

**Гэп**: v3 hard-gate'ит что specialist phases реально вызваны через `task` tool с точным agent name, а не имперсонированы. ts-kb-flow имеет 4 агента (memory-extractor, memory-analyst, memory-coder, memory-reviewer), но нет dispatch ledger и impersonation detection.

**v3-механизм**:
- Specialist phases: change-surface → q-change-surface-investigator, current-state → q-reference-miner, rationale → q-legacy-verifier, semantic-review → q-doc-verifier
- `specialist-attempts.jsonl` — runtime-captured попытки вызова
- `specialist-dispatch.json` — финализированный ledger
- Impersonation detection: regex на notes/description/prompt для `ты — q-`, `you are q-`, `impersonat`, `explore task`, `general task`
- Generic agent names (explore, general, plan, task) не могут быть specialists
- q-kb-builder не может быть specialist для самого себя
- Tool должен быть `task`, не прямой вызов

**Требования** (адаптировано под ts-kb-flow agents):

1. Определить specialist phases и mapping на существующих агентов:
   ```typescript
   export const SPECIALIST_PHASES = {
     'discovery-semantic': 'memory-extractor',
     'code-evidence': 'memory-coder',
     'rationale-extraction': 'memory-analyst',
     'quality-review': 'memory-reviewer',
   } as const;
   ```

2. Создать `SpecialistAttemptSchema` в src/schemas/dispatch.ts:
   ```typescript
   export const SpecialistAttemptSchema = z.object({
     attemptId: z.string(),  // SHA-256[:16] от sorted JSON
     phase: z.string(),
     expectedAgent: z.string(),
     requestedAgent: z.string(),
     actualAgent: z.string(),
     tool: z.string(),  // must be "task"
     runtime: z.enum(['opencode']),
     status: z.enum(['named-task', 'skipped-no-applicable-work', 'missing-attempt']),
     session: z.string().optional(),
     toolCallId: z.string().optional(),
     description: z.string().optional(),
     notes: z.string().optional(),
     timestamp: z.string(),
   });
   ```

3. Реализовать `recordDispatchAttempt(attempt: SpecialistAttempt): void` — append в `.ai/memory-build/latest/specialist-attempts.jsonl`

4. Реализовать `detectImpersonation(attempt: SpecialistAttempt): ImpersonationCheck`:
   - Regex check: `ты — `, `you are `, `impersonat`, `role impersonation`, `explore task`, `general task`
   - Generic agent names: `explore`, `general`, `plan`, `task`, `sonic`, `librarian`, `reviewer`, `oracle`, `designer` — не могут быть specialists
   - `memory-reviewer` (builder) не может быть specialist для себя
   - Tool ≠ `task` → warning (не error)

5. Добавить `checkDispatchAdvisory` в validate (advisory warnings only, не errors):
   - Загружает specialist-attempts.jsonl
   - Для каждой попытки: detectImpersonation → warnings
   - `--check-dispatch` флаг включает advisory проверку (warnings, не errors)

**Acceptance criteria**:
- Dispatch attempt записывается в JSONL
- Impersonation detection выдаёт warnings (не errors)
- `validate --check-dispatch` показывает warnings
- Generic agent names триггерят warning
- Tool ≠ "task" триггерит warning

---

#### C2. Specialist findings JSONL format

> **⏸️ DEFERRED (Phase 1 non-goal)**. **Пользовательское решение (binding)**: Specialist findings JSONL не переносится в Phase 1. Agents читают cards directly via context pack. Если в Phase 2+ понадобится bounded build context — revisit.

**Гэп**: v3 имеет bounded JSONL findings (4KB max per record, 1200 chars text fields, 600 chars excerpt, forbidden fullText/rawDocument). ts-kb-flow хранит claims в frontmatter карточек.

**Решение**: Сохранить claim-evidence модель ts-kb-flow для карточек, но добавить specialist-findings JSONL как build intermediate для build pipeline (не заменять claims, а дополнить).

**Требования**:

1. Создать `SpecialistFindingSchema` в src/schemas/finding.ts:
   ```typescript
   export const SpecialistFindingSchema = z.object({
     version: z.literal(1),
     createdAt: z.string().datetime(),
     findingId: z.string(),  // SHA-256[:16]
     phase: z.enum(['discovery-semantic', 'code-evidence', 'rationale-extraction', 'quality-review']),
     agent: z.string(),
     kind: z.enum(['fact', 'inference', 'rationale', 'contradiction', 'unknown', 'coverage', 'blocker', 'none']),
     status: z.string(),
     summary: z.string().min(8).max(1200),
     source: z.string().max(1200),
     section: z.string().max(1200).optional(),
     runtimeTier: z.string().optional(),
     targetCards: z.array(z.string()),
     evidence: z.array(z.object({
       path: z.string(),
       location: z.string().optional(),
       supports: z.string().optional(),
     })),
     excerpt: z.string().max(600).optional(),
   }).refine(
     (data) => !['fullText', 'rawDocument', 'documentText', 'fullDocument', 'sourceText']
       .some(key => key in data),
     { message: 'Full document fields are forbidden in findings' }
   );
   ```

2. Реализовать `appendSpecialistFinding(finding: SpecialistFinding): void`:
   - Валидация через Zod
   - JSON record ≤ 4096 bytes (MAX_FINDING_JSON_BYTES)
   - Text fields ≤ 1200 chars
   - Excerpt ≤ 600 chars
   - Generic agent names rejected
   - findingId = SHA-256[:16] от sorted JSON
   - Append в `.ai/memory-build/latest/specialist-findings.jsonl`

3. Добавить CLI-команду `finding`:
   ```bash
   repo-memory finding --agent <name> --phase <phase> --kind <kind> \
     --summary <text> --source <path> [--target-card <path>] [--evidence <path::location::supports>] [--json]
   ```

**Acceptance criteria**:
- Finding > 4KB отклоняется
- Generic agent name отклоняется
- Forbidden fields отклоняются
- JSONL валиден и читается обратно
- Finding с evidence проходит, без evidence — зависит от kind

---

#### C3. Builder input pack

> **⏸️ DEFERRED (Phase 1 non-goal)**. **Пользовательское решение (binding)**: Builder input pack не переносится в Phase 1. Agents читают cards directly. Если в Phase 2+ понадобится bounded build context — revisit.

**Гэп**: v3 строит bounded `builder-input-pack.md` (24KB max) из findings + content maps. ts-kb-flow не имеет этого — LLM получает context pack, но не bounded build pack.

**Требования**:

1. Реализовать `renderBuilderInputPack(options: { root: string, buildDir?: string }): BuilderPack` в src/core/builderPack.ts:
   - Загрузить specialist-findings.jsonl, отфильтровать невалидные
   - Разделить coverage findings (1-per-source) от claim findings
   - Агрегировать source content maps по target cards (top 30 targets)
   - Для каждой phase: group findings по (targetCard, status, kind), показать top 14 groups
   - Truncation: если pack > 24KB, truncate и append "TRUNCATED: split the KB build by module/scope"
   - Сгенерировать `builder-input-pack.md` + `builder-input-manifest.json`

2. Добавить CLI-команду `pack`:
   ```bash
   repo-memory pack [--root <path>] [--build-dir <dir>] [--json]
   ```

3. Добавить OpenCode tool `builderPack` в tools/memory.ts

4. Builder pack используется memory-reviewer agent при synthesize

**Acceptance criteria**:
- Pack ≤ 24KB
- Manifest содержит counts, truncation flag, per-phase breakdown
- Coverage findings исключены из pack (они в content-map)
- Top 14 groups per phase, остальное в JSONL

---

#### C4. Contract-first init/plan/check

**Гэп**: v3 `check` валидирует 9 категорий: structural, content, cards, source coverage, specialist dispatch, markdown links, warnings, error budget. ts-kb-flow `validate` валидирует frontmatter, policy, evidence format, relations — но не structural completeness и не source coverage / dispatch.

**Требования**:

1. Расширить `validateMemory` (src/core/validate.ts) до 9-уровневой проверки:

   ```
   1. Structural: .ai/memory/ exists, 4 index files present (MEMORY.md, MODULES.md, DECISIONS.md, ARCHITECTURE.md) + existing README/ontology/product-map
   2. Content: MODULES.md has production/demo/shared split
   3. ARCHITECTURE.md: has "Architecture by submodule" section OR architecture/*.md exists
   4. Card sections: all cards have required sections per CARD_SECTION_CONTRACTS (A2)
   5. Frontmatter: all cards have valid frontmatter (existing)
   6. Source coverage: --require-source-coverage (B1)
   7. Specialist dispatch: --check-dispatch (advisory warnings only, not errors) (C1)
   8. Markdown links: all intra-repo links resolve
   9. Warnings: exact version mentions, long code blocks (25+ lines), error budget
   ```

2. Добавить флаги:
   - `--require-source-coverage` — включает B1 проверку
   - `--check-dispatch` — включает C1 advisory проверку (warnings, не errors)
   - `--max-errors <N>` — budget (default 50)

3. Реализовать `checkStructural()`, `checkContent()`, `checkArchitecture()`, `checkCardSections()`, `checkMarkdownLinks()`

4. `init` должен создавать 4 index cards (MEMORY.md, MODULES.md, DECISIONS.md, ARCHITECTURE.md) + 2 subdirs (flows/, architecture/) + `memory-contract.json`

5. `plan` должен генерировать `card-plan.md` — checklist необходимых карточек на основе discovery

**Acceptance criteria**:
- `validate --require-source-coverage --check-dispatch` проверяет все 9 уровней
- Missing index file → ERROR
- Missing required section → ERROR
- Broken markdown link → ERROR
- Error count ограничен `--max-errors`

---

### Домен D. Semantic repair (P1)

#### D1. Semantic repair из content maps

**Гэп**: v3 имеет `repair-memory-bank.py` который заполняет семантические секции карточек из source content maps, используя card-scoped keyword allowlists/exclusion lists. ts-kb-flow не имеет этого.

**v3-механизм**:
- Boilerplate detection: 15+ regex patterns для placeholder/boilerplate
- Category-aware extraction: каждое предложение из source scored по topic overlap (min 8), category keyword hit (+5), card name in text (+4), verb detection (+3), min score threshold 6
- Card-scoped scopes: allowlist/exclusion per card для предотвращения cross-contamination
- Sentence length bounds: 35-360 chars
- Deduplication по first 140 chars lowercased

**Требования**:

1. Реализовать `detectBoilerplate(body: string): BoilerplateMatch[]` в src/core/semanticRepair.ts:
   - 15+ regex patterns для placeholder detection (включая русскоязычные)
   - Возвращает match с pattern name и position

2. Реализовать `extractCardScopedSentences(card: MemoryCard, contentMaps: SourceContentMap[]): ExtractedSentence[]`:
   - Для каждой content map с targetCards включающим card.id:
     - Парсить sentences (split по `.!?`)
     - Score: topic overlap (card name tokens ∩ content map topics) ≥ 8
     - Category keyword hit (+5): decision/mechanics/rationale/alternative/consequence/flow word lists
     - Card name in text (+4)
     - Verb detection (+3): `uses`, `calls`, `filters`, `checks`, `долж`, `использ`, `провер`
     - Min score threshold: 6
     - Length bounds: 35-360 chars
     - Dedup по first 140 chars lowercased

3. Реализовать `CARD_SCOPES` — map cardId → { includes: string[], excludes: string[], allowPairs: [string,string][] }:
   - Score: includes + pair*3 - excludes; negative blocks inclusion

4. Реализовать `semanticRepairCard(card: MemoryCard, contentMaps: SourceContentMap[]): RepairResult`:
   - Detect boilerplate sections
   - Extract sentences из content maps scoped to card
   - Fill boilerplate sections с extracted content
   - Если не удалось заполнить → quarantine card

**Acceptance criteria**:
- Boilerplate секции заполняются из source content
- Cross-contamination предотвращается через card scopes
- Unrepairable карточки quarantine'ятся
- Sentence length bounds соблюдаются

---

#### D2. Category-aware extraction

**Гэп**: v3 извлекает content по категориям (mechanics, rationale, alternatives, consequences). ts-kb-flow не имеет категорийного извлечения.

**Требования**:

1. Определить category keyword lists:
   ```typescript
   export const CATEGORY_KEYWORDS = {
     decision: ['decision', 'решение', 'chosen', 'выбран', 'selected', 'adopted'],
     mechanics: ['mechanism', 'механизм', 'process', 'процесс', 'pipeline', 'конвейер', 'flow', 'поток'],
     rationale: ['rationale', 'обоснование', 'why', 'почему', 'reason', 'причина', 'constraint', 'ограничение'],
     alternative: ['alternative', 'альтернатива', 'option', 'вариант', 'instead', 'вместо'],
     consequence: ['consequence', 'последствие', 'trade-off', 'компромисс', 'impact', 'влияние'],
     flow: ['sequence', 'последовательность', 'step', 'шаг', 'fallback', 'откат'],
   };
   ```

2. Реализовать `extractByCategory(sentences: string[], category: Category): ExtractedContent`:
   - Score sentences по category keyword hits
   - Group extracted sentences по category
   - Return structured content для заполнения соответствующих секций карточки

3. Card writers:
   - `writeDecisionCard(card, extracted)` — заполняет Context/Problem/Decision/Rationale/Alternatives/Consequences
   - `writeFlowCard(card, extracted)` — заполняет Goal/Sequence/Fallback/Rationale

**Acceptance criteria**:
- Decision card заполняется с разделением mechanics/rationale/alternatives/consequences
- Flow card заполняется с sequence/fallback
- Каждая секция получает релевантный content, не mixed

---

#### D3. Post-repair fixes

**Гэп**: v3 после semantic repair прогоняет 5 пост-fixes: repair_links, repair_module_tiers, repair_architecture_index, repair_coverage, rebuild_indexes. ts-kb-flow не имеет этого.

**Требования**:

1. `repairLinks()` — чинить broken links в карточках (поиск замены по basename)

2. `repairModuleTiers()` — реклассифицировать unknown runtime_tier → production/demo/shared (A4)

3. `repairArchitectureIndex()` — добавить inter-module-deps.md reference в ARCHITECTURE.md

4. `repairCoverage()` — починить AGENTS.md disposition, очистить historical-only targetCards

5. `rebuildIndexes()` — пересобрать DECISIONS.md и FLOWS.md index tables из дочерних карточек

6. Добавить CLI-команду `semantic-repair`:
   ```bash
   repo-memory semantic-repair [--root <path>] [--build-dir <dir>] [--run-check] [--json]
   ```

**Acceptance criteria**:
- После repair все post-fixes прогоняются
- Index tables актуальны
- Broken links чинятся или отмечаются
- `--run-check` прогоняет validate после repair

---

### Домен E. Legacy ingestion (P1)

#### E1. Legacy doc classification pipeline

**Гэп**: v3 имеет `legacy_ingest.py` (1033 lines) — full pipeline для классификации и миграции исторических документов. ts-kb-flow не имеет legacy ingestion.

**v3-механизм**: 8-stage pipeline: ingest → classify → scaffold → check → review-pack → approve → apply → finalize

**Требования**:

1. Реализовать `legacyIngest(options: { root: string, sources: string[], batch?: string }): LegacyIngestResult` в src/core/legacyIngest.ts:
   - Scan sources → inventory → candidates
   - Heuristic pre-classification с confidence ≥ 0.25
   - Generate staged KB/OpenSpec docs

2. Онтология классов (канонические + неканонические):
   ```typescript
   export const LEGACY_CLASSES = {
     canonical: ['openspec-requirement', 'kb-service', 'kb-reference',
                 'kb-decision', 'kb-runbook', 'kb-gotcha'],
     nonCanonical: ['draft-contradiction', 'history-only', 'duplicate', 'unknown'],
   } as const;

   export const LEGACY_STATES = ['unclassified', 'needs-evidence', 'needs-human', 'ready', 'rejected'];
   ```

3. States transition: `unclassified` → `needs-evidence` → `needs-human` → `ready` → (apply или reject)

**Acceptance criteria**:
- Legacy spec классифицируется по онтологии
- Pipeline переходит по states
- Низкоуверенные кандидаты → needs-human

---

#### E2. Reconciliation и staging для human review

**Гэп**: v3 staged docs placed at `staged/<targetPath>` с subject hash binding. ts-kb-flow не имеет staging.

**Требования**:

1. Реализовать staging:
   - Staged docs в `.ai/memory-build/legacy-batches/<batch>/staged/<targetPath>`
   - Stub detection: placeholder regex защищает от `--force` overwrite

2. Default target paths по ontology class:
   - `openspec-requirement` → `openspec/specs/<scope>/<slug>.md`
   - `kb-service` → `.ai/docs/services/<scope>/README.md`
   - `kb-decision` → `.ai/docs/decisions/<scope>-<slug>.md`
   - `draft-contradiction` → `.ai/drafts/legacy/<batch>/<scope>/<slug>.md`

3. `evidenceValid(candidate)`: каждое evidence должно иметь path + supports, path должен существовать

4. Canonical ready items требуют valid current-repo evidence

**Acceptance criteria**:
- Staged files не перезаписывают существующие без --force
- Evidence paths валидируются
- Stub detection предотвращает overwrite переписанных файлов

---

#### E3. Subject hash binding для approvals

**Гэп**: v3 использует SHA-256 subject hash для binding approval к конкретному payload. ts-kb-flow не имеет этого.

**Требования**:

1. Реализовать `computeSubjectHash(candidate: LegacyCandidate): string`:
   - SHA-256 от sorted JSON: {classification, state, rationale, target, staged, paths, evidence SHA-256s}

2. `approve` проверяет что subject hash совпадает с текущим candidate state

3. `apply` проверяет subject hash перед копированием staged → target

**Acceptance criteria**:
- Изменение candidate после approve → hash mismatch → ERROR
- Apply без approve → ERROR
- Hash детерминирован

---

#### E4. Legacy ingest CLI и workflow

**Требования**:

1. CLI-команды:
   ```bash
   repo-memory legacy-ingest <sources...> [--root <path>] [--batch <name>] [--json]
   repo-memory legacy-list [--batch <name>] [--json]
   repo-memory legacy-status [--batch <name>] [--json]
   repo-memory legacy-scaffold [--batch <name>] [--json]
   repo-memory legacy-check [--batch <name>] [--json]
   repo-memory legacy-review-pack [--batch <name>] [--json]
   repo-memory legacy-approve <id> [--batch <name>] [--json]
   repo-memory legacy-apply [--batch <name>] [--json]
   repo-memory legacy-finalize [--batch <name>] [--json]
   ```

2. OpenCode slash-commands: `/memory-legacy-ingest`, `/memory-legacy-review`, `/memory-legacy-approve`

3. OpenCode tool `legacyIngest` в tools/memory.ts

**Acceptance criteria**:
- Full pipeline: ingest → list → scaffold → check → review-pack → approve → apply → finalize
- CLI и OpenCode tools работают
- Finalize валидирует KB + artifact rebuild

---

### Домен F. Context и retrieval (P1)

#### F1. Hash-based freshness для context packs

**Гэп**: v3 использует SHA-256 для source tracking и context pack freshness. ts-kb-flow не имеет hash-based freshness.

**v3-механизм**:
- `context-pack.json` содержит `sourceHashes` для всех файлов в pack
- Freshness check: repository HEAD match + all sourceHashes match
- `fileHash()` = SHA-256 of file contents
- `treeHash()` = SHA-256 of sorted file paths + contents

**Требования**:

1. Реализовать hash utilities в src/core/hashing.ts:
   - `fileHash(path: string): string` — SHA-256 of file
   - `treeHash(paths: string[]): string` — SHA-256 of sorted paths + contents
   - `shaBytes(data: Buffer): string`

2. Расширить `ContextPack` (src/core/types.ts):
   ```typescript
   export interface ContextPack {
     // existing fields...
     repositoryHead?: string;      // git HEAD SHA
     sourceHashes?: Record<string, string>;  // path → SHA-256
     generatedAt: string;          // ISO-8601
   }
   ```

3. Реализовать `checkContextFreshness(pack: ContextPack, root: string): FreshnessResult`:
   - repositoryHead должен match current git HEAD
   - Все sourceHashes files должны существовать и hash должен match
   - Возвращает { fresh: boolean, staleFiles: string[], reason?: string }

4. Добавить CLI-команду `context-check`:
   ```bash
   repo-memory context-check [--root <path>] [--json]
   ```

**Acceptance criteria**:
- Context pack содержит sourceHashes
- Изменённый файл после pack generation → freshness check fails
- `context-check` сообщает stale files

---

#### F2. Compaction

**Гэп**: v3 строит bounded `compaction.md` (12KB max) для compact context. ts-kb-flow не имеет compaction.

**Требования**:

1. Реализовать `buildCompaction(options: { root: string, maxChars?: number }): CompactionResult` в src/core/compaction.ts:
   - Default maxChars = 12000
   - Содержание: mode, topic, HEAD, route reasons, active lane, approvals, unresolved items, relevant files (top 20), canonical KB (top 8)
   - Truncate если превышает maxChars

2. Добавить CLI-команду `compact`:
   ```bash
   repo-memory compact [--root <path>] [--max-chars <N>] [--json]
   ```

3. Добавить OpenCode tool `compact` в tools/memory.ts

**Acceptance criteria**:
- Compaction ≤ maxChars
- Включает все required секции
- Truncation marker при превышении

---

#### F3. Overview rendering

**Гэп**: v3 генерирует `OVERVIEW.md` с route reasons, scenario matrix, test obligations, reviews table, session lanes, knowledge impact. ts-kb-flow не имеет overview.

**Требования**:

1. Реализовать `renderOverview(options: { root: string }): OverviewResult`:
   - Route reasons (из G3 route command, если доступен)
   - OpenSpec proposals/specs/design (если есть)
   - Scenario matrix
   - Test obligations
   - Tasks
   - Verification evidence
   - Reviews table
   - Session lanes (из G2 session isolation, если доступен)
   - Knowledge impact

2. Добавить CLI-команду `render`:
   ```bash
   repo-memory render [--root <path>] [--json]
   ```

3. Записывает `OVERVIEW.md` + `overview-sources.json` (с source hashes)

**Acceptance criteria**:
- OVERVIEW.md содержит все секции
- overview-sources.json содержит source hashes
- Пустые секции помечены "N/A"

---

#### F4. Artifact index и search

**Гэп**: v3 имеет `artifact-index.json` и artifact search с scoring (4 points for term in title, 1 point for term in haystack). ts-kb-flow не имеет artifact index.

**Требования**:

1. Реализовать `buildArtifactIndex(options: { root: string }): ArtifactIndex`:
   - Сканировать `.ai/memory/`, `.ai/docs/`, `.ai/drafts/`
   - Для каждого файла: path, title, kind, signals[], content hash

2. Реализовать `artifactSearch(query: string, index: ArtifactIndex, limit?: number): ArtifactHit[]`:
   - Score: 4 points for term in title, 1 point for term in haystack (title+path+kind+signals)
   - Return top 8 by descending score

3. Сохранять `.ai/memory-build/latest/artifact-index.json`

4. Добавить CLI-команду `artifacts-search`:
   ```bash
   repo-memory artifacts-search <query> [--root <path>] [--limit <N>] [--json]
   ```

5. Добавить OpenCode tool `artifactSearch` в tools/memory.ts

**Acceptance criteria**:
- Artifact index строится из всех memory/docs/drafts
- Search возвращает top results по score
- Title matches получают boost

---

#### F5. Reference study validation

**Гэп**: v3 имеет `check_reference()` который проверяет 6 обязательных секций reference study. ts-kb-flow не имеет этого.

**Требования**:

1. Реализовать `validateReferenceStudy(card: MemoryCard): ReferenceValidation`:
   - 6 required sections: "Behaviors carried over", "Behaviors intentionally not carried over", "Invariants and state transitions", "Failure/retry/cancellation/recovery", "Compatibility/operational constraints", "Derived scenarios and tests"
   - No placeholders
   - Source path must exist with matching tree hash

2. Интегрировать в `validateMemory` для карточек с entity_type=reference

**Acceptance criteria**:
- Reference без 6 секций → ERROR
- Placeholder в reference → ERROR
- Source path mismatch → ERROR

---

#### F6. SQLite FTS5 search index (опционально)

**Гэп**: v3 имеет SQLite FTS5 index для BM25-ranked search. ts-kb-flow использует лексический token scoring.

**Решение**: Опционально. Лексический скоринг ts-kb-flow работает для малых-средних репозиториев. SQLite FTS5 даёт better ranking для больших репозиториев.

**Требования** (опционально, P2):

1. Использовать `better-sqlite3` npm-пакет

2. Создать FTS5 index:
   ```sql
   CREATE VIRTUAL TABLE docs_fts USING fts5(
     path UNINDEXED, title, entity_type, tags, body,
     tokenize='porter unicode61'
   );
   ```

3. Реализовать `buildSearchIndex(options: { root: string }): void` и `searchIndex(query: string, options): SearchResult[]`

4. CLI-команды: `repo-memory index`, `repo-memory search <query>`

5. Если SQLite недоступен — fallback на лексический скоринг

**Acceptance criteria**:
- BM25-ranked search results
- Fallback на lexical scoring если SQLite недоступен
- Index rebuild работает

---

### Домен G. Workflow orchestration (P2)

#### G1. Adaptive workflow modes (DIRECT/PLAN/FULL)

**Гэп**: v3 имеет adaptive routing: DIRECT (bounded, local), PLAN (coordinated), FULL (architecture discovery) — auto-routed по change surface analysis. ts-kb-flow не имеет workflow routing.

**v3-механизм** (harnessctl.py route_result L395-483):
- DIRECT: max 1 component, max 8 changed files, 18 forbidden risk categories, behaviorChange=false required for refactor/docs/test/chore
- PLAN: max 2 components, forbidden risks: new-architecture, distributed-consistency, security-boundary
- FULL: triggered by triggerRisks (10 categories) OR triggerDecisionDimensions (12 architecture dimensions)
- Change surface analysis scores files по code extension match, test exclusion, config exclusion

**Требования**:

1. Создать `WorkflowPolicySchema` в src/schemas/workflow.ts:
   ```typescript
   export const WorkflowModeSchema = z.enum(['direct', 'plan', 'full']);

   export const WorkflowPolicySchema = z.object({
     modes: z.object({
       direct: z.object({
         maxComponents: z.number().default(1),
         maxChangedFiles: z.number().default(8),
         allowedTypes: z.array(z.string()),
         forbiddenRisks: z.array(z.string()),
       }),
       plan: z.object({
         maxComponents: z.number().default(2),
         forbiddenRisks: z.array(z.string()),
         fullTypes: z.array(z.string()),
       }),
       full: z.object({
         triggerRisks: z.array(z.string()),
         triggerDecisionDimensions: z.array(z.string()),
       }),
     }),
   });
   ```

2. Реализовать `analyzeChangeSurface(root: string, baseRef?: string): ChangeSurface`:
   - git diff against base ref
   - Group changed files по module boundary
   - Score files: code extension match, test exclusion, config exclusion, high-impact path

3. Реализовать `routeWorkflow(surface: ChangeSurface, policy: WorkflowPolicy): RouteResult`:
   - Priority chain: DIRECT → PLAN → FULL
   - Если files > DIRECT limit → escalate to PLAN
   - Если risks in PLAN forbidden → escalate to FULL
   - Return: { mode, reasons[], type, risks[], behaviorChange }

4. Добавить CLI-команду `route`:
   ```bash
   repo-memory route [--root <path>] [--base-ref <ref>] [--json]
   ```

5. Записывать route manifest в `.ai/memory-build/latest/route-manifest.json`

**Acceptance criteria**:
- Bugfix с 1 файлом → DIRECT
- Architecture change с new-architecture risk → FULL
- 2 components → PLAN (если нет FULL risks)
- Route reasons объясняют выбор

---

#### G2. Session isolation

**Гэп**: v3 имеет `execution-sessions.json` для tracking lanes (implementation, correction, review). ts-kb-flow не имеет session isolation.

**Требования**:

1. Создать `ExecutionSessionSchema` в src/schemas/session.ts:
   ```typescript
   export const ExecutionSessionSchema = z.object({
     lanes: z.array(z.object({
       laneKey: z.string(),
       phase: z.enum(['implementation', 'correction', 'review:spec', 'review:plan', 'review:code']),
       sessionId: z.string(),
       planTaskId: z.string().optional(),
       status: z.enum(['active', 'completed', 'failed']),
       continuations: z.array(z.object({
         reason: z.enum(['interrupted-response', 'unfinished-tool-sequence',
                        'focused-test-failure', 'immediate-local-correction']),
         sessionId: z.string(),
       })),
       filesChanged: z.array(z.string()),
       commandsRun: z.array(z.string()),
     })),
   });
   ```

2. Реализовать `sessionOpen(lane: SessionLane): void` и `sessionClose(laneKey: string, status: string): void`

3. Реализовать `checkSessions(sessions: ExecutionSessions): SessionCheck`:
   - No duplicate laneKey
   - No reused sessionId across lanes
   - No active lanes at readiness
   - At least one completed implementation lane
   - Continuation reasons must be in allowed set

4. CLI-команды:
   ```bash
   repo-memory session-open --lane-key <key> --phase <phase> [--plan-task-id <id>] [--json]
   repo-memory session-close --lane-key <key> --status <status> [--json]
   ```

**Acceptance criteria**:
- Duplicate laneKey → ERROR
- Reused sessionId → ERROR
- Active lane at readiness → ERROR
- No implementation lane → ERROR

---

#### G3. Route command (change surface analysis)

Покрыто в G1. CLI-команда `route` анализирует change surface и определяет workflow mode.

---

#### G4. Model routing profiles

**Гэп**: v3 имеет 3 profiles (quality, balanced, economy) с model-role assignments. ts-kb-flow имеет model-routing.yaml, но без profiles.

**Требования**:

1. Расширить `ModelRoutingSchema` (src/schemas/modelRouting.ts):
   ```typescript
   export const ModelRoutingSchema = z.object({
     profiles: z.object({
       quality: z.object({ /* role → model */ }),
       balanced: z.object({ /* role → model */ }),
       economy: z.object({ /* role → model */ }),
     }),
     activeProfile: z.enum(['quality', 'balanced', 'economy']).default('balanced'),
     routing: z.record(z.string(), z.string()),  // task → role
   });
   ```

2. Model-roles (адаптировано под ts-kb-flow agents):
   ```typescript
   export const MODEL_ROLES = {
     orchestrator: 'orchestrator',
     repositoryDiscovery: 'memory-extractor',
     architectureSynthesis: 'memory-analyst',
     implementation: 'memory-coder',
     semanticReview: 'memory-reviewer',
   };
   ```

3. CLI-команда для переключения profile:
   ```bash
   repo-memory profile <quality|balanced|economy> [--root <path>]
   ```

**Acceptance criteria**:
- 3 profiles с разными model assignments
- activeProfile переключается
- Skills/commands используют activeProfile при выборе агента

---

### Домен H. Integration и automation (P2)

#### H1. Git hooks

**Гэп**: v3 имеет 4 git hooks (pre-commit=lint, pre-push=verify, post-checkout=index rebuild, post-merge=index rebuild). ts-kb-flow не имеет hooks.

**Требования**:

1. Шаблоны hooks в `templates/githooks/`:
   - `pre-commit`: запускает `repo-memory validate`
   - `pre-push`: запускает `repo-memory validate --strict-warnings`
   - `post-checkout`: rebuilds search index (non-blocking)
   - `post-merge`: rebuilds search index (non-blocking)

2. `init` опционально устанавливает hooks:
   ```bash
   repo-memory init --install-hooks [--root <path>]
   ```

3. Hooks используют `npx repo-memory` или путь к локальному binary

**Acceptance criteria**:
- pre-commit блокирует commit если validate fails
- pre-push блокирует push если strict validate fails
- post-checkout/post-merge non-blocking

---

#### H2. CI integration

**Гэп**: v3 имеет `.github/workflows/agent-quality.yml`. ts-kb-flow не имеет CI.

**Требования**:

1. Шаблон `.github/workflows/memory-bank.yml`:
   ```yaml
   name: Memory Bank Validation
   on: [pull_request, workflow_dispatch]
   jobs:
     validate:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '20' }
         - run: npm ci
         - run: npx repo-memory validate --root . --require-source-coverage --json
   ```

2. `init` опционально устанавливает CI:
   ```bash
   repo-memory init --install-ci [--root <path>]
   ```

3. CI policy в config: acceptedPatterns, requireFullQualityCommand

**Acceptance criteria**:
- CI запускается на PR
- Validate failures блокируют PR
- JSON output для machine-readable results

---

#### H3. OpenSpec integration

**Гэп**: v3 имеет `openspecctl.py` (466 lines) для OpenSpec artifact management. ts-kb-flow не имеет OpenSpec.

**Решение**: Опционально. OpenSpec — external npm CLI (`@fission-ai/openspec`). ts-kb-flow может интегрироваться как thin wrapper.

**Требования** (опционально, P2):

1. Если `@fission-ai/openspec` установлен — интегрировать:
   - `repo-memory openspec-new` — создать spec artifact
   - `repo-memory openspec-status` — статус specs
   - `repo-memory openspec-check` — валидация specs
   - `repo-memory openspec-archive` — архивировать spec

2. Если не установлен — команды сообщают "OpenSpec not installed, install with: npm i @fission-ai/openspec"

**Acceptance criteria**:
- Команды делегируют в openspec CLI
- Без openspec — graceful message
- Spec artifacts линкуются с memory cards

---

## 4. Фазирование и приоритеты

### Phase 1 — P0 (Foundation)

**Цель**: Contract-first memory model с source coverage и dispatch advisory.

| Эпик | Домен | Зависимости |
|---|---|---|
| A1. Расширение card types (hybrid scaffold) | A | — |
| A2. Контракт секций карточек | A | A1 |
| A3. Knowledge ontology | A | A1 |
| A4. Runtime tier | A | A1 |
| B1. Source coverage contract | B | A1 |
| B2. Source content maps | B | A1 |
| B3. Automatic source triage | B | B1, B2 |
| C1. Specialist dispatch advisory (soft) | C | B3 |
| C4. Contract-first init/plan/check | C | A2, B1, C1 |

> **Note**: C2 (findings JSONL) and C3 (builder pack) — DEFERRED из Phase 1. Revisit в Phase 2 если bounded build context понадобится.

### Phase 2 — P1 (Build pipeline & retrieval)

**Цель**: Semantic repair, legacy ingestion, enhanced context.

| Эпик | Домен | Зависимости |
|---|---|---|
| D1. Semantic repair | D | B2, C2 |
| D2. Category-aware extraction | D | D1 |
| D3. Post-repair fixes | D | D1, D2 |
| E1. Legacy classification | E | A3, B1 |
| E2. Reconciliation & staging | E | E1 |
| E3. Subject hash binding | E | E2 |
| E4. Legacy ingest CLI | E | E1, E2, E3 |
| F1. Hash-based freshness | F | — |
| F2. Compaction | F | F1 |
| F3. Overview rendering | F | F1 |
| F4. Artifact index & search | F | — |
| F5. Reference study validation | F | A2 |
| F6. SQLite FTS5 (опционально) | F | F4 |

> **Note**: C2 (findings JSONL) and C3 (builder pack) — revisit если bounded build context понадобится. D1 зависимость от C2 (findings) снимается: D1 использует content maps (B2), а не findings. Если C2 будет добавлен — D1 можно расширить.

### Phase 3 — P2 (Workflow & integration)

**Цель**: Workflow orchestration, git hooks, CI, OpenSpec.

| Эпик | Домен | Зависимости |
|---|---|---|
| G1. Adaptive workflow modes | G | F4 |
| G2. Session isolation | G | — |
| G3. Route command | G | G1 |
| G4. Model routing profiles | G | — |
| H1. Git hooks | H | C4 |
| H2. CI integration | H | C4 |
| H3. OpenSpec (опционально) | H | — |

---

## 5. Требования к тестам

Каждый эпик должен сопровождаться тестами (Vitest):

### Общие требования:
- Каждый новый Zod-схема: тест валидации valid/invalid cases
- Каждый новый CLI-команд: тест в test/cli.test.ts
- Каждый новый core-модуль: unit test + integration test
- Каждый новый OpenCode tool: тест в test/tools.test.ts (если применимо)

### Критические тесты по доменам:

**A (модель)**: card types, section contracts, ontology validation, runtime tier classification

**B (coverage)**: triage disposition для всех 7 значений, coverage ledger enforcement, content map building

**C (dispatch)**: impersonation detection, generic agent rejection, finalize-dispatch, findings bounds (4KB, 1200, 600), builder pack 24KB cap

**D (repair)**: boilerplate detection, card-scoped extraction, category keyword hits, quarantine logic

**E (legacy)**: classification pipeline, state transitions, subject hash binding, staging protection

**F (context)**: hash freshness, compaction truncation, artifact search scoring, reference 6-section validation

**G (workflow)**: DIRECT/PLAN/FULL routing, session duplicate detection, profile switching

**H (integration)**: hook execution, CI YAML validity

### Тестовый мини-проект:
Расширить `examples/synapse-mini/` с:
- Legacy spec в `specs/legacy/`
- Demo module в `examples/demo-agent/`
- Decision doc с rationale
- Reference study
- Файлы для testing source coverage triage (empty, binary, deprecated, current)

---

## 6. Совместимость и миграция

### Обратная совместимость:
- Существующие `.ai/memory/` карточки продолжают работать
- Существующие CLI-команды не меняют signatures (только расширяются флагами)
- Новые entity_type значения аддитивны
- Новые frontmatter поля опциональны (runtime_tier, source_coverage)

### Миграция с v3:
- `repo-memory migrate-from-v3 --root <path>` — конвертирует v3 memory bank в ts-kb-flow формат:
  - `knowledge/memory/` → `.ai/memory/`
  - `source-coverage.json` → `.ai/memory/source-coverage.json`
  - v3 card frontmatter → ts-kb-flow frontmatter (mapping table)
  - v3 card types → ts-kb-flow entity_type (mapping: flow→flow, ops→ops, gotchas→gotchas, etc.)

### Versioning:
- Phase 1 → v0.5.0
- Phase 2 → v0.6.0
- Phase 3 → v0.7.0
- После полного закрытия гэпов → v1.0.0

---

## 7. Ограничения и явные non-goals

### Не переносится (OMP-specific):
- Oh My Pi адаптеры, плагины, расширения
- Dual-runtime команды
- OMP watchdog
- OMP model role routing (только OpenCode)

### Не переносится (out of scope):
- Vector embeddings / RAG pipeline
- External database (PostgreSQL, MongoDB)
- HTTP API server
- MCP server (отложено до v1.0+)
- TUI / interactive UI

### Deferred из Phase 1 (перенести в Phase 2+ если понадобится):
- Specialist findings JSONL (C2) — deferred, agents читают cards directly
- Builder input pack (C3) — deferred, agents читают cards directly
- Hard-gate dispatch validation (C1) — not needed, OpenCode fresh-subagent-isolation suffices
- specialist-dispatch.json — только JSONL attempts, no finalized dispatch
- OPS/GOTCHAS/TESTING/TASK_ROUTING cards — deferred до Phase 2-3 когда их фичи переносятся

### By-design ограничения (сохраняются из ts-kb-flow):
- CLI never calls LLM напрямую
- Memory хранится в файловой системе (Markdown + YAML frontmatter)
- No concurrent writes (single-threaded Node.js)
- Atomic writes (temp + rename)

---

## 8. Метрики успеха

| Метрика | Цель |
|---|---|
| v3-фичей перенесено | 30/30 эпиков |
| Тестов | ≥ 250 (сейчас 115) |
| Покрытие кода | ≥ 80% |
| CLI-команд | ≥ 25 (сейчас 11) |
| OpenCode tools | ≥ 12 (сейчас 6) |
| Card types | 20+ (сейчас 12) |
| Документация | Каждый эпик задокументирован |
| Миграция | `migrate-from-v3` работает на synapse-mini |

---

## 9. Риски и митигации

| Риск | Вероятность | Impact | Митигация |
|---|---|---|---|
| SQLite dependency усложняет install | Medium | Low | F6 опционален, fallback на lexical |
| Specialist dispatch gating слишком strict | Medium | Medium | `--skip-specialist-dispatch` escape hatch |
| Semantic repair quality низкая | High | Medium | Quarantine + manual review fallback |
| Legacy ingestion pipeline сложный | High | High | Разбить на подэпики, итеративная доставка |
| Performance на больших репозиториях | Medium | Medium | Content map caching, incremental triage |
| OpenSpec breaking changes | Low | Low | Version pin в package.json |