---
entity_type: scenario
id: scenario-kb-gaps-plan
title: Kb gaps plan
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
  - kb-gaps-plan.md
source_refs:
  - path: docs/plans/kb-gaps-plan.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Kb gaps plan

## Цель
**Outcome:** Context packs include conflicts/open-questions, per-card `usage_policy`, and config-driven source priority from existing `source-priority.yaml` template.

**Likely files:**
- `src/schemas/sourcePriority.ts` (new — zod schema for existing yaml format)
- `src/core/context.ts`
- `src/index.ts`
- `test/context-related.test.ts`

**Implementation steps:**
1. `src/schemas/sourcePriority.ts`: zod schema matching existing template format at `src/scaffold/templates.ts:544-561`: `{ priority: string[], rules: string[] }`.
2. Add `loadSourcePriority(options)` to load+validate `.ai/memory-tool/config/source-priority.yaml` (note: template path is `.ai/memory-tool/config/`, NOT `.ai/memory/config/` — verify against scaffold). If absent, use default priority order from REQUIREMENTS §4.
3. `buildMemoryContext`:
   - Load source priority config (best-effort; default if missing).
   - Render source priority section from config (data-driven, not hardcoded text).
   - Include per-card `usage_policy` block in compact excerpt rendering (can_answer_current_behavior, can_generate_code_from, can_use_as_rationale, can_use_as_example, requires_code_check_before_change, requires_warning).
   - Load `.ai/memory/reconciliation/conflicts.md` and `.ai/memory/reconciliation/open-questions.md` (explicit paths under memory root); include excerpts when non-empty.
   - Aggregate per-card `conflicts_with` ids and surface in context.
4. Preserve existing behavior when config/reconciliation absent (graceful fallback).

**Tests-first / verification (unit, this task):**
- Existing context tests still pass (regression).
- New test: project with source-priority.yaml → context markdown contains configured priority order.
- New test: project with conflicts.md content → context includes conflicts section.
- New test: context excerpt includes usage_policy fields.
- Negative: malformed source-priority.yaml → falls back to default, no crash.

**Completion evidence:**
- `test/context-related.test.ts` new cases pass.
- Existing cases pass.

References: REQUIREMENTS §4, §6; design §5. Compat: context output format changes — additive sections, existing consumers still get prior sections. Rollback: revert context.ts. Existing memory files unaffected.

---

## Участники
Требует ревью — определите участников из кода/тестов/документации.

## Поток выполнения
Требует ревью — прочитайте source_refs и код для описания потока.

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
Требует ревью — почему существует этот сценарий, а не другой?
