---
entity_type: module
id: src-scaffold
title: Src Scaffold
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
  - scaffold
  - templates.ts
code_refs:
  - path: src/scaffold/templates.ts
    kind: production
test_refs: []
source_refs:
  - path: src/scaffold/templates/AGENTS.md
    role: current_doc
  - path: src/scaffold/templates/agents/memory-analyst.md
    role: current_doc
  - path: src/scaffold/templates/agents/memory-coder.md
    role: current_doc
  - path: src/scaffold/templates/agents/memory-extractor.md
    role: current_doc
  - path: src/scaffold/templates/agents/memory-reviewer.md
    role: current_doc
  - path: src/scaffold/templates/commands/memory-bootstrap.md
    role: current_doc
  - path: src/scaffold/templates/commands/memory-context.md
    role: current_doc
  - path: src/scaffold/templates/commands/memory-ingest-spec.md
    role: current_doc
  - path: src/scaffold/templates/commands/memory-reconcile.md
    role: current_doc
  - path: src/scaffold/templates/memory/ARCHITECTURE.md
    role: current_doc
  - path: src/scaffold/templates/memory/DECISIONS.md
    role: current_doc
  - path: src/scaffold/templates/memory/decisions/registry-is-discovery-not-orchestration.md
    role: current_doc
  - path: src/scaffold/templates/memory/MEMORY.md
    role: current_doc
  - path: src/scaffold/templates/memory/MODULES.md
    role: current_doc
  - path: src/scaffold/templates/memory/modules/agent-tool-registry.md
    role: current_doc
  - path: src/scaffold/templates/memory/modules/mcp-gateway.md
    role: current_doc
  - path: src/scaffold/templates/memory/ontology.md
    role: current_doc
  - path: src/scaffold/templates/memory/product-map.md
    role: current_doc
  - path: src/scaffold/templates/memory/README.md
    role: current_doc
  - path: src/scaffold/templates/memory/reconciliation/conflicts.md
    role: current_doc
  - path: src/scaffold/templates/memory/reconciliation/open-questions.md
    role: current_doc
  - path: src/scaffold/templates/memory/scenarios/a2a-agent-discovery.md
    role: current_doc
  - path: src/scaffold/templates/memory/scenarios/mcp-tool-discovery.md
    role: current_doc
  - path: src/scaffold/templates/skills/memory-bank.md
    role: current_doc
  - path: src/scaffold/templates/skills/memory-bootstrap.md
    role: current_doc
  - path: src/scaffold/templates/skills/memory-ingest-spec.md
    role: current_doc
  - path: src/scaffold/templates/skills/memory-reconcile.md
    role: current_doc
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
runtime_tier: production
---

# Src Scaffold

## Ответственность
# Project Instructions

## Не входит в ответственность
Требует ревью — определите по границам кода, импортам, соседним модулям.

## Текущее поведение
# Project Instructions

## Известные риски
Требует ревью — проверьте TODO/FIXME/deprecated в code_refs.

## Свидетельства из кода
- Code file at src/scaffold/templates.ts:1
Предварительные свидетельства из code_refs — memory-coder должен подтвердить конкретные символы.

## Свидетельства из тестов
Предварительные свидетельства из test_refs — memory-coder должен подтвердить покрытие тестами.

## Связанные файлы
- Файлов кода: 1
- Тестовых файлов: 0
- Файлов документации: 27
- Demo-файлов: 0 (НЕ production-свидетельства)

## Открытые вопросы
Требует ревью — добавьте вопросы, на которые нельзя ответить только из кода.
