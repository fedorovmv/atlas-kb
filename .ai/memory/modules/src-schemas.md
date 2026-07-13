---
entity_type: module
id: src-schemas
title: Src Schemas
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
  - schemas
  - artifactindex.ts
code_refs:
  - path: src/schemas/artifactIndex.ts
    kind: production
  - path: src/schemas/cardSections.ts
    kind: production
  - path: src/schemas/claim.ts
    kind: production
  - path: src/schemas/discovery.ts
    kind: production
  - path: src/schemas/dispatch.ts
    kind: production
  - path: src/schemas/docFrontmatter.ts
    kind: production
  - path: src/schemas/frontmatter.ts
    kind: production
  - path: src/schemas/legacyIngest.ts
    kind: production
  - path: src/schemas/migrateFromV3.ts
    kind: production
  - path: src/schemas/modelRouting.ts
    kind: production
  - path: src/schemas/semanticRepair.ts
    kind: production
  - path: src/schemas/session.ts
    kind: production
  - path: src/schemas/sourceContentMap.ts
    kind: production
  - path: src/schemas/sourceCoverage.ts
    kind: production
  - path: src/schemas/sourcePriority.ts
    kind: production
  - path: src/schemas/workflow.ts
    kind: production
test_refs: []
source_refs:
  - path: src/scaffold/templates/skills/memory-bootstrap.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
runtime_tier: production
---

# Src Schemas

## Ответственность
**Run completion gate first:**
```bash
.ai/memory-tool/bin/memory ls --status needs_review --json
```
If ANY cards remain — bootstrap is INCOMPLETE. Either continue dispatching or list deferred cards with reasons in `reconciliation/open-questions.md`.

Show the user:
- How many cards were created (from Phase 1).
- How many were enriched by agents (from Phase 2).
- How many still need manual review (review_required: true).
- `git diff .ai/memory/` summary.

## Не входит в ответственность
Требует ревью — определите по границам кода, импортам, соседним модулям.

## Текущее поведение
**Run completion gate first:**
```bash
.ai/memory-tool/bin/memory ls --status needs_review --json
```
If ANY cards remain — bootstrap is INCOMPLETE. Either continue dispatching or list deferred cards with reasons in `reconciliation/open-questions.md`.

Show the user:
- How many cards were created (from Phase 1).
- How many were enriched by agents (from Phase 2).
- How many still need manual review (review_required: true).
- `git diff .ai/memory/` summary.

## Известные риски
Требует ревью — проверьте TODO/FIXME/deprecated в code_refs.

## Свидетельства из кода
- Code file at src/schemas/artifactIndex.ts:1
- Code file at src/schemas/cardSections.ts:1
- Code file at src/schemas/claim.ts:1
- Code file at src/schemas/discovery.ts:1
- Code file at src/schemas/dispatch.ts:1
- Code file at src/schemas/docFrontmatter.ts:1
- Code file at src/schemas/frontmatter.ts:1
- Code file at src/schemas/legacyIngest.ts:1
- Code file at src/schemas/migrateFromV3.ts:1
- Code file at src/schemas/modelRouting.ts:1
- Code file at src/schemas/semanticRepair.ts:1
- Code file at src/schemas/session.ts:1
- Code file at src/schemas/sourceContentMap.ts:1
- Code file at src/schemas/sourceCoverage.ts:1
- Code file at src/schemas/sourcePriority.ts:1
- Code file at src/schemas/workflow.ts:1
Предварительные свидетельства из code_refs — memory-coder должен подтвердить конкретные символы.

## Свидетельства из тестов
Предварительные свидетельства из test_refs — memory-coder должен подтвердить покрытие тестами.

## Связанные файлы
- Файлов кода: 16
- Тестовых файлов: 0
- Файлов документации: 1
- Demo-файлов: 0 (НЕ production-свидетельства)

## Открытые вопросы
Требует ревью — добавьте вопросы, на которые нельзя ответить только из кода.
