---
entity_type: historical
id: historical-2025-agent-routing
title: 2025-agent-routing.md
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
  - path: examples/synapse-mini/specs/legacy/2025-agent-routing.md
    role: historical
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# 2025-agent-routing.md (historical)

## Какая проблема решалась
The 2025 routing specification described a centralized message router that
received all inter-agent requests and forwarded them based on a global
routing table. This approach became a bottleneck and was replaced by
identity-scoped agent discovery (see `../2027-agent-tool-registry.md`).

## Актуальное обоснование
- A single routing service sat between all callers and agents.
- The routing table was a static map of agent-name → endpoint.
- No per-callerscoping existed; every caller could discover every agent.
- The router also transformed request payloads, which added latency
  and coupling.

This spec is retained for historical context only.

## Устаревшие идеи
Требует ревью — что больше не применимо?

## Выжившие решения
Требует ревью — какие решения из этой спецификации перенесены?

## Ссылки на текущие решения
Требует ревью — ссылки на текущие карточки решений, заменяющие эту.
