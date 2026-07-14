# Atlas

## Что это

Инструмент для создания и поддержки **memory bank** — структурированных Markdown-файлов с YAML frontmatter, которые помогают coding agent понять существующий продукт перед изменениями.

Memory bank живёт в репозитории рядом с кодом (`.ai/memory/`), не во внешней базе. Source of truth — Markdown, не RAG, не embeddings, не graph database.

## Какую проблему решает

Coding agent (LLM) перед изменением продукта сталкивается с тремя проблемами:

1. **Не знает архитектуру.** Что делает модуль `registry`? Почему registry не выбирает агента? Что было до текущего подхода?
2. **Не различает current / proposed / historical.** Спека 2025 года говорит "централизованный роутер" — но код уже работает по-другому. На что опираться?
3. **Не имеет evidence.** Документация утверждает "фильтрация по caller identity" — но действительно ли код это делает? Или это только proposal?

Без memory bank agent либо читает весь код (дорого), либо галлюцинирует (опасно), либо игнорирует контекст (неправильно).

Memory bank решает это: **детерминированный CLI** создаёт структурированный skeleton, **LLM-агенты** заполняют content с evidence verification, **validator** блокирует ложную уверенность.

## Разделение труда: CLI vs LLM

| CLI делает (deterministic) | LLM делает (semantic) |
|---|---|
| Инвентаризация файлов, классификация, topics | Чтение кода, понимание что функция делает |
| Skeleton cards с code_refs/test_refs | Заполнение Responsibility, Current behavior |
| Claim extraction из markdown headings/bullets | Semantic rationale extraction из prose |
| Keyword evidence match (basename tokens) | Symbol-level verification: "Function X at file:line" |
| Cross-doc Jaccard topic overlap | Semantic spec comparison: "spec A supersedes B потому что..." |
| Validate: frontmatter, relations, evidence format | Quality rubric: scoring content specificity |
| Reconcile: stale refs, broken links, duplicates | Re-read code, verify cited symbols exist |

CLI не парсит код, не понимает семантику. LLM не пишет frontmatter напрямую (через `atlas_updateCard` tool). CLI enforcement: `code_confirmed` без `## Code evidence` секции с `file:line` → ERROR.

## Memory card — структура

```yaml
---
entity_type: module          # module|scenario|decision|proposal|historical|architecture|reference|conflict|open_question|...
id: agent-tool-registry
title: Agent & Tool Registry
status: current              # current|proposed|historical|deprecated|needs_review|conflict
evidence_level: code_confirmed  # code_confirmed|test_confirmed|contract_confirmed|reviewed_doc|heuristic_match|spec_only|inferred|unknown
review_required: false
claims:                      # извлечённые claims с evidence
  - id: claim-001
    text: "Registry filters cards by caller identity"
    type: current_behavior
    module: agent-tool-registry   # auto-linked к card
    evidence:
      status: confirmed_by_code
      files: ["internal/registry/access_filter.go"]
    last_checked: "2026-07-11"
supersedes: ["historical-2025-agent-routing"]  # cross-doc relations
code_refs: [{ path: "internal/registry/access_filter.go", kind: "production" }]
test_refs: [{ path: "tests/registry/access_filter_test.go", kind: "unit" }]
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Agent & Tool Registry

## Responsibility
Registry stores agent/tool metadata and filters cards by caller service identity.
Exposes query API, not runtime orchestration.

## Current behavior
FilterCardsForCaller(caller string) returns []string of visible card IDs.

## Code evidence
- Caller-based filtering at internal/registry/access_filter.go:12 (FilterCardsForCaller)

## Test evidence
- Test TestFilterCardsForCaller at tests/registry/access_filter_test.go:8 covers caller-based filtering
```

## Lifecycle

```
1. init          → CLI scaffold: .ai/memory/ + .opencode/ (agents, skills, tools, plugin)
2. bootstrap     → CLI: skeleton cards (placeholder body, code_refs filled)
3. /atlas-bootstrap → OpenCode dispatch:
   3a. atlas-extractor (qwen-27b)    → LLM: читает код, заполняет Responsibility/Behavior
   3b. atlas-coder (qwen-coder)      → LLM: verifies symbols, добавляет ## Code evidence
   3c. atlas-reviewer (qwen-thinking)→ LLM: quality gate, promotes to current
4. validate      → CLI: проверяет инварианты (блокирует code_confirmed без evidence)
5. ingest        → CLI: claims → evidence → classify → cards + cross-spec relations
6. reconcile     → CLI: stale refs, changed evidence, broken links, duplicates
7. reconcile --fix → CLI: non-destructive patches (flag broken relations, log to open-questions.md, idempotent)
```

### /atlas-bootstrap — bounded LOOP

`/atlas-bootstrap` — это **цикл, не линия**. STEP 2 (enrich) → STEP 3 (review) → STEP 4 (check) повторяются пока `ls --needs-enrichment` и `ls --status needs_review` не вернут `[]`.

**Stop conditions:**
1. Оба гейта пусты → DONE
2. Content hash неизменен 2 итерации → STOP, stuck cards в open-questions.md
3. Hard cap: 5 итераций

**Terminal statuses** — proposal/historical+spec_only, decision/architecture+reviewed_doc с полными секциями исключаются из needs-enrichment (не требуют enrichment, они завершены).

## 4 агента + модели

| Агент | Модель | Назначение |
|-------|-------|-----------|
| atlas-extractor | qwen-3.6-27b | Читает **код**, заполняет module/scenario cards (Responsibility, Current behavior) |
| atlas-analyst | deepseek-v4-flash | Читает **спеки**, извлекает rationale/semantic claims, заполняет decision cards |
| atlas-coder | qwen-coder-next | Верифицирует evidence: открывает code_refs, ищет symbols, добавляет `## Code evidence` |
| atlas-reviewer | qwen-thinking-large | Финальный quality gate: rubric scoring, re-read verification, promotes to current |

**Workflow:** extractor → coder → reviewer (module/scenario); analyst → coder (if code_refs) → reviewer (decision/proposal/historical); analyst → reviewer (architecture/reference).

## CLI команды

```bash
atlas init                    # создать .ai/memory + .opencode scaffold
atlas discover [--json]       # инвентаризация: файлы, классификация, candidate modules
atlas bootstrap [--force]     # skeleton cards из discovery
atlas ingest <glob>           # спека → claims → evidence → card + cross-spec relations
atlas reconcile [--json]      # сверка с кодом (read-only report)
atlas reconcile --fix         # non-destructive: flag broken relations, log to open-questions (idempotent)
atlas validate [--strict-warnings]
atlas ls [--type module] [--status current]
atlas ls --needs-enrichment [--json]          # карты требующие enrichment
atlas ls --needs-enrichment-content [--json]  # split: placeholders, weak evidence, missing sections
atlas ls --needs-enrichment-links [--json]    # split: empty cross-links
atlas ls --needs-enrichment-review [--json]   # split: status=needs_review
atlas show <id>
atlas related <id>
atlas recall <query>          # context pack для задачи
atlas update <id> [--body <text>] [--set field=value]  # safe card update
```

В целевом проекте после `init` доступен wrapper `.ai/atlas/bin/atlas` — работает без `package.json`, требует только `node` в PATH:

```bash
.ai/atlas/bin/atlas bootstrap
.ai/atlas/bin/atlas ingest "specs/**/*.md"
.ai/atlas/bin/atlas reconcile --fix --json
.ai/atlas/bin/atlas recall "изменить фильтрацию agent cards"
.ai/atlas/bin/atlas validate
```

Для Node.js проектов можно добавить script в `package.json`:
```json
{
  "scripts": {
    "atlas": ".ai/atlas/bin/atlas"
  }
}
```
Тогда: `npm run atlas -- bootstrap`.

## Enforcement слои

| Слой | Что блокирует |
|------|--------------|
| validate ERROR | `code_confirmed` без `## Code evidence` секции с `at <path>:<line>` форматом |
| validate ERROR | `test_confirmed` без `## Test evidence` секции |
| validate ERROR | `spec_only + current_behavior` — спека не может быть current behavior |
| validate ERROR | `decision + can_generate_code_from: true` — rationale не для code gen |
| validate ERROR | broken relations, broken claim links, duplicate ids |
| updateCard THROW | попытка выставить `code_confirmed` без evidence section |
| atlas-guard plugin | `tool.execute.before` — advisory warning если Write без memory read |
| AGENTS.md | "Run /atlas-recall before product behavior tasks" |
| validate ERROR | `spec_only` cards с missing required sections (Phase 6 — spec_only skip removed) |
| ls.ts gate | heading match case-insensitive (prevents silent loop resets on LLM casing) |

## Что умеет

### Discovery + Bootstrap
- Автоматическая классификация файлов: code/test/doc/spec/demo/legacy/config/contract
- Topics из path segments + markdown headings
- Candidate modules по path prefix + code/test co-location
- Skeleton cards с code_refs/test_refs/source_refs
- Smart skip: enriched cards (review_required=false, evidence confirmed) не перезаписываются

### Claims pipeline
- `extractClaims` — headings + keyword-gated bullets + paragraphs + code refs + rejected alternatives
- `dedupClaims` — canonical form (lowercase, strip punctuation, remove stopwords), first-wins + evidence merge
- `checkEvidence` — keyword match против discovery basenames
- `linkClaimsToCards` — auto-linking claims к module/scenario/decision cards (title/source_path matching)
- Cross-card duplicate detection при reconcile

### Spec ingestion
- `classifySpecActuality` — 6 статусов (current_confirmed, partially_confirmed, proposed_unconfirmed, historical_context, conflicting, unknown_needs_review)
- Decision card creation для спек с rationale content (## Problem, ## Decision, ## Rationale)
- Cross-spec relations: `supersedes`, `superseded_by`, `conflicts_with`, `related_specs` (Jaccard topic overlap + "replaces" keyword)
- Claims stored в frontmatter с embedded evidence + last_checked
- LLM atlas-analyst: semantic rationale extraction, semantic claim matching, partial implementation detection

### Reconcile
- Stale refs (code_refs/test_refs paths не существуют)
- Weak current claims (current + spec_only/inferred/unknown)
- Changed claim evidence (re-run checkEvidence, сравнить со stored)
- Broken relations (card → non-existent ID) — flagged with `has_broken_relations: true`, logged to open-questions.md (non-destructive, IDs не удаляются)
- Broken claim links (claim.module/scenario/decision → non-existent card)
- Duplicate claims (cross-card canonical)
- `--fix` mode: append stale refs → open-questions.md, weak claims → conflicts.md, flag broken relations (idempotent, dedup by content)

### Content quality
- Agent instructions включают quality checklist, anti-patterns, good examples
- atlas-reviewer: rubric scoring (0-2 per section, ≥4/6 для promotion), re-read code verification
- Bootstrap placeholders содержат EXAMPLE good output (не просто "Needs review")
- validate проверяет evidence bullet format: `at <path>:<line>` pattern, не любой `- text`

### OpenCode integration
- 4 agent definitions (extractor, analyst, coder, reviewer)
- 4 skills (atlas-bank, atlas-bootstrap, atlas-ingest, atlas-reconcile)
- 4 commands (slash commands для workflow)
- 6 tools (recall, validate, related, discover, bootstrap, atlas_updateCard)
- atlas-guard plugin: lifecycle hooks (auto-context injection, write enforcement, session tracking)
- AGENTS.md: project-level instructions

## OpenCode команды

```text
/atlas-bootstrap                              # автоматически наполнить memory bank
/atlas-recall изменить фильтрацию agent cards
/atlas-ingest docs/specs/new-cr.md       # обработать спеку
/atlas-reconcile                              # сверить memory с кодом
```

## Установка

```bash
# из директории kit-а
npm install
npm run build

# 1. создать memory/openCode scaffold в проекте (включая wrapper .ai/atlas/bin/atlas)
npm run atlas -- --root /path/to/your/repo init

# 2. автоматически исследовать и наполнить
npm run atlas -- --root /path/to/your/repo bootstrap

# 3. проверить
npm run atlas -- --root /path/to/your/repo validate

# 4. context pack под задачу
npm run atlas -- --root /path/to/your/repo recall "изменить фильтрацию agent cards"
```

После `init` в целевом проекте появляется wrapper `.ai/atlas/bin/atlas` — работает без `package.json`, требует только `node` в PATH. Все skills/commands/tools используют его автоматически.

Или скопировать kit в `.ai/atlas` и добавить script в package.json:
```json
{
  "scripts": {
    "atlas": ".ai/atlas/bin/atlas"
  }
}
```

## Структура репозитория

```text
src/                    TypeScript core library and CLI
src/schemas/            Zod-схемы frontmatter и claim/evidence
src/core/               discovery, bootstrap, reconcile, validate, context, relations, claims
src/commands/           CLI-команды (15 команд)
src/scaffold/           шаблоны .ai/memory и .opencode
test/                   Vitest-тесты (567 тестов)
examples/synapse-mini/  мини-пример проекта после init
docs/                   REQUIREMENTS, LIMITATIONS, plans
```

## Что не делает (by design)

- **Не парсит код на AST уровне.** CLI использует keyword matching, не symbol analysis. LLM-агенты делают semantic verification.
- **Не LLM orchestrator.** CLI не запускает LLM-вызовы. OpenCode dispatches агенты на основе agents/skills/commands.
- **Не external database.** Source of truth — Markdown файлы в репозитории. Нет RAG, embeddings, graph database.
- **Не PDF/DOCX.** Только Markdown specs. PDF/DOCX — excluded (всё в markdown).
- **Не interactive diff UI.** Plugin advisory enforcement, не TUI.