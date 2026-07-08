# Требования к инструменту memory bank для OpenCode

## 1. Цель

Инструмент должен помогать ИИ coding agent работать с существующим программным продуктом на основе:

- текущего кода;
- тестов;
- актуальной документации;
- новых и старых спек;
- описаний сценариев;
- demo/test/prod-модулей;
- архитектурных решений и rationale.

Результатом должна быть локальная **memory bank** в виде Markdown-файлов с frontmatter, которую можно хранить в репозитории, читать руками и использовать из OpenCode.

Инструмент не должен быть отдельным RAG/БД. Память должна быть файловой, repo-native и пригодной для review через diff/PR.

## 2. Основные задачи

Инструмент должен решать четыре задачи:

1. **Автоматически исследовать существующий проект.**
   - Найти код, тесты, документацию, спеки, demo/example/testdata/legacy-области.
   - Построить карту файлов и первичную карту тем/модулей.
   - Определить вероятные prod/test/demo/legacy зоны.

2. **Автоматически наполнить начальную memory bank.**
   - Создать карточки модулей, сценариев, решений, historical/proposal/open-question/conflict-файлы.
   - Не требовать ручного написания длинных prompt-ов.
   - Не требовать ручного заполнения `code-map.yaml` перед первым запуском.

3. **Периодически обновлять память по новым спекам и изменениям кода.**
   - Новая спека не должна напрямую становиться current-памятью.
   - Инструмент должен классифицировать спеку, извлечь proposed behavior, rationale, claims, affected modules/scenarios/decisions.
   - Инструмент должен сверить claims со связанным кодом, тестами, контрактами и текущей memory.
   - По результату создать proposal, conflicts, open questions или обновить current-секции, если есть evidence.

4. **Давать coding agent полезный context pack перед разработкой.**
   - По задаче найти релевантные module/scenario/decision/proposal/historical cards.
   - Показать связанные code/test paths.
   - Напомнить source priority и usage policy.
   - Помочь агенту не путать current/proposed/historical/demo.

## 3. Принципы памяти

Memory bank должна содержать не только описание “как работает”, но и “почему так сделано”.

Память должна различать типы знания:

- `current_behavior` — текущее поведение, подтверждённое кодом, тестами, контрактами или reviewed-документацией;
- `proposed_behavior` — то, что предлагает новая спека, но ещё не подтверждено;
- `design_rationale` — почему было принято решение, какие ограничения и компромиссы учитывались;
- `historical_context` — старые спеки и предыдущие идеи, полезные для понимания эволюции;
- `code_evidence` — подтверждение кодом, тестом или контрактом;
- `open_question` — нерешённый вопрос;
- `conflict` — противоречие между источниками.

## 4. Source priority

При конфликте источников инструмент и coding agent должны использовать порядок доверия:

1. Текущий код.
2. Текущие тесты.
3. API contracts / schemas / proto / OpenAPI / конфиги.
4. Reviewed memory.
5. Актуальная продуктовая/архитектурная документация.
6. Reviewed specs.
7. Новые unreviewed specs.
8. Historical specs.
9. Demo/example/testdata modules.

Правила:

- Новая спека описывает proposed behavior, а не current behavior.
- Старая спека может сохранять rationale, но не должна переопределять текущий код.
- Demo-код не является production evidence.
- Rationale не является основанием для прямой генерации кода.
- При конфликте нужно создать conflict/open question, а не молча выбрать удобную сторону.

## 5. Frontmatter как контракт

Каждый memory-файл должен иметь YAML frontmatter. Файл без frontmatter считается черновиком и не должен использоваться как авторитетная память.

Обязательные поля:

```yaml
entity_type: module | scenario | decision | proposal | historical | conflict | open_question | architecture | product_map
id: string
title: string
status: current | proposed | historical | deprecated | needs_review | conflict
authority: source_of_truth | reviewed_memory | reference | proposed | historical_context | example_only
evidence_level: code_confirmed | test_confirmed | contract_confirmed | reviewed_doc | spec_only | inferred | unknown
stability: stable | evolving | experimental | deprecated | unknown
source_confidence: high | medium | low | unknown
last_reviewed: YYYY-MM-DD
review_required: true | false
knowledge_types: []
usage_policy:
  can_answer_current_behavior: boolean
  can_generate_code_from: boolean
  can_use_as_rationale: boolean
  can_use_as_example: boolean
  requires_code_check_before_change: boolean
  requires_warning: boolean
```

Связи:

```yaml
product_areas: []
related_modules: []
related_scenarios: []
related_decisions: []
related_specs: []
conflicts_with: []
supersedes: []
superseded_by: []
code_refs:
  - path: string
    kind: production | test | demo | config | contract | unknown
test_refs:
  - path: string
    kind: unit | integration | e2e | unknown
source_refs:
  - path: string
    role: current_doc | spec | historical | rationale | evidence | unknown
```

## 6. Обязательные типы memory-файлов

Минимальная структура:

```text
.ai/memory/
  README.md
  ontology.md
  product-map.md
  architecture.md
  modules/
  scenarios/
  decisions/
  proposals/
  historical/
  reconciliation/
    conflicts.md
    open-questions.md
```

### Module card

Должна описывать:

- ответственность модуля;
- non-responsibilities;
- текущее поведение;
- связанные сценарии;
- связанные решения;
- связанные code/test refs;
- known risks;
- open questions;
- краткое “почему границы именно такие”.

### Scenario card

Должна описывать:

- цель сценария;
- акторов;
- flow;
- ограничения;
- ошибки/failure cases;
- связанные модули;
- связанные тесты;
- rationale.

### Decision card

Должна описывать:

- context;
- problem;
- decision;
- rationale;
- alternatives considered;
- rejected alternatives;
- consequences/trade-offs;
- current behavior evidence;
- affected modules/scenarios.

### Proposal card

Создаётся по новым спекам. Не является current behavior до подтверждения.

Должна содержать:

- source spec;
- proposed behavior;
- rationale from spec;
- affected modules/scenarios/decisions;
- current code check;
- confirmed/not found/conflicting claims;
- suggested memory updates;
- review decision.

### Historical card

Создаётся по старым спекам. Не является implementation guide.

Должна содержать:

- какие проблемы пытались решить;
- rationale still useful;
- obsolete/unconfirmed ideas;
- decisions that survived;
- links to current decisions.

## 7. Claim/evidence модель

Инструмент должен уметь извлекать claims из спек, документов и memory.

Claim — атомарное утверждение, которое можно проверить.

Пример:

```yaml
id: claim-001
text: Registry filters available agent cards by caller service identity
type: current_behavior
module: agent-tool-registry
evidence_required: true
```

Результат проверки:

```yaml
claim_id: claim-001
status: confirmed_by_code | confirmed_by_test | contract_confirmed | documented_only | not_found | conflicts_with_code | supported_by_decision
confidence: high | medium | low
evidence:
  - path: internal/registry/access_filter.go
    kind: code
    reason: Function filters cards using caller identity
```

Правила:

- `not_found` не означает “false”; это означает “не подтверждено”.
- `documented_only` не может автоматически обновлять current behavior.
- `inferred rationale` должен быть явно помечен как inferred.
- `current_behavior` требует evidence или explicit review.

## 8. Автоматический bootstrap

Инструмент должен иметь команду bootstrap, которая без ручных prompt-ов:

1. сканирует проект;
2. строит карту файлов;
3. классифицирует файлы по ролям: code/test/doc/spec/demo/example/legacy/config/contract;
4. группирует файлы по темам/модулям;
5. создаёт или обновляет первичные memory cards;
6. создаёт open questions/conflicts для сомнительных мест;
7. валидирует memory bank;
8. показывает summary и diff.

Команда должна быть доступна как CLI и как OpenCode command:

```bash
npm run memory -- --root /path/to/repo bootstrap
```

```text
/memory-bootstrap
```

## 9. Автоматическая классификация спек

Пользователь не должен вручную выбирать, актуальная спека или нет.

Инструмент должен оценивать спеку по совокупности признаков:

- путь файла: `legacy`, `archive`, `old`, `deprecated`, `specs`, `docs`, `cr`, `proposals`;
- дата изменения;
- ссылки на Jira/PR/commit;
- наличие слов `deprecated`, `obsolete`, `legacy`, `draft`, `accepted`, `implemented`;
- связь с текущим кодом и тестами;
- совпадение тематики с существующими module/scenario/decision cards;
- конфликт с текущей memory;
- подтверждение claims в коде/тестах/контрактах.

Результат не должен быть бинарным “актуально/неактуально”. Лучше статусы:

- `current_confirmed`;
- `partially_confirmed`;
- `proposed_unconfirmed`;
- `historical_context`;
- `conflicting`;
- `unknown_needs_review`.

## 10. Распределение задач по моделям

Инструмент должен поддерживать routing задач по ролям моделей.

Роли:

### memory-extractor

Для дешёвого массового прохода:

- scan summary;
- document classification;
- fact extraction;
- topic/module mapping;
- JSON outputs.

Ожидаемая модель: Qwen 3.6 27B или аналогичная.

### memory-coder

Для работы с кодом:

- code search;
- test search;
- contract/config analysis;
- evidence check;
- markdown patch generation;
- validation commands.

Ожидаемая модель: Qwen Coder Next или аналогичная.

### memory-reviewer

Для сложного reasoning:

- rationale extraction;
- conflict analysis;
- current/proposed/historical separation;
- decision records;
- final review.

Ожидаемая модель: большая thinking-модель Qwen или аналогичная.

Конкретные модели должны настраиваться в конфиге, а не быть зашиты в prompt-ах.

## 11. OpenCode-интеграция

Инструмент должен устанавливаться локально в проект и создавать:

```text
.opencode/
  skills/
    memory-bank/
    memory-bootstrap/
    memory-ingest-spec/
    memory-reconcile/
  commands/
    memory-bootstrap.md
    memory-context.md
    memory-ingest-spec.md
    memory-reconcile.md
  agents/
    memory-extractor.md
    memory-coder.md
    memory-reviewer.md
  tools/
    memory.ts
```

Пользователь должен иметь команды:

```text
/memory-bootstrap
/memory-context <task>
/memory-ingest-spec <path-or-glob>
/memory-reconcile
```

Пользователь не должен писать длинный prompt о том, что делать. Логика должна быть в skills/commands/tools.

## 12. CLI-команды

Минимальный набор:

```bash
memory init
memory discover
memory bootstrap
memory ls
memory show <id>
memory related <id>
memory context <query>
memory validate
memory reconcile
memory ingest-spec <path-or-glob>
```

### `discover`

Строит карту проекта без изменения memory:

- file inventory;
- topic clusters;
- candidate modules;
- candidate specs;
- prod/test/demo/legacy classification;
- candidate code/test/doc relations.

### `bootstrap`

Использует discover и создаёт первичную memory.

### `context`

Собирает context pack для coding agent.

### `validate`

Проверяет frontmatter, связи, usage_policy и опасные состояния.

### `ingest-spec`

Обрабатывает новые/старые спеки и создаёт proposals/historical/conflicts/open questions.

### `reconcile`

Периодически сверяет memory с текущим кодом, тестами, контрактами и docs.

## 13. Валидационные инварианты

Валидатор должен запрещать:

- memory-файл без frontmatter;
- duplicate `id`;
- broken `related_*` links;
- `proposal` с `can_answer_current_behavior: true`;
- `historical` с `can_generate_code_from: true`;
- `decision` с `can_generate_code_from: true`;
- `current` без `evidence_level`;
- `current` без `last_reviewed`;
- `current_behavior` только на основании `spec_only`, если нет explicit review;
- несуществующие `code_refs`/`test_refs`, если путь должен существовать;
- смешивание proposed/current в одной секции без явного разделения.

## 14. Тесты

В реализации должны быть тесты на:

- парсинг frontmatter;
- валидацию обязательных полей;
- запрет dangerous usage_policy;
- broken relations;
- context pack;
- discover-классификацию файлов;
- bootstrap на мини-проекте;
- генерацию базовых module/scenario/decision/proposal/historical cards;
- команды CLI;
- OpenCode artifacts generation;
- model-routing config;
- отсутствие необходимости ручного `code-map.yaml` перед bootstrap.

## 15. Ограничения первой версии

MVP может использовать эвристики и OpenCode agents для semantic reasoning. Не обязательно сразу строить полноценный graph/RAG.

Но MVP должен уже давать:

- автоматический discover;
- автоматический bootstrap;
- memory cards с frontmatter;
- OpenCode commands/skills/tools;
- разнесение ролей моделей;
- validation;
- context pack;
- основу для ingest-spec/reconcile.

