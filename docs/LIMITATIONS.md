# Ограничения текущей реализации

## 1. Назначение документа

Этот документ фиксирует, что остаётся ограничением текущей реализации `repo-memory-opencode-kit`, какие части целевой постановки реализованы только частично, а какие ещё не реализованы.

Документ нужен, чтобы не смешивать:

- уже сделанную реализацию (v0.1+v0.2);
- целевую архитектуру инструмента;
- ожидаемое поведение OpenCode workflow;
- будущие этапы реализации.

## 2. Что реализовано

Текущая реализация закрывает v0.1+v0.2+v0.3 roadmap:

- TypeScript CLI (10 команд: init, discover, bootstrap, ls, show, related, context, validate, ingest-spec, reconcile);
- Markdown memory bank с YAML frontmatter + Zod-схемы;
- Discovery pipeline — file inventory, heuristic classification (code/test/doc/spec/demo/legacy/config/contract), topic extraction, candidate modules;
- Bootstrap pipeline — генерация module/scenario/decision/historical/proposal cards из реального проекта;
- Spec classification — `classifySpecActuality` (6 статусов: current_confirmed, partially_confirmed, proposed_unconfirmed, historical_context, conflicting, unknown_needs_review);
- Claim extraction — `extractClaims` (deterministic, из markdown headings/bullets/code-refs);
- Evidence check — `checkEvidence` (keyword matching против discovery, не symbol analysis);
- Ingest-spec — CLI команда, создаёт proposal/historical/conflict cards;
- Reconcile — stale refs, weak current claims, realizable proposals, orphan modules, stale proposal detection; --fix mode применяет безопасные патчи (needs_review, conflicts.md, open-questions.md);
- Context pack — source priority из config, per-card usage_policy, conflicts/open-questions;
- Validation — 9.5 из 11 инвариантов REQUIREMENTS §13 (включая spec_only+current_behavior rejection);
- OpenCode skills/commands/agents/tools (memory-bank, memory-bootstrap, memory-ingest-spec, memory-reconcile);
- Synapse-mini fixture (examples/synapse-mini/) per design §12;
- 39 тестов (discovery 5, validate 6, context 5, ingest-spec 6, bootstrap 4, reconcile 3, cli 8, integration 2).

## 3. Главное ограничение

Главное ограничение: **bootstrap и spec classification — deterministic heuristic, не semantic understanding**.

Инструмент строит первичную карту проекта по путям, расширениям, именам файлов, директориям, markdown-заголовкам и простым сигналам. Это полезно для старта, но недостаточно для промышленного наполнения memory bank без LLM-агентов и review.

Что deterministic pipeline умеет:

- найти вероятные модули по path prefixes + code/test co-location;
- различить code/test/doc/spec/demo/legacy на базовом уровне;
- создать первичные module/proposal/historical cards;
- извлечь claims из markdown headings/bullets/code-refs;
- сопоставить claims с discovery file basenames/topics (keyword match);
- классифицировать спеку по path markers + content signals + evidence count;
- поставить `needs_review` там, где уверенности недостаточно.

Чего deterministic pipeline не умеет:

- глубоко понимать смысл спеки;
- извлекать все архитектурные claims (только headings/bullets/refs);
- доказывать актуальность спеки по коду (только keyword match, не symbol analysis);
- строить полноценные decision/rationale cards (только signal-based detection);
- отличать тонкие различия между похожими сценариями;
- автоматически разрешать конфликты между документами и кодом.

## 4. Что не реализовано

### 4.1 Глубокий LLM-assisted ingest-spec

Целевая команда должна автоматически:

1. классифицировать спеку — ✅ реализовано (`classifySpecActuality`);
2. извлекать proposed behavior — ✅ реализовано (`extractClaims` из headings/bullets/paragraphs);
3. извлекать rationale, constraints, alternatives, risks — ✅ реализовано (CLI: headings + paragraph extraction; LLM: memory-analyst deep rationale extraction);
4. разбивать содержание на claims — ✅ реализовано (`extractClaims`);
5. сопоставлять claims с текущей memory — ✅ реализовано (CLI: keyword match + canonical dedup; LLM: memory-analyst semantic matching);
6. искать evidence в коде, тестах, контрактах — ✅ реализовано (`checkEvidence`, keyword-based; LLM: memory-coder symbol verification);
7. определять actuality спеки — ✅ реализовано (`classifySpecActuality`);
8. создавать proposal/historical/conflict/decision updates — ✅ реализовано;
9. обновлять current-секции только при evidence — ✅ реализовано (validate rejects spec_only+current_behavior).

Не реализовано (LLM v0.4+ — требует external integration):

- анализ связей спеки с PR/Jira/commit (integration, v0.5+);
- semantic проверка реализации требований в коде (LLM: memory-coder делает symbol verification, но не semantic "does this function actually implement the spec's intent").

### 4.2 Claim model — частично реализована

Реализовано:

- `ClaimSchema` / `EvidenceSchema` (zod);
- `extractClaims` — извлечение из markdown;
- `checkEvidence` — keyword matching;
- `classifySpecActuality` — классификация по evidence count + path/content signals;
- хранение claims в memory-файлах — `claims[]` в frontmatter card'ов (StoredClaimSchema);
- повторная проверка claims при reconcile (reconcile re-runs checkEvidence, `--fix` обновляет stored evidence);
- claim evidence storage в frontmatter (StoredClaim с embedded evidence + last_checked);
- дедупликация claims (within-spec при ingest + cross-card detection при reconcile, first-wins + evidence merge);
- нормализация claims (canonical form — deterministic: lowercase, strip punctuation, remove stopwords);
- связь claim → module/scenario/decision (auto-linking при ingestSpec по title/source_path match; reconcile проверяет broken claim links).

Не реализовано:

- semantic deduplication (понимание "MUST filter" = "shall filter" — LLM v0.4+).

### 4.3 Code evidence check — keyword-based, не symbol analysis

Реализовано:

- `checkEvidence` — matching claim text против discovery file basenames/topics;
- статусы: `confirmed_by_code`, `confirmed_by_test`, `documented_only`, `not_found`;
- LLM semantic verification (memory-coder): читает function body, сравнивает behavior с claim intent, не просто symbol existence;
- `conflicts_with_code` (LLM): symbol существует, но behavior не соответствует claim → ## Conflicts section + conflicts.md;
- partial implementation detection (LLM: memory-analyst): claim частично реализован — некоторые aspects в коде, некоторые missing;
- evidence report по каждому claim с reason (LLM: semantic verification format).

Не реализовано:

- CLI-side AST symbol analysis (by design — LLM делает semantic, не CLI keyword match);
- automated semantic check без LLM (требует semantic understanding).

Текущая реализация CLI: keyword match (basename tokens). LLM (memory-coder): semantic verification — читает function body, проверяет behavior vs claim intent.

### 4.4 Spec actuality — частично реализована

Реализовано:

- `classifySpecActuality` со всеми 6 статусами;
- path markers (legacy/archive/deprecated → historical);
- content signals (Status: accepted/implemented/draft/deprecated);
- evidence count (confirmed_by_code/test → current_confirmed/partially_confirmed);
- conflict detection (conflicts_with_code evidence OR memory conflict card);
- LLM semantic verification (memory-coder): выявление конфликтов спеки с кодом по смыслу;
- LLM partial implementation detection (memory-analyst): выявление частично реализованной спеки (не binary).

Не реализовано:

- анализ связей спеки с PR/Jira/commit (integration, v0.5+);
- CLI-side per-claim semantic analysis (by design — LLM делает semantic).

### 4.5 Сверка документов между собой — частично реализована

Реализовано:

- сравнение нескольких спек по одной теме (Jaccard topic overlap, threshold 0.3);
- определение supersedes (deprecated/historical → proposal/current, year + "replaces" keyword);
- построение relations: `supersedes`, `superseded_by`, `conflicts_with`, `related_specs` (card IDs в frontmatter);
- автоматическое обновление `conflicts.md` по результатам междокументного сравнения (idempotent append);
- reconcile detects broken relations (card → non-existent ID).

Не реализовано:

- извлечение общей topic graph (v0.4 optional graph export);
- semantic conflict detection — NLP, понимание "A says X MUST, B says X MUST NOT" (v0.4+);
- relation types `proposes`, `motivates`, `implements`, `tests` (требуют semantic understanding).

### 4.6 Глубокое извлечение design rationale — частично реализовано

Реализовано:
- bootstrap создаёт decision cards при обнаружении rationale/decision/problem topics в файлах (content-based, не только signal-based);
- `extractClaims` извлекает design_rationale из ## Problem, ## Constraints, ## Consequences, ## Trade-offs, ## Non-goals, ## Value headings (не только Rationale/Why/Decision/Alternatives);
- извлечение rejected alternatives (### subheading + `Status: rejected` + `Reason:` → claim);
- paragraph extraction для rationale sections (не только headings + bullets);
- `ingestSpec` создаёт decision cards для спек с rationale content (Problem + Decision + Rationale);
- decision card body заполняется из spec content (## Problem, ## Decision, ## Rationale, ## Alternatives, ## Consequences).

Не реализовано:

- различение явно указанного rationale и inferred rationale (schema имеет `evidence_level: inferred`, но extraction не классифицирует — LLM v0.4+);
- связывание rationale с current decisions (semantic matching — v0.4+);
- обновление decision card при появлении новой спеки (v0.4+).

### 4.7 Reconcile — частично реализован

Реализовано:

- stale refs (code_refs/test_refs paths, не существующие в discovery);
- weak current claims (status=current + evidence_level=spec_only/inferred/unknown);
- realizable proposals (proposal card body keyword match с discovery code files);
- orphan modules (candidate modules без memory card);
- read-only report (JSON + text);
- stale proposal detection (proposals старше 90 дней с weak evidence → needs_review);
- automatic update `conflicts.md` и `open-questions.md` из reconcile results (append-only, idempotent);
- safe memory patch generation (`applyReconcileFixes` — structured patch + idempotency);
- `--fix` mode (read-only → apply safe patches).

Не реализовано (относится к другим разделам / более поздним версиям):

- semantic code evidence (symbol analysis) — см. §4.3;
- claim storage в memory-файлах — см. §4.2;
- claim re-check при reconcile — см. §4.2;
- cross-document comparison — см. §4.5.

### 4.8 Model routing — config есть, CLI не исполняет

В kit есть:

- `model-routing.yaml` config (extractor/coder/reviewer roles + routing map);
- OpenCode agents (memory-extractor, memory-coder, memory-reviewer);
- skills/commands, где роли описаны.

Не реализовано:

- CLI не является LLM-orchestrator — не запускает цепочку LLM-вызовов;
- не управляет фактическим выбором модели из CLI;
- распределение задач между моделями выполняется OpenCode на основе agents/commands/skills, не CLI.

### 4.9 OpenCode plugin integration — memory-guard plugin + thin tools

Реализовано: thin tools (context, validate, related, discover, bootstrap) как wrappers над CLI. Evidence-gated `code_confirmed`/`test_confirmed`: validate ERRORS без `## Code evidence`/`## Test evidence` секции с форматом `at <path>:<line> (symbol)`; updateCard THROWS при попытке выставить без секции. AGENTS.md scaffolded с advisory pre-task context instruction. memory-guard plugin: lifecycle hooks + auto-context injection. Content quality enforcement: agent instructions включают quality rubric (checklist + anti-patterns + good examples), reviewer re-reads code_refs для verification, bootstrap placeholders содержат EXAMPLE good output.

Не реализовано:

- UI-навигация по memory bank;
- интерактивное подтверждение memory diff внутри OpenCode.

### 4.10 PDF/DOCX — не реализовано

Не реализовано:

- парсинг PDF;
- парсинг DOCX;
- извлечение таблиц и диаграмм;
- OCR;
- layout-aware chunking;
- нормализация документов из Confluence/Jira/Word.

### 4.11 Graph/RAG — intentionally не планируется

Постановка: source of truth — Markdown memory bank, не БД/RAG.

Не реализовано и не планируется в MVP:

- vector database;
- embeddings;
- GraphRAG;
- отдельный сервер знаний;
- persistent service outside repository.

Возможен будущий optional graph export (v0.4), но source of truth остаётся в Markdown.

## 5. Что реализовано частично

### 5.1 Bootstrap — эвристический

Реализован: первичный эвристический bootstrap из discovery.

Ограничение: создаёт предварительную память, не гарантированно точную инженерную документацию.

Ожидаемое использование: `bootstrap` → `validate` → OpenCode reviewer/coder дорабатывает → human review diff.

### 5.2 Классификация файлов — базовая

Реализована: по путям, именам, расширениям.

Ограничение: файл может быть классифицирован неверно при нестандартной структуре.

### 5.3 Topic/module grouping — эвристическая

Реализована: по path prefixes + shared topics + code/test/doc co-location.

Ограничение: похожие темы могут быть склеены; один модуль может быть разбит.

### 5.4 Context pack — lexical scoring

Реализован: source priority из config, per-card usage_policy, conflicts/open-questions.

Ограничение: релевантность основана на lexical score (token matching), не semantic search.

### 5.5 Validation — форма + опасные состояния

Реализовано: 9.5 из 11 инвариантов REQUIREMENTS §13.

Не реализовано: проверка фактической истинности содержимого (только форма + policy + relations).

## 6. Roadmap

### v0.2 (текущая) — частично выполнен

Выполнено:

- ✅ claim schema + extraction;
- ✅ spec actuality classification;
- ✅ evidence status model;
- ✅ proposal/historical/conflict generation;
- ✅ ingest-spec CLI command;
- ✅ tests на актуальную/старую/конфликтующую/частично реализованную спеку.

Не выполнено (перенесено в v0.2+):

- ✅ claim storage в memory-файлах;
- ✅ claim re-check при reconcile;
- ✅ cross-document comparison (detectSpecRelations, relation building, conflicts.md append, broken-relation reconcile);
- ✅ LLM-assisted rationale extraction (memory-analyst, deepseek-v4-flash);
- ✅ semantic claim matching (memory-analyst);
- semantic code evidence — LLM: memory-coder делает symbol verification, но не semantic "does code implement spec intent" (v0.4+).

### v0.3 (текущая) — выполнен

- ✅ stale proposal detection;
- ✅ automatic conflict/open-question update из reconcile;
- ✅ safe memory patch generation;
- ✅ `--fix` mode (read-only → propose fixes).

### v0.4 — OpenCode integration

- ✅ полноценный plugin lifecycle (memory-guard plugin);
- ✅ automatic pre-task memory context injection (chat.message hook);
- interactive review memory diff;
- enforcement для product/architecture tasks;
- optional graph export.

### v0.5 — document ingestion extensions

- PDF/DOCX ingestion;
- Jira/Confluence export ingestion;
- richer contract/proto/OpenAPI analysis.

## 7. Риски

### 7.1 Ложная уверенность от автоматически созданной памяти

Bootstrap создаёт аккуратные Markdown-файлы, которые выглядят убедительно, но содержат предварительные выводы.

Митигация: `source_confidence: low|medium`, `review_required: true`, evidence-gated `code_confirmed` (validate ERRORS + updateCard THROWS без `## Code evidence` секции), human/LLM review.

### 7.2 Смешивание current/proposed/historical

Митигация: validate rejects `spec_only + current_behavior`; proposal/historical cards имеют `can_answer_current_behavior: false`; current меняется только после evidence.

### 7.3 Неверная классификация demo/test как prod

Эвристики могут ошибиться на нестандартных структурах.

Митигация: demo files классифицируются как `kind: demo`, не попадают в module code_refs; validate warns на missing code_refs paths.

### 7.4 Rationale может быть додуман

LLM может сформулировать причины, которых не было в источниках.

Митигация: `evidence_level: inferred` для signal-based decisions; `review_required: true`; source_refs required.

### 7.5 OpenCode может не применять skills автоматически

Митигация: project-level instruction; `/memory-context` перед сложными задачами; plugin/enforcement в v0.4.

## 8. Что не баг MVP

Ожидаемое ограничение, не дефект:

- bootstrap создаёт preliminary cards с `needs_review`;
- current behavior не заполняется глубоко без code evidence;
- старые спеки не превращаются в current behavior (validate rejects);
- proposal может быть создан без полной проверки claims;
- context pack может вернуть лишние memory-файлы (lexical score, не semantic);
- claim extraction — keyword-based, не semantic;
- evidence check — basename match, не symbol analysis;
- OpenCode agents должны дорабатывать semantic reasoning поверх deterministic CLI;
- пользователь должен смотреть diff перед принятием памяти.