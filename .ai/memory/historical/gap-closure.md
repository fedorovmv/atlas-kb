---
entity_type: historical
id: historical-gap-closure
title: GAP_CLOSURE_SPEC.md
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
  - path: docs/specs/GAP_CLOSURE_SPEC.md
    role: historical
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# GAP_CLOSURE_SPEC.md (historical)

## Какая проблема решалась
**Цель**: TypeScript-реализация `ts-kb-flow` (`repo-memory-opencode-kit`) объявляется целевой. Она должна получить весь функционал v3 (3.6.19), но только под OpenCode runtime (без OMP dual-runtime).

**Исключено из переноса**:
- Oh My Pi (OMP) адаптеры, плагины, расширения, watchdog
- Dual-runtime команды и декларативные адаптеры для OMP
- Всё, что не относится к memory bank и workflow orchestration

**Принципы переноса**:
1. Сохранить сильные стороны ts-kb-flow: Zod-типизация, claim-evidence модель, atomic writes, best-effort loading
2. Перенести недостающие механизмы v3, адаптировав к TypeScript-стеку
3. Не дублировать: если v3-фича уже есть в ts-kb-flow в другой форме — расширить, не переписывать
4. CLI/LLM-разделение труда сохраняется: CLI детерминирован, LLM вызывается через OpenCode agents
5. Контракт-first подход v3: required cards, source coverage, specialist dispatch gating — переносятся как обязательные

**Базовая paths-конвенция ts-kb-flow**:
- Memory: `.ai/memory/*.md`
- Config: `.ai/memory-tool/config/`
- Build intermediates: `.ai/memory-build/latest/`
- OpenCode: `.opencode/`

---

## Актуальное обоснование
v3's hard-gate dispatch (impersonation detection, generic agent rejection, hard-gate validation) был разработан для OMP dual-runtime, где builder agents могут имперсонировать specialists. В контексте OpenCode-only с уже enforced fresh-subagent-isolation полный hard-gate не нужен.

**Binding решение**: Soft advisory — записывать dispatch попытки в JSONL для аудита, предупреждать о несоответствиях, БЕЗ hard-gate валидации, которая генерирует ошибки. OpenCode fresh-subagent-isolation уже обеспечивает изоляцию.

**Влияние**: C1 упрощён (нет finalizeDispatch, нет specialist-dispatch.json, только warnings). C2/C3 больше не нужны для dispatch enforcement.

## Устаревшие идеи
Требует ревью — что больше не применимо?

## Выжившие решения
Требует ревью — какие решения из этой спецификации перенесены?

## Ссылки на текущие решения
Требует ревью — ссылки на текущие карточки решений, заменяющие эту.
