---
entity_type: scenario
id: scenario-claim-dedup-plan
title: Claim dedup plan
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
  - claim-dedup-plan.md
source_refs:
  - path: docs/plans/claim-dedup-plan.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Claim dedup plan

## Цель
Требует ревью — прочитайте source_refs для описания цели.

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
Требует ревью — прочитайте source_refs и код для описания потока.

## Ограничения
**Files:** `docs/LIMITATIONS.md`

**Steps:**
1. §4.2 — move last 2 items from "Не реализовано" to "Реализовано":
   - дедупликация похожих claims (within-spec + cross-card detection)
   - нормализация claims (canonical form — deterministic, не semantic)
2. Note: semantic dedup remains v0.4+ (LLM).

**Completion:** diff, tests green.

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
