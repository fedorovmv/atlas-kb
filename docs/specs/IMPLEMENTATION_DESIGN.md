# Описание целевой реализации memory bank инструмента для OpenCode

## 1. Общая идея

Инструмент реализуется как локально устанавливаемый repo-native kit:

```text
repo-memory-opencode-kit
  -> устанавливается в существующий проект
  -> создаёт `.ai/memory` и `.opencode`
  -> даёт CLI, OpenCode commands, skills, agents и tools
  -> автоматически исследует проект
  -> создаёт и обновляет Markdown memory bank
```

Основная логика находится в TypeScript-библиотеке. CLI и OpenCode tools используют одну и ту же core-логику.

Память хранится не в БД, а в Markdown-файлах с YAML frontmatter.

## 2. Архитектурные слои

```text
.ai/memory/
  Markdown memory bank

.ai/memory-tool/config/
  machine-readable конфиги

.opencode/skills/
  правила работы агента

.opencode/commands/
  пользовательские команды

.opencode/agents/
  роли моделей

.opencode/tools/
  custom tools, thin wrappers над TypeScript core

src/core/
  TypeScript core library

src/cli.ts
  CLI entry point
```

## 3. Структура kit-а

```text
repo-memory-opencode-kit/
  package.json
  tsconfig.json
  README.md
  CHANGELOG.md
  TEST_RESULTS.md

  src/
    cli.ts
    index.ts

    core/
      frontmatter.ts
      loadMemory.ts
      validateMemory.ts
      discoverProject.ts
      bootstrapMemory.ts
      buildContext.ts
      related.ts
      score.ts
      paths.ts
      renderMarkdown.ts

    schemas/
      frontmatter.ts
      discovery.ts
      modelRouting.ts
      claim.ts
      evidence.ts

    commands/
      init.ts
      discover.ts
      bootstrap.ts
      ls.ts
      show.ts
      related.ts
      context.ts
      validate.ts
      ingestSpec.ts
      reconcile.ts

    installers/
      installMemoryScaffold.ts
      installOpenCodeArtifacts.ts

    opencode/
      skills/
      commands/
      agents/
      tools/

  templates/
    memory/
      README.md
      ontology.md
      product-map.md
      architecture.md
      reconciliation/conflicts.md
      reconciliation/open-questions.md

    cards/
      module-card.md
      scenario-card.md
      decision-card.md
      proposal-card.md
      historical-card.md

  examples/
    synapse-mini/
      internal/
      pkg/
      api/
      docs/
      specs/
      examples/
      tests/

  test/
    frontmatter.test.ts
    validate.test.ts
    context.test.ts
    discover.test.ts
    bootstrap.test.ts
    opencode-artifacts.test.ts
```

## 4. Основной пользовательский flow

### 4.1 Установка в проект

```bash
npm install
npm run memory -- --root /path/to/project init
```

`init` создаёт:

```text
.ai/memory/
.ai/memory-tool/config/
.opencode/skills/
.opencode/commands/
.opencode/agents/
.opencode/tools/
```

### 4.2 Автоматическое первичное наполнение

```bash
npm run memory -- --root /path/to/project bootstrap
```

Или из OpenCode:

```text
/memory-bootstrap
```

Команда должна:

1. запустить discover;
2. построить карту файлов;
3. классифицировать code/test/doc/spec/demo/legacy;
4. сгруппировать файлы по темам/модулям;
5. создать module/scenario/decision/historical/proposal/open-question cards;
6. проставить frontmatter;
7. валидировать результат;
8. показать summary.

### 4.3 Использование перед coding-задачей

```text
/memory-context изменить фильтрацию agent cards по service identity
```

Или CLI:

```bash
npm run memory -- --root /path/to/project context "изменить фильтрацию agent cards"
```

Результат — context pack:

- релевантные memory-файлы;
- связанные code/test refs;
- related decisions;
- related scenarios;
- known conflicts/open questions;
- usage policy;
- source priority.

### 4.4 Обработка спек

```text
/memory-ingest-spec docs/specs/new-cr.md
```

Команда должна:

1. классифицировать спеку;
2. извлечь claims, proposed behavior, rationale, constraints, alternatives;
3. сопоставить с текущей memory;
4. найти связанные code/test/docs;
5. проверить evidence;
6. создать proposal/historical/conflict/open-question updates;
7. обновить current только при evidence или explicit review.

### 4.5 Периодическая сверка

```text
/memory-reconcile
```

Команда должна:

1. проверить валидность memory;
2. найти current claims без evidence;
3. найти proposals, которые уже реализованы;
4. найти устаревшие refs;
5. найти новые модули без memory cards;
6. обновить conflicts/open questions;
7. показать reconciliation report.

## 5. Discover pipeline

`discoverProject(root)` должен возвращать `DiscoveryReport`.

### 5.1 File inventory

Для каждого файла:

```ts
type FileRecord = {
  path: string;
  kind: 'code' | 'test' | 'doc' | 'spec' | 'config' | 'contract' | 'demo' | 'example' | 'legacy' | 'unknown';
  language?: string;
  basename: string;
  dirname: string;
  sizeBytes: number;
  mtime?: string;
  signals: string[];
  topics: string[];
};
```

### 5.2 Heuristic classification

Признаки:

- path segments: `test`, `tests`, `spec`, `specs`, `docs`, `demo`, `example`, `examples`, `legacy`, `archive`, `deprecated`, `testdata`;
- file extensions: `.go`, `.ts`, `.java`, `.md`, `.yaml`, `.proto`, `.openapi.yaml`, `.json`;
- filename tokens: `agent`, `registry`, `mcp`, `gateway`, `routing`, `auth`, `policy`, `mesh`;
- content snippets: headings, package names, imports, test names, deprecated markers.

### 5.3 Topic extraction

Первая версия может использовать эвристики:

- tokens из пути;
- markdown headings;
- package/module names;
- repeated domain terms;
- aliases из ontology/config, если есть.

Позже semantic classifier через `memory-extractor`.

### 5.4 Candidate modules

Группировка:

- по path prefixes;
- по общим topics;
- по связям doc/spec/code/test;
- по совпадению алиасов.

Результат:

```ts
type CandidateModule = {
  id: string;
  title: string;
  confidence: 'high' | 'medium' | 'low';
  topics: string[];
  codeFiles: string[];
  testFiles: string[];
  docFiles: string[];
  specFiles: string[];
  demoFiles: string[];
  signals: string[];
};
```

## 6. Bootstrap pipeline

`bootstrapMemory(root)` использует `discoverProject(root)`.

### 6.1 Создание product-map и architecture

На основе top-level директорий, docs, configs и candidate modules.

### 6.2 Module cards

Для каждого candidate module с достаточной confidence:

- создать `.ai/memory/modules/<id>.md`;
- проставить `entity_type: module`;
- добавить `code_refs`, `test_refs`, `source_refs`;
- описать preliminary responsibility на основе сигналов;
- добавить `Needs review` в uncertain sections;
- не писать неподтверждённые утверждения как high-confidence.

### 6.3 Scenario cards

Сценарии можно создавать из:

- spec/doc headings;
- test names;
- use-case-like markdown sections;
- terms вроде discovery, invocation, routing, authorization, registration.

### 6.4 Decision cards

Первичный bootstrap может создавать только candidate decision cards, если есть явные rationale-секции:

- “why”;
- “rationale”;
- “decision”;
- “alternatives”;
- “constraints”;
- “not responsible for”.

Иначе вопросы пишутся в `open-questions.md`.

### 6.5 Historical/proposal cards

Для spec files bootstrap должен предварительно классифицировать:

- legacy/archive/old/deprecated -> historical;
- specs/proposals/cr без evidence -> proposal;
- spec с strong code/test evidence -> partially/current confirmed;
- conflicting spec -> conflict + proposal/historical.

## 7. Spec actuality classification

Не пользователь выбирает актуальность, а модуль.

Функция:

```ts
classifySpecActuality(spec, discovery, memory, evidence): SpecActuality
```

Статусы:

```ts
type SpecActuality =
  | 'current_confirmed'
  | 'partially_confirmed'
  | 'proposed_unconfirmed'
  | 'historical_context'
  | 'conflicting'
  | 'unknown_needs_review';
```

Оценка:

- path/date/deprecated signals;
- links to PR/Jira/commit;
- claims confirmed by code/test;
- conflict with current memory;
- topic match with active modules;
- whether spec describes already-existing code or future change;
- explicit wording: draft, planned, accepted, implemented, obsolete.

## 8. Model routing

Конфиг:

```yaml
models:
  extractor:
    agent: memory-extractor
    purpose: document classification, fact extraction, topic mapping
  coder:
    agent: memory-coder
    purpose: code/test evidence, markdown patches, validation
  reviewer:
    agent: memory-reviewer
    purpose: rationale, conflicts, final review

routing:
  discover_semantic_classification: extractor
  spec_claim_extraction: extractor
  code_evidence_check: coder
  memory_patch_generation: coder
  rationale_extraction: reviewer
  conflict_analysis: reviewer
  final_review: reviewer
```

OpenCode agents:

```text
.opencode/agents/memory-extractor.md
.opencode/agents/memory-coder.md
.opencode/agents/memory-reviewer.md
```

Пользователь не должен выбирать модель на каждом шаге. Команды и skills должны сами указывать роли.

## 9. OpenCode commands

### `/memory-bootstrap`

Команда без аргументов:

```md
Use memory-bootstrap skill.
Run repository discovery and bootstrap memory bank.
Use model routing:
- extractor for document/topic classification;
- coder for code/test evidence and patching;
- reviewer for rationale/conflict review.
Do not ask the user to classify specs manually.
Show summary and diff.
```

### `/memory-context <task>`

Собирает context pack.

### `/memory-ingest-spec <path-or-glob>`

Обрабатывает одну или несколько спек.

### `/memory-reconcile`

Сверяет memory с текущим проектом.

## 10. OpenCode tools

`memory.ts` должен экспортировать thin wrappers:

- `discover({ root })`;
- `bootstrap({ root })`;
- `context({ root, query })`;
- `related({ root, id })`;
- `validate({ root })`.

Tools не должны дублировать логику. Они вызывают core-функции TypeScript-библиотеки.

## 11. Skills

### memory-bank

Общие правила работы с памятью.

### memory-bootstrap

Правила автоматического первичного наполнения.

### memory-ingest-spec

Правила обработки спек, actuality classification, claims/evidence.

### memory-reconcile

Правила периодической сверки.

### memory-rationale

Правила извлечения “почему так сделано”.

### memory-code-evidence

Правила поиска подтверждения в коде/тестах/контрактах.

## 12. Тестовый мини-проект

В `examples/synapse-mini` должен быть искусственный проект:

```text
internal/registry/access_filter.go
internal/registry/access_filter_test.go
internal/mcp/gateway.go
docs/agent-registry.md
specs/2027-agent-tool-registry.md
specs/legacy/2025-agent-routing.md
examples/demo-agent/main.go
```

Тесты должны проверять:

- discover видит registry как candidate module;
- demo не становится production evidence;
- legacy spec классифицируется как historical;
- новая spec создаёт proposal;
- code/test refs попадают в module card;
- context по registry возвращает module + decision/proposal/historical;
- validate ловит dangerous usage policy.

## 13. MVP-ограничения

Первая версия может строить первичные cards эвристически и помечать спорные места `needs_review`.

Глубокое semantic reasoning может выполняться OpenCode agents после deterministic bootstrap.

Важно: пользовательский flow должен быть автоматизирован командой, а не ручным prompt-ом.

## 14. Roadmap

### v0.1

- init;
- discover;
- bootstrap;
- validate;
- context;
- OpenCode commands/skills/tools;
- tests.

### v0.2

- claim extraction;
- evidence check;
- ingest-spec полноценный;
- proposal/historical/conflict generation.

### v0.3

- reconcile;
- stale proposal detection;
- current claims verification;
- richer semantic classifier.

### v0.4

- optional graph export;
- MCP server, если понадобится общий сервис;
- richer OpenCode plugin integration.

