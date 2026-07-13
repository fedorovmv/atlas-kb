---
entity_type: scenario
id: scenario-claim-storage-brief
title: Claim storage brief
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
  - claim-storage-brief.md
source_refs:
  - path: docs/plans/claim-storage-brief.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Claim storage brief

## Цель
Сохранять claims и их evidence в frontmatter memory-card'ов (сейчас claims runtime-only, discarded после `ingestSpec`). Добавить re-check claims при `reconcile`: повторный `checkEvidence` + отчёт о рассинхроне evidence status.

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
Требует ревью — прочитайте source_refs и код для описания потока.

## Ограничения
1. **хранение claims в memory-файлах** — `claims[]` YAML-массив в frontmatter card'а, каждый claim со своим evidence.
2. **claim evidence storage в frontmatter** — evidence status сохраняется рядом с claim, не только runtime.
3. **повторная проверка claims при reconcile** — `reconcile` читает stored claims, re-runs `checkEvidence`, сообщает changed evidence. При `--fix` обновляет stored evidence.

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
