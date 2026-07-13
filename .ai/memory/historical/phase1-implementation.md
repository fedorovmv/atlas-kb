---
entity_type: historical
id: historical-phase1-implementation
title: PHASE1_IMPLEMENTATION_SPEC.md
status: historical
authority: historical_context
evidence_level: spec_only
stability: deprecated
source_confidence: low
last_reviewed: '2026-07-13'
review_required: false
knowledge_types:
  - historical_context
source_refs:
  - path: docs/specs/PHASE1_IMPLEMENTATION_SPEC.md
    role: historical
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# PHASE1_IMPLEMENTATION_SPEC.md (historical)

## Какая проблема решалась
---

## Актуальное обоснование
**Утверждённый подход**: Incremental Layer Cake — изолированные модули поверх существующего core, validate становится координатором, вызывающим каждый валидатор. Каждая новая возможность получает свой module boundary.

**Рассмотренные альтернативы**:

1. **Incremental Layer Cake (утверждено)** — изолированные модули, validate-координатор, 13 новых файлов. Low risk, high testability, reversible via flags. Лучше всего подходит для soft advisory dispatch + content maps only + hybrid structure + soft compatibility.
2. **Pipeline Architecture** — явные build stages discover→classify→triage→validate, stage artifacts. Отклонено: over-engineers текущий scope, pipeline runner complexity unnecessary.
3. **Contract-First Validator with Lazy Enrichment** — bootstrap создаёт stubs, отдельная enrich команда, contracts abstraction. Отклонено: 2-step workflow unnecessary, contracts abstraction over-engineers для прямого v3 port.

**Decision matrix**:

| Dimension | Layer Cake | Pipeline | Contract-First |
|---|---|---|---|
| Correctness risk | Low | Medium (stale artifacts) | Low |
| Complexity | Medium | High | Medium |
| Maintainability | High | Medium | High |
| Migration safety | High | High | Medium (2-step) |
| Operability | High | Medium | Medium |
| Testability | High | High | High |
| Reversibility | High | Medium | High |
| Phase 2 readiness | Medium | High | Medium |
| New files | 13 | 11 | 10 |

**Rationale**: Layer Cake лучше всего подходит для soft advisory dispatch (простой JSONL recorder), content maps only (изолированный модуль), hybrid structure (additive scaffold), soft compatibility (optional fields + migration).

## Устаревшие идеи
Требует ревью — что больше не применимо?

## Выжившие решения
Требует ревью — какие решения из этой спецификации перенесены?

## Ссылки на текущие решения
Требует ревью — ссылки на текущие карточки решений, заменяющие эту.
