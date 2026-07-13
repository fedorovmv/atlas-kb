---
entity_type: proposal
id: proposal-2027-agent-tool-registry
title: 2027-agent-tool-registry.md
status: proposed
authority: proposed
evidence_level: spec_only
stability: experimental
source_confidence: low
last_reviewed: '2026-07-13'
review_required: true
knowledge_types:
  - proposed_behavior
source_refs:
  - path: examples/synapse-mini/specs/2027-agent-tool-registry.md
    role: spec
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# 2027-agent-tool-registry.md (proposal)

## Исходная спецификация
examples/synapse-mini/specs/2027-agent-tool-registry.md

## Предлагаемое поведение
1. The registry SHALL maintain a list of agent cards (capabilities,
   endpoints, version).
2. Every discovery request MUST be scoped to the caller's service identity.
3. The registry SHALL return only the cards visible to the requesting caller.
4. The filtering logic lives in `internal/registry/access_filter.go`.
5. This component is NOT an orchestration layer.

## Обоснование из спецификации
Требует ревью — извлеките обоснование из исходной спецификации.

## Затронутые модули
Требует ревью — какие модули изменит это предложение?

## Затронутые сценарии
Требует ревью — какие сценарии изменит это предложение?

## Затронутые решения
Требует ревью — какие решения затронет это предложение?

## Проверка текущего кода
Требует ревью — memory-coder должен проверить, частично ли предложение уже реализовано.

## Утверждения
- Registry filters available agent cards by caller service identity
  (see `internal/registry/access_filter.go`, `FilterCardsForCaller`).
- Agent cards follow the A2A Agent Cards schema.
- The registry is a query-only discovery service; it does not mediate
  inter-agent communication.

## Решение по ревью
Требует ревью — memory-reviewer решает: принять, отклонить или нужно больше свидетельств.
