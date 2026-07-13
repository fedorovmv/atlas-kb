---
entity_type: scenario
id: scenario-claim-linking-brief
title: Claim linking brief
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
  - claim-linking-brief.md
source_refs:
  - path: docs/plans/claim-linking-brief.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Claim linking brief

## Цель
Автозаполнение `module`/`scenario`/`decision` полей в claims при ingestSpec. Matching: claim canonical text ↔ card titles/ids/topics. Закрывает §4.2 полностью.

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
Требует ревью — прочитайте source_refs и код для описания потока.

## Ограничения
- `ClaimSchema` поля: `module?: string`, `scenario?: string`, `decision?: string` — уже в схеме, optional.
- `StoredClaim` extends Claim — поля наследуются.
- `canonicalClaimText(text)` в `claimDedup.ts` — готовая функция для canonical form.
- Cards имеют `meta.id`, `meta.title`, `meta.aliases` (optional), `meta.product_areas` (optional), `meta.topics` (через discovery, не в frontmatter).
- `ingestSpec` уже загружает `memory` (existing cards) — есть для matching.
- `reconcile` уже загружает cards — есть для re-link verification.

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
