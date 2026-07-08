# Repo Memory OpenCode Kit

Локальный набор для repository-native memory bank: Markdown + YAML frontmatter + TypeScript CLI + OpenCode skills/commands/agents/tools.

Задача набора — помочь coding agent перед изменением кода быстро найти:

- актуальные module/scenario/decision карточки;
- почему решение устроено именно так;
- что является current/proposed/historical;
- где искать подтверждение в коде и тестах;
- какие конфликты и open questions нельзя замалчивать.

## Что внутри

```text
src/                    TypeScript core library and CLI
src/schemas/            Zod-схемы frontmatter и claim/evidence
src/core/               загрузка memory, связи, context pack, validate
src/commands/           CLI-команды
src/scaffold/           шаблоны .ai/memory и .opencode
.opencode/              создаётся командой init в целевом проекте
.ai/memory/             создаётся командой init в целевом проекте
test/                   Vitest-тесты постановки, команд и инвариантов
examples/synapse-mini/  мини-пример проекта после init
```

## Быстрый запуск в архиве

```bash
npm install
npm run check
```

## Установка в проект локально

Вариант для проверки без публикации пакета:

```bash
# из директории этого kit-а
npm install
npm run build

# 1. создать memory/openCode scaffold в вашем проекте
npm run memory -- --root /path/to/your/repo init

# 2. автоматически исследовать проект и наполнить memory bank
npm run memory -- --root /path/to/your/repo bootstrap

# 3. проверить frontmatter, политики и связи
npm run memory -- --root /path/to/your/repo validate

# 4. собрать context pack под задачу
npm run memory -- --root /path/to/your/repo context "изменить фильтрацию agent cards"
```

`bootstrap` запускает `discover` автоматически — отдельно вызывать `discover` не обязательно для первичного наполнения. Но можно вызвать отдельно, чтобы увидеть карту проекта без записи memory.

Можно также скопировать kit в репозиторий в `.ai/memory-tool` и добавить root script:

```json
{
  "scripts": {
    "memory": "tsx .ai/memory-tool/src/cli.ts"
  }
}
```

Тогда команды будут короче:

```bash
npm run memory -- bootstrap
npm run memory -- validate
npm run memory -- context "почему registry не должен выбирать агента"
```

## CLI-команды

```bash
repo-memory init                    # создать .ai/memory + .opencode scaffold
repo-memory discover [--json]      # исследовать проект: файлы, классификация, candidate modules
repo-memory bootstrap [--force] [--dry-run]  # автоматически наполнить memory bank из discover
repo-memory ingest-spec <path>      # обработать спеку → proposal/historical/conflict
repo-memory reconcile [--json]     # сверить memory с текущим кодом (read-only)
repo-memory ls [--type module] [--status current]
repo-memory show <id>
repo-memory related <id>
repo-memory context <query>
repo-memory validate [--strict-warnings]
```

Через npm:

```bash
npm run memory -- discover --json
npm run memory -- bootstrap --force
npm run memory -- ingest-spec docs/specs/new-cr.md
npm run memory -- reconcile --json
npm run memory -- context "изменить Agent & Tool Registry"
npm run memory -- validate
```

## OpenCode-артефакты

`init` создаёт:

```text
.opencode/skills/memory-bank/SKILL.md
.opencode/skills/memory-bootstrap/SKILL.md
.opencode/skills/memory-ingest-spec/SKILL.md
.opencode/skills/memory-reconcile/SKILL.md
.opencode/commands/memory-bootstrap.md
.opencode/commands/memory-context.md
.opencode/commands/memory-ingest-spec.md
.opencode/commands/memory-reconcile.md
.opencode/agents/memory-extractor.md
.opencode/agents/memory-coder.md
.opencode/agents/memory-reviewer.md
.opencode/tools/memory.ts
```

OpenCode ищет project skills в `.opencode/skills/<name>/SKILL.md`, commands в `.opencode/commands/`, agents в `.opencode/agents/`, custom tools в `.opencode/tools/`.

Команды после установки в проекте:

```text
/memory-bootstrap                              # автоматически наполнить memory bank
/memory-context изменить фильтрацию agent cards
/memory-ingest-spec docs/specs/new-cr.md       # обработать спеку
/memory-reconcile                              # сверить memory с кодом
```

## Важные инварианты валидатора

Валидатор ловит опасные состояния:

- memory-файл без frontmatter;
- дублирующиеся `id`;
- битые `related_*` связи;
- `proposal`/`historical` с `can_generate_code_from: true`;
- `proposal` с `can_answer_current_behavior: true`;
- `decision` с `can_generate_code_from: true`;
- `current` файл с `proposed_behavior` в `knowledge_types`;
- `spec_only` evidence + `current_behavior` knowledge_type (без code/test/contract evidence);
- несуществующие `code_refs`/`test_refs` как предупреждения;
- `current` с слабым `evidence_level` (spec_only/inferred/unknown) как предупреждение.

## Frontmatter MVP

```yaml
entity_type: module
id: agent-tool-registry
title: Agent & Tool Registry
status: current
authority: reviewed_memory
evidence_level: code_confirmed
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
  - design_rationale
related_modules: []
related_scenarios: []
related_decisions: []
code_refs: []
test_refs: []
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
```

## Что реализовано

Полный v0.1+v0.2 roadmap из REQUIREMENTS.md + IMPLEMENTATION_DESIGN.md:

- **Discovery pipeline** — автоматически исследует проект: файлы, классификация (code/test/doc/spec/demo/legacy/config/contract), topics, candidate modules с confidence.
- **Bootstrap** — автоматически наполнить memory bank из discovery: module/scenario/decision/historical/proposal cards. Не перезаписывает существующее без `--force`.
- **Spec classification + claim extraction** — `classifySpecActuality` определяет статус спеки (current_confirmed / partially_confirmed / proposed_unconfirmed / historical_context / conflicting / unknown_needs_review). `extractClaims` извлекает атомарные claims. `checkEvidence` сверяет claims с кодом/тестами.
- **Ingest-spec** — обрабатывает спеку и создаёт proposal/historical/conflict card в зависимости от классификации.
- **Reconcile** — сверяет memory с текущим кодом: stale refs, weak current claims, realizable proposals, orphan modules. Read-only.
- **Validation invariants** — все 11 инвариантов REQUIREMENTS §13, включая rejection `spec_only + current_behavior`.
- **Context pack** — source priority из config, per-card usage_policy, conflicts/open-questions.
- **Model routing** — extractor/coder/reviewer roles в config.
- **OpenCode artifacts** — skills, commands, agents, tools для всех workflow.

## Что сознательно отложено (v0.2+/v0.4)

- Semantic classifier через runtime LLM — v0.1 использует deterministic heuristics; semantic reasoning через OpenCode agents после bootstrap.
- `--fix` mode для reconcile (auto-promote proposals) — v0.1 только report.
- Graph export — v0.4.
- MCP server — v0.4.
- Decision card content extraction (сейчас signal-based; content parsing — v0.2).
