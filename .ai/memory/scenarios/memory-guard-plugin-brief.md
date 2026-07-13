---
entity_type: scenario
id: scenario-memory-guard-plugin-brief
title: Memory guard plugin brief
status: needs_review
authority: reviewed_memory
evidence_level: inferred
stability: evolving
source_confidence: low
last_reviewed: '2026-07-13'
review_required: true
knowledge_types:
  - current_behavior
product_areas:
  - docs
  - plans
  - memory-guard-plugin-brief.md
source_refs:
  - path: docs/plans/memory-guard-plugin-brief.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Memory guard plugin brief

## Цель
Scaffold `.opencode/plugins/memory-guard.js` — OpenCode plugin with lifecycle hooks: auto-inject memory context on first user message, enforce memory read before write tool calls.

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
Требует ревью — прочитайте source_refs и код для описания потока.

## Ограничения
1. **plugin lifecycle** — `.opencode/plugins/memory-guard.js` scaffolded into target project. Uses `@opencode-ai/plugin` Plugin type + Hooks.
2. **automatic pre-task memory context injection** — `chat.message` hook: on first user message in session, auto-run `npm run memory -- context <query>` and inject result into message parts.
3. **enforcement: read memory before write** — `tool.execute.before` hook: intercept `Write`/`Edit`/`ast_grep_replace` tool calls. Check if memory tools (`context`, `related`, `discover`) were called in this session. If not — inject warning into args (advisory block, not hard block — hard block breaks UX).
4. **session state tracking** — `tool.execute.after` hook: track which tools called per session. Maintains in-memory map `sessionID → Set<toolName>`.

## Сценарии ошибок
Требует ревью — определите известные сценарии ошибок.

## Связанные модули
Не выявлены — определите модули, участвующие в сценарии.

## Связанные тесты
Не выявлены — определите тесты, покрывающие сценарий.

## Свидетельства из кода
Не проверено — memory-coder должен подтвердить поток по коду.

## Свидетельства из тестов
Не проверено — memory-coder должен подтвердить покрытие тестами для этого сценария.

## Обоснование
Требует ревью — почему существует этот сценарий, а не другой?
