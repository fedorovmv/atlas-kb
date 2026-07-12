---
entity_type: module
id: agent-tool-registry
title: Agent & Tool Registry
status: current
authority: reviewed_memory
evidence_level: code_confirmed
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
  - design_rationale
product_areas:
  - api-mesh
  - ai-runtime
aliases:
  - agent registry
  - tool registry
  - agent card registry
  - реестр агентских карточек
related_modules:
  - mcp-gateway
related_scenarios:
  - a2a-agent-discovery
related_decisions:
  - registry-is-discovery-not-orchestration
code_refs:
  - path: internal/registry
    kind: production
  - path: pkg/agentcard
    kind: production
test_refs:
  - path: tests/agent-registry
    kind: integration
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Agent & Tool Registry

## Responsibilities

Registry stores and exposes agent/tool metadata for discovery and filters availability according to service identity and access policy.

## Non-responsibilities

- Choosing the target agent
- Business orchestration
- Runtime execution of target calls

## Current behavior

Calling agents use discovery metadata to find available targets. Runtime calls are performed through the mesh/runtime path, not by the registry itself.

## Related scenarios

- a2a-agent-discovery

## Related decisions

- registry-is-discovery-not-orchestration

## Code references

- `internal/registry`
- `pkg/agentcard`

## Test references

- `tests/agent-registry`

## Known risks

- Filter logic may need updates as access policies evolve.

## Open questions

- Which checks belong to discovery time and which belong to runtime time?

## Why these boundaries

Registry remains a discovery component to avoid mixing metadata storage, target selection, and runtime orchestration.

## Code evidence

- Registry and filtering at internal/registry/access_filter.go:42 (FilterCardsForCaller)
