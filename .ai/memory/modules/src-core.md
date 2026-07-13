---
entity_type: module
id: src-core
title: Src Core
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
  - core
  - artifactindex.ts
code_refs:
  - path: src/core/artifactIndex.ts
    kind: production
  - path: src/core/bootstrapMemory.ts
    kind: production
  - path: src/core/cardSections.ts
    kind: production
  - path: src/core/changeSurface.ts
    kind: production
  - path: src/core/claimDedup.ts
    kind: production
  - path: src/core/claimLinking.ts
    kind: production
  - path: src/core/compaction.ts
    kind: production
  - path: src/core/contentMap.ts
    kind: production
  - path: src/core/context.ts
    kind: production
  - path: src/core/discoverProject.ts
    kind: production
  - path: src/core/dispatch.ts
    kind: production
  - path: src/core/docExtraction.ts
    kind: production
  - path: src/core/docValidate.ts
    kind: production
  - path: src/core/evidenceSection.ts
    kind: production
  - path: src/core/hashing.ts
    kind: production
  - path: src/core/legacyIngest.ts
    kind: production
  - path: src/core/loadMemory.ts
    kind: production
  - path: src/core/migrateDocs.ts
    kind: production
  - path: src/core/migrateFromV3.ts
    kind: production
  - path: src/core/migratePaths.ts
    kind: production
  - path: src/core/migrateSynthesis.ts
    kind: production
  - path: src/core/modelRouting.ts
    kind: production
  - path: src/core/overview.ts
    kind: production
  - path: src/core/paths.ts
    kind: production
  - path: src/core/plan.ts
    kind: production
  - path: src/core/reconcile.ts
    kind: production
  - path: src/core/reconcileFix.ts
    kind: production
  - path: src/core/relations.ts
    kind: production
  - path: src/core/routeWorkflow.ts
    kind: production
  - path: src/core/runtimeTier.ts
    kind: production
  - path: src/core/score.ts
    kind: production
  - path: src/core/semanticRepair.ts
    kind: production
  - path: src/core/sessionTracking.ts
    kind: production
  - path: src/core/sourceCoverage.ts
    kind: production
  - path: src/core/specClassification.ts
    kind: production
  - path: src/core/specRelations.ts
    kind: production
  - path: src/core/topics.ts
    kind: production
  - path: src/core/types.ts
    kind: production
  - path: src/core/updateMemory.ts
    kind: production
  - path: src/core/utils.ts
    kind: production
  - path: src/core/validate.ts
    kind: production
test_refs: []
source_refs: []
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
runtime_tier: production
---

# Src Core

## Ответственность
Модуль с 41 файлами кода, 0 тестовыми файлами. Темы: src, core, artifactindex.ts, artifactindex, bootstrapmemory.ts, bootstrapmemory, cardsections.ts, cardsections, changesurface.ts, changesurface, claimdedup.ts, claimdedup, claimlinking.ts, claimlinking, compaction.ts, compaction, contentmap.ts, contentmap, context.ts, context, discoverproject.ts, discoverproject, dispatch.ts, dispatch, docextraction.ts, docextraction, docvalidate.ts, docvalidate, evidencesection.ts, evidencesection, hashing.ts, hashing, legacyingest.ts, legacyingest, loadmemory.ts, loadmemory, migratedocs.ts, migratedocs, migratefromv3.ts, migratefromv3, migratepaths.ts, migratepaths, migratesynthesis.ts, migratesynthesis, modelrouting.ts, modelrouting, overview.ts, overview, paths.ts, paths, plan.ts, plan, reconcile.ts, reconcile, reconcilefix.ts, reconcilefix, relations.ts, relations, routeworkflow.ts, routeworkflow, runtimetier.ts, runtimetier, score.ts, score, semanticrepair.ts, semanticrepair, sessiontracking.ts, sessiontracking, sourcecoverage.ts, sourcecoverage, specclassification.ts, specclassification, specrelations.ts, specrelations, topics.ts, topics, types.ts, types, updatememory.ts, updatememory, utils.ts, utils, validate.ts, validate. См. code_refs и source_refs.

## Не входит в ответственность
Требует ревью — определите по границам кода, импортам, соседним модулям.

## Текущее поведение
Требует ревью — прочитайте code_refs для описания поведения.

## Известные риски
Требует ревью — проверьте TODO/FIXME/deprecated в code_refs.

## Свидетельства из кода
- Code file at src/core/artifactIndex.ts:1
- Code file at src/core/bootstrapMemory.ts:1
- Code file at src/core/cardSections.ts:1
- Code file at src/core/changeSurface.ts:1
- Code file at src/core/claimDedup.ts:1
- Code file at src/core/claimLinking.ts:1
- Code file at src/core/compaction.ts:1
- Code file at src/core/contentMap.ts:1
- Code file at src/core/context.ts:1
- Code file at src/core/discoverProject.ts:1
- Code file at src/core/dispatch.ts:1
- Code file at src/core/docExtraction.ts:1
- Code file at src/core/docValidate.ts:1
- Code file at src/core/evidenceSection.ts:1
- Code file at src/core/hashing.ts:1
- Code file at src/core/legacyIngest.ts:1
- Code file at src/core/loadMemory.ts:1
- Code file at src/core/migrateDocs.ts:1
- Code file at src/core/migrateFromV3.ts:1
- Code file at src/core/migratePaths.ts:1
- Code file at src/core/migrateSynthesis.ts:1
- Code file at src/core/modelRouting.ts:1
- Code file at src/core/overview.ts:1
- Code file at src/core/paths.ts:1
- Code file at src/core/plan.ts:1
- Code file at src/core/reconcile.ts:1
- Code file at src/core/reconcileFix.ts:1
- Code file at src/core/relations.ts:1
- Code file at src/core/routeWorkflow.ts:1
- Code file at src/core/runtimeTier.ts:1
- Code file at src/core/score.ts:1
- Code file at src/core/semanticRepair.ts:1
- Code file at src/core/sessionTracking.ts:1
- Code file at src/core/sourceCoverage.ts:1
- Code file at src/core/specClassification.ts:1
- Code file at src/core/specRelations.ts:1
- Code file at src/core/topics.ts:1
- Code file at src/core/types.ts:1
- Code file at src/core/updateMemory.ts:1
- Code file at src/core/utils.ts:1
- Code file at src/core/validate.ts:1
Предварительные свидетельства из code_refs — memory-coder должен подтвердить конкретные символы.

## Свидетельства из тестов
Предварительные свидетельства из test_refs — memory-coder должен подтвердить покрытие тестами.

## Связанные файлы
- Файлов кода: 41
- Тестовых файлов: 0
- Файлов документации: 0
- Demo-файлов: 0 (НЕ production-свидетельства)

## Открытые вопросы
Требует ревью — добавьте вопросы, на которые нельзя ответить только из кода.
