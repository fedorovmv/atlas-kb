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

# создать memory/openCode scaffold в вашем проекте
npm run memory -- --root /path/to/your/repo init

# проверить frontmatter, политики и связи
npm run memory -- --root /path/to/your/repo validate

# собрать context pack под задачу
npm run memory -- --root /path/to/your/repo context "изменить фильтрацию agent cards"
```

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
npm run memory -- validate
npm run memory -- context "почему registry не должен выбирать агента"
```

## CLI-команды

```bash
repo-memory init
repo-memory ls [--type module] [--status current]
repo-memory show <id>
repo-memory related <id>
repo-memory context <query>
repo-memory validate [--strict-warnings]
```

Через npm:

```bash
npm run memory -- ls --type module
npm run memory -- related agent-tool-registry
npm run memory -- context "изменить Agent & Tool Registry"
npm run memory -- validate
```

## OpenCode-артефакты

`init` создаёт:

```text
.opencode/skills/memory-bank/SKILL.md
.opencode/skills/memory-ingest-spec/SKILL.md
.opencode/skills/memory-reconcile/SKILL.md
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
/memory-context изменить фильтрацию agent cards
/memory-ingest-spec docs/specs/new-cr.md
/memory-reconcile
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
- несуществующие `code_refs`/`test_refs` как предупреждения.

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

## Что пока сознательно не автоматизировано

Это MVP-реализация безопасного фундамента. Она не делает full auto rewrite memory bank по спекам. Команды и skills задают workflow, а CLI даёт навигацию/валидацию/context pack.

Следующий слой, который можно добавить:

- `claim extract` для атомарных утверждений из спеки;
- `evidence check` для проверки claim по code_refs/test_refs;
- генератор proposal-card из новой спеки;
- reviewer, который проверяет, не смешались ли current/proposed/historical.
