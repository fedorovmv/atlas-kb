---
entity_type: scenario
id: scenario-limitations
title: LIMITATIONS
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
  - limitations.md
  - limitations
source_refs:
  - path: docs/LIMITATIONS.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# LIMITATIONS

## Цель
Релевантность основана на token matching, не semantic search. Может вернуть лишние cards или пропустить релевантные по смыслу. Evidence-level weighting: `code_confirmed` cards получают boost, `heuristic_match` — нейтрально, `spec_only`/`inferred`/`unknown` — penalty. Снижает шум от неподтверждённых cards.

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
- UI-навигация по memory bank — требует OpenCode UI API;
- интерактивное подтверждение memory diff — требует OpenCode UI API;
- interactive review memory diff — требует OpenCode UI API.

## Ограничения
Требует ревью — определите ограничения, лимиты, условия ошибок.

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
LLM может сформулировать причины, которых не было в источниках.

Митигация: `evidence_level: inferred` для inferred rationale; memory-analyst instruction: "if rationale not explicitly stated → mark inferred"; `review_required: true`.
