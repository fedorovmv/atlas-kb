# Repo Memory OpenCode Kit

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

CLI не парсит код, не понимает семантику. LLM не пишет frontmatter напрямую (через `updateCard` tool). CLI enforcement: `code_confirmed` без `## Code evidence` секции с `file:line` → ERROR.

## Memory card — структура

```yaml
---
entity_type: module          # module|scenario|decision|proposal|historical|conflict|open_question
id: agent-tool-registry
title: Agent & Tool Registry
status: current              # current|proposed|historical|deprecated|needs_review|conflict
evidence_level: code_confirmed  # code_confirmed|test_confirmed|reviewed_doc|spec_only|inferred|unknown
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
3. /memory-bootstrap → OpenCode dispatch:
   3a. memory-extractor (qwen-27b)    → LLM: читает код, заполняет Responsibility/Behavior
   3b. memory-coder (qwen-coder)      → LLM: verifies symbols, добавляет ## Code evidence
   3c. memory-reviewer (qwen-thinking)→ LLM: quality gate, promotes to current
4. validate      → CLI: проверяет инварианты (блокирует code_confirmed без evidence)
5. ingest-spec   → CLI: claims → evidence → classify → cards + cross-spec relations
6. reconcile     → CLI: stale refs, changed evidence, broken links, duplicates
7. reconcile --fix → CLI: patches (idempotent)
```

## 4 агента + модели

| Агент | Модель | Назначение |
|-------|-------|-----------|
| memory-extractor | qwen-3.6-27b | Читает **код**, заполняет module/scenario cards (Responsibility, Current behavior) |
| memory-analyst | deepseek-v4-flash | Читает **спеки**, извлекает rationale/semantic claims, заполняет decision cards |
| memory-coder | qwen-coder-next | Верифицирует evidence: открывает code_refs, ищет symbols, добавляет `## Code evidence` |
| memory-reviewer | qwen-thinking-large | Финальный quality gate: rubric scoring, re-read verification, promotes to current |

**Workflow:** extractor → coder → reviewer (bootstrap); analyst → coder → reviewer (ingest-spec).

## CLI команды

```bash
repo-memory init                    # создать .ai/memory + .opencode scaffold
repo-memory discover [--json]       # инвентаризация: файлы, классификация, candidate modules
repo-memory bootstrap [--force]     # skeleton cards из discovery
repo-memory ingest-spec <glob>      # спека → claims → evidence → card + cross-spec relations
repo-memory reconcile [--json]      # сверка с кодом (read-only report)
repo-memory reconcile --fix         # применить безопасные патчи (idempotent)
repo-memory validate [--strict-warnings]
repo-memory ls [--type module] [--status current]
repo-memory show <id>
repo-memory related <id>
repo-memory context <query>         # context pack для задачи
repo-memory update <id> [--body <text>] [--set field=value]  # safe card update
```

В целевом проекте после `init` доступен wrapper `.ai/memory-tool/bin/memory` — работает без `package.json`, требует только `node` в PATH:

```bash
.ai/memory-tool/bin/memory bootstrap
.ai/memory-tool/bin/memory ingest-spec "specs/**/*.md"
.ai/memory-tool/bin/memory reconcile --fix --json
.ai/memory-tool/bin/memory context "изменить фильтрацию agent cards"
.ai/memory-tool/bin/memory validate
```

Для Node.js проектов можно добавить script в `package.json`:
```json
{
  "scripts": {
    "memory": ".ai/memory-tool/bin/memory"
  }
}
```
Тогда: `npm run memory -- bootstrap`.

## Enforcement слои

| Слой | Что блокирует |
|------|--------------|
| validate ERROR | `code_confirmed` без `## Code evidence` секции с `at <path>:<line>` форматом |
| validate ERROR | `test_confirmed` без `## Test evidence` секции |
| validate ERROR | `spec_only + current_behavior` — спека не может быть current behavior |
| validate ERROR | `decision + can_generate_code_from: true` — rationale не для code gen |
| validate ERROR | broken relations, broken claim links, duplicate ids |
| updateCard THROW | попытка выставить `code_confirmed` без evidence section |
| memory-guard plugin | `tool.execute.before` — advisory warning если Write без memory read |
| AGENTS.md | "Run /memory-context before product behavior tasks" |

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
- LLM memory-analyst: semantic rationale extraction, semantic claim matching, partial implementation detection

### Reconcile
- Stale refs (code_refs/test_refs paths не существуют)
- Weak current claims (current + spec_only/inferred/unknown)
- Stale proposals (90 дней, weak evidence → needs_review)
- Changed claim evidence (re-run checkEvidence, сравнить со stored)
- Broken relations (card → non-existent ID)
- Broken claim links (claim.module/scenario/decision → non-existent card)
- Duplicate claims (cross-card canonical)
- `--fix` mode: append stale refs → open-questions.md, weak claims → conflicts.md, mark stale proposals, update stored evidence (idempotent)

### Content quality
- Agent instructions включают quality checklist, anti-patterns, good examples
- memory-reviewer: rubric scoring (0-2 per section, ≥4/6 для promotion), re-read code verification
- Bootstrap placeholders содержат EXAMPLE good output (не просто "Needs review")
- validate проверяет evidence bullet format: `at <path>:<line>` pattern, не любой `- text`

### OpenCode integration
- 4 agent definitions (extractor, analyst, coder, reviewer)
- 4 skills (memory-bank, memory-bootstrap, memory-ingest-spec, memory-reconcile)
- 4 commands (slash commands для workflow)
- 6 tools (context, validate, related, discover, bootstrap, updateCard)
- memory-guard plugin: lifecycle hooks (auto-context injection, write enforcement, session tracking)
- AGENTS.md: project-level instructions

## OpenCode команды

```text
/memory-bootstrap                              # автоматически наполнить memory bank
/memory-context изменить фильтрацию agent cards
/memory-ingest-spec docs/specs/new-cr.md       # обработать спеку
/memory-reconcile                              # сверить memory с кодом
```

## Установка

```bash
# из директории kit-а
npm install
npm run build

# 1. создать memory/openCode scaffold в проекте (включая wrapper .ai/memory-tool/bin/memory)
npm run memory -- --root /path/to/your/repo init

# 2. автоматически исследовать и наполнить
npm run memory -- --root /path/to/your/repo bootstrap

# 3. проверить
npm run memory -- --root /path/to/your/repo validate

# 4. context pack под задачу
npm run memory -- --root /path/to/your/repo context "изменить фильтрацию agent cards"
```

После `init` в целевом проекте появляется wrapper `.ai/memory-tool/bin/memory` — работает без `package.json`, требует только `node` в PATH. Все skills/commands/tools используют его автоматически.

Или скопировать kit в `.ai/memory-tool` и добавить script в package.json:
```json
{
  "scripts": {
    "memory": ".ai/memory-tool/bin/memory"
  }
}
```

## Структура репозитория

```text
src/                    TypeScript core library and CLI
src/schemas/            Zod-схемы frontmatter и claim/evidence
src/core/               discovery, bootstrap, reconcile, validate, context, relations, claims
src/commands/           CLI-команды (10 команд)
src/scaffold/           шаблоны .ai/memory и .opencode
test/                   Vitest-тесты (115 тестов)
examples/synapse-mini/  мини-пример проекта после init
docs/                   REQUIREMENTS, LIMITATIONS, plans
```

## Что не делает (by design)

- **Не парсит код на AST уровне.** CLI использует keyword matching, не symbol analysis. LLM-агенты делают semantic verification.
- **Не LLM orchestrator.** CLI не запускает LLM-вызовы. OpenCode dispatches агенты на основе agents/skills/commands.
- **Не external database.** Source of truth — Markdown файлы в репозитории. Нет RAG, embeddings, graph database.
- **Не PDF/DOCX.** Только Markdown specs. PDF/DOCX — excluded (всё в markdown).
- **Не interactive diff UI.** Plugin advisory enforcement, не TUI.