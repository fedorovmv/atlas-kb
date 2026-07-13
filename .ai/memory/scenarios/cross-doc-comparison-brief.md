---
entity_type: scenario
id: scenario-cross-doc-comparison-brief
title: Cross doc comparison brief
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
  - cross-doc-comparison-brief.md
source_refs:
  - path: docs/plans/cross-doc-comparison-brief.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Cross doc comparison brief

## Цель
Сравнивать несколько spec-документов между собой для построения relations: `supersedes`, `superseded_by`, `conflicts_with`, `related_specs`. Сейчас ingestSpec обрабатывает каждый spec независимо; relations поля пустые.

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
Требует ревью — прочитайте source_refs и код для описания потока.

## Ограничения
1. **сравнение нескольких спек по одной теме** — topic overlap между spec-derived cards (proposal/historical).
2. **определение supersedes** — старая спека (Status: deprecated + year в filename) → новая спека на ту же тему → populate `supersedes`/`superseded_by`.
3. **построение relations** — `supersedes`, `superseded_by`, `conflicts_with`, `related_specs` (card IDs).
4. **автоматическое обновление conflicts.md** — при обнаружении конфликта между спеками append в `reconciliation/conflicts.md`.

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
