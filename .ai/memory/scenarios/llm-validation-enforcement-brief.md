---
entity_type: scenario
id: scenario-llm-validation-enforcement-brief
title: Llm validation enforcement brief
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
  - llm-validation-enforcement-brief.md
source_refs:
  - path: docs/plans/llm-validation-enforcement-brief.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Llm validation enforcement brief

## Цель
Добавить technical enforcement: `evidence_level: code_confirmed` (и `test_confirmed`) требует наличия `## Code evidence` (и `## Test evidence`) секции в body card'а с конкретными symbol references. validate ERRORS при нарушении. Agent instructions tightened — memory-coder MUST output structured evidence section, memory-reviewer MUST verify section exists before promoting.

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
Требует ревью — прочитайте source_refs и код для описания потока.

## Ограничения
- `validate.ts` — existing invariants (§13 REQUIREMENTS), add new check.
- `updateMemoryCard` in `updateMemory.ts` — add pre-write check for evidence_level + body consistency.
- Agent definitions in `templates.ts` lines 888-1016 — modify instruction text.
- Evidence section parsing: simple markdown heading + bullet detection, no AST.
- `## Code evidence` / `## Test evidence` — уже упоминаются в agent instructions, но не enforced.

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
