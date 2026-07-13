---
entity_type: module
id: src-commands
title: Src Commands
status: needs_review
authority: reviewed_memory
evidence_level: heuristic_match
stability: evolving
source_confidence: low
last_reviewed: '2026-07-13'
review_required: true
knowledge_types:
  - current_behavior
product_areas:
  - src
  - commands
  - artifactssearch.ts
code_refs:
  - path: src/commands/artifactsSearch.ts
    kind: production
  - path: src/commands/bootstrap.ts
    kind: production
  - path: src/commands/compact.ts
    kind: production
  - path: src/commands/context.ts
    kind: production
  - path: src/commands/contextCheck.ts
    kind: production
  - path: src/commands/discover.ts
    kind: production
  - path: src/commands/ingestSpec.ts
    kind: production
  - path: src/commands/init.ts
    kind: production
  - path: src/commands/legacyIngest.ts
    kind: production
  - path: src/commands/ls.ts
    kind: production
  - path: src/commands/migrateFromV3.ts
    kind: production
  - path: src/commands/openspec.ts
    kind: production
  - path: src/commands/plan.ts
    kind: production
  - path: src/commands/profile.ts
    kind: production
  - path: src/commands/reconcile.ts
    kind: production
  - path: src/commands/related.ts
    kind: production
  - path: src/commands/render.ts
    kind: production
  - path: src/commands/route.ts
    kind: production
  - path: src/commands/semanticRepair.ts
    kind: production
  - path: src/commands/session.ts
    kind: production
  - path: src/commands/show.ts
    kind: production
  - path: src/commands/triage.ts
    kind: production
  - path: src/commands/update.ts
    kind: production
  - path: src/commands/validate.ts
    kind: production
test_refs: []
source_refs:
  - path: src/scaffold/templates/commands/memory-bootstrap.md
    role: current_doc
  - path: src/scaffold/templates/commands/memory-context.md
    role: current_doc
  - path: src/scaffold/templates/commands/memory-ingest-spec.md
    role: current_doc
  - path: src/scaffold/templates/commands/memory-reconcile.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
runtime_tier: production
---

# Src Commands

## Ответственность
description: One-command LLM-assisted memory bank population — bootstrap + agent enrichment Use the memory-bootstrap skill. You are the orchestrator. Run the full pipeline yourself, dispatching subagents for each role: 1. **Scaffold**: Run `.ai/memory-tool/bin/memory bootstrap --root .` — deterministic CLI creates skeleton cards: module cards from code, decision/proposal/historical cards from specs/docs. All with placeholder content. Enriched cards (review_required=false or evidence_level=code_c...

## Не входит в ответственность
Требует ревью — определите по границам кода, импортам, соседним модулям.

## Текущее поведение
description: One-command LLM-assisted memory bank population — bootstrap + agent enrichment Use the memory-bootstrap skill. You are the orchestrator. Run the full pipeline yourself, dispatching subagents for each role: 1. **Scaffold**: Run `.ai/memory-tool/bin/memory bootstrap --root .` — deterministic CLI creates skeleton cards: module cards from code, decision/proposal/historical cards from specs/docs. All with placeholder content. Enriched cards (review_required=false or evidence_level=code_c...

## Известные риски
Требует ревью — проверьте TODO/FIXME/deprecated в code_refs.

## Свидетельства из кода
- Code file at src/commands/artifactsSearch.ts:1
- Code file at src/commands/bootstrap.ts:1
- Code file at src/commands/compact.ts:1
- Code file at src/commands/context.ts:1
- Code file at src/commands/contextCheck.ts:1
- Code file at src/commands/discover.ts:1
- Code file at src/commands/ingestSpec.ts:1
- Code file at src/commands/init.ts:1
- Code file at src/commands/legacyIngest.ts:1
- Code file at src/commands/ls.ts:1
- Code file at src/commands/migrateFromV3.ts:1
- Code file at src/commands/openspec.ts:1
- Code file at src/commands/plan.ts:1
- Code file at src/commands/profile.ts:1
- Code file at src/commands/reconcile.ts:1
- Code file at src/commands/related.ts:1
- Code file at src/commands/render.ts:1
- Code file at src/commands/route.ts:1
- Code file at src/commands/semanticRepair.ts:1
- Code file at src/commands/session.ts:1
- Code file at src/commands/show.ts:1
- Code file at src/commands/triage.ts:1
- Code file at src/commands/update.ts:1
- Code file at src/commands/validate.ts:1
Предварительные свидетельства из code_refs — memory-coder должен подтвердить конкретные символы.

## Свидетельства из тестов
Предварительные свидетельства из test_refs — memory-coder должен подтвердить покрытие тестами.

## Связанные файлы
- Файлов кода: 24
- Тестовых файлов: 0
- Файлов документации: 4
- Demo-файлов: 0 (НЕ production-свидетельства)

## Открытые вопросы
Требует ревью — добавьте вопросы, на которые нельзя ответить только из кода.
