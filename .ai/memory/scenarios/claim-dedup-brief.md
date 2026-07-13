---
entity_type: scenario
id: scenario-claim-dedup-brief
title: Claim dedup brief
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
  - claim-dedup-brief.md
source_refs:
  - path: docs/plans/claim-dedup-brief.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Claim dedup brief

## Цель
Дедупликация claims: detect + merge одинаковых/близких claims. Canonical form: нормализация text для сравнения. В рамках deterministic CLI — exact + near-exact matching (не semantic, semantic = LLM v0.4+).

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
Требует ревью — прочитайте source_refs и код для описания потока.

## Ограничения
- `ClaimSchema` в `claim.ts` — id, text, type, module?, scenario?, decision?, evidence_required, source_path?.
- `StoredClaimSchema` = Claim + evidence? + last_checked?.
- Claims хранятся в frontmatter `claims[]` (B2 done).
- `extractClaims(content, path) → Claim[]` в `specClassification.ts`.
- `ingestSpec` builds `storedClaims` and writes to cards.
- `reconcile` re-checks stored claims, `--fix` updates evidence.
- `updateMemoryCard` — safe way to update claims field.

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
