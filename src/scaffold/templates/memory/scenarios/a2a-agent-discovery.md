---
entity_type: scenario
id: a2a-agent-discovery
title: A2A Agent Discovery
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
  - design_rationale
product_areas:
  - ai-runtime
aliases:
  - agent discovery
  - agent card discovery
  - a2a discovery
related_modules:
  - agent-tool-registry
related_decisions:
  - registry-is-discovery-not-orchestration
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Scenario: A2A Agent Discovery

## Goal

A calling agent discovers available agent cards before invoking a target service through the mesh.

## Flow

1. Calling agent requests available agent cards.
2. Registry filters cards according to caller identity and policies.
3. Calling agent receives available cards.
4. Calling agent invokes the selected target service through mesh/runtime.

## Constraints

- Registry does not choose the target agent.
- Registry does not execute target calls.
- Historical specs cannot override current runtime behavior.
