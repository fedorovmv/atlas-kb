---
entity_type: scenario
id: scenario-phase2-plan
title: Phase2 plan
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
  - phase2-plan.md
source_refs:
  - path: docs/plans/phase2-plan.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Phase2 plan

## Цель
12 tasks (12 required, F6 dropped) + 1 integration task, 3 domains. Parallel execution across D/E/F domains where possible.

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
1. Run `npm run build` — must pass with zero errors
2. Run `npm test` — all tests must pass (~350+ tests expected)
3. Verify all new CLI commands work: `npm run memory -- semantic-repair --help`, `npm run memory -- legacy-ingest --help`, `npm run memory -- context-check --help`, `npm run memory -- compact --help`, `npm run memory -- render --help`, `npm run memory -- artifacts-search --help`, `npm run memory -- index --help` (if F6), `npm run memory -- search --help` (if F6)
4. Bump version in `package.json` from `0.5.0` to `0.6.0`
5. Update CHANGELOG with Phase 2 changes

## Ограничения
Требует ревью — определите ограничения, лимиты, условия ошибок.

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
