---
entity_type: scenario
id: scenario-kb-gaps-brief
title: Kb gaps brief
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
  - kb-gaps-brief.md
source_refs:
  - path: docs/plans/kb-gaps-brief.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Kb gaps brief

## Цель
Close gaps between the current implementation and the approved specs in `docs/specs/REQUIREMENTS.md` and `docs/specs/IMPLEMENTATION_DESIGN.md` for the v0.1 + v0.2 roadmap scope.

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
Требует ревью — прочитайте source_refs и код для описания потока.

## Ограничения
- ESM modules with NodeNext resolution.
- `.js` extensions are used in TypeScript imports.
- Zod is used for schemas.
- `fast-glob` is used for file discovery.
- `gray-matter` is used for frontmatter parsing.
- Existing async/fs conventions should be preserved.
- Cross-platform paths should use `toPosixPath`.
- Commands are thin wrappers over core functions.
- Scaffold artifacts currently live as inline strings in `src/scaffold/templates.ts`.
- No separate installer/template directory exists.

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
