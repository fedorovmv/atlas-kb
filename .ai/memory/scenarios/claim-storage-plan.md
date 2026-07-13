---
entity_type: scenario
id: scenario-claim-storage-plan
title: Claim storage plan
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
  - claim-storage-plan.md
source_refs:
  - path: docs/plans/claim-storage-plan.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Claim storage plan

## Цель
Требует ревью — прочитайте source_refs для описания цели.

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
Требует ревью — прочитайте source_refs и код для описания потока.

## Ограничения
**Outcome:** LIMITATIONS.md обновлён.

**Files:** `docs/LIMITATIONS.md`

**Steps:**
1. §4.2 "Claim model — частично реализована": перенести из "Не реализовано" в "Реализовано":
   - хранение claims в memory-файлах
   - claim evidence storage в frontmatter
   - повторная проверка claims при reconcile
2. §6 v0.2 "Не выполнено (перенесено в v0.2+)": отметить ✅ для:
   - claim storage в memory-файлах
   - claim re-check при reconcile
3. Оставить в "Не реализовано": дедупликация, нормализация, semantic extraction.

**Completion evidence:** diff показывает обновление, тесты зелёные.

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
