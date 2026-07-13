---
entity_type: scenario
id: scenario-cross-doc-comparison-plan
title: Cross doc comparison plan
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
  - cross-doc-comparison-plan.md
source_refs:
  - path: docs/plans/cross-doc-comparison-plan.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Cross doc comparison plan

## Цель
Требует ревью — прочитайте source_refs для описания цели.

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
Требует ревью — прочитайте source_refs и код для описания потока.

## Ограничения
**Files:** `docs/LIMITATIONS.md`

**Steps:**
1. §4.5 — move to "Реализовано" (create section header change from "не реализована" to "частично реализована"):
   - сравнение нескольких спек по одной теме ✅
   - определение supersedes ✅
   - построение relations (supersedes/superseded_by/conflicts_with/related_specs) ✅
   - автоматическое обновление conflicts.md ✅
   Keep in "Не реализовано":
   - извлечение общей topic graph (v0.4 graph export)
   - semantic conflict detection (NLP, v0.4+)
   - relation types proposes/motivates/implements/tests (требуют semantic)
2. §6 — add cross-document comparison as completed (mark in v0.2+ or new entry).

**Completion evidence:** diff shows updates, tests green.

---

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
