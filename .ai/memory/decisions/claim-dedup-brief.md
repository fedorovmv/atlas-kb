---
entity_type: decision
id: claim-dedup-brief
title: claim-dedup-brief
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: medium
last_reviewed: '2026-07-13'
review_required: false
knowledge_types:
  - design_rationale
source_refs:
  - path: docs/plans/claim-dedup-brief.md
    role: rationale
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# claim-dedup-brief

## Контекст
Дедупликация claims: detect + merge одинаковых/близких claims. Canonical form: нормализация text для сравнения. В рамках deterministic CLI — exact + near-exact matching (не semantic, semantic = LLM v0.4+).

## Проблема
Дедупликация claims: detect + merge одинаковых/близких claims. Canonical form: нормализация text для сравнения. В рамках deterministic CLI — exact + near-exact matching (не semantic, semantic = LLM v0.4+).

## Решение
Требует ревью — что было решено?

## Обоснование
Inferred rationale signals from docs/plans/claim-dedup-brief.md: path segment "docs" suggests doc, path segment token "docs" (from "docs") suggests doc

## Рассмотренные альтернативы
Требует ревью — какие альтернативы были рассмотрены?

## Отклонённые альтернативы
Требует ревью — что было отклонено и почему?

## Последствия
Требует ревью — какие компромиссы были приняты?

## Свидетельства текущего поведения
Требует ревью — действительно ли решение актуально для текущего кода?

## Затронутые модули
Требует ревью — какие модули затронуты этим решением?

## Затронутые сценарии
Требует ревью — какие сценарии затронуты этим решением?
