---
entity_type: scenario
id: scenario-phase2-brief
title: Phase2 brief
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
  - phase2-brief.md
source_refs:
  - path: docs/plans/phase2-brief.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Phase2 brief

## Цель
Extend ts-kb-flow with semantic repair (auto-fill boilerplate card sections from source content), legacy ingestion (8-stage pipeline for historical doc migration), and enhanced context retrieval (hash-based freshness, compaction, artifact search, overview rendering, reference validation).

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
Требует ревью — прочитайте source_refs и код для описания потока.

## Ограничения
- TypeScript strict mode, ESM (`.js` extensions in imports)
- CLI never calls LLM directly
- Atomic writes (temp + rename)
- Existing commands must not break (additive changes only)
- Zod for all new schemas
- Every new CLI command needs a test in `test/cli.test.ts`
- Every new Zod schema needs valid/invalid test cases
- F6 (SQLite) is optional — must fallback to lexical scoring if `better-sqlite3` unavailable

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
