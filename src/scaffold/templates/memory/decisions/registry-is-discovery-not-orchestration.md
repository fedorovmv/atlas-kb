---
entity_type: decision
id: registry-is-discovery-not-orchestration
title: Registry is discovery, not orchestration
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - design_rationale
  - current_behavior
product_areas:
  - api-mesh
  - ai-runtime
affects_modules:
  - agent-tool-registry
affects_scenarios:
  - a2a-agent-discovery
related_modules:
  - agent-tool-registry
related_scenarios:
  - a2a-agent-discovery
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Decision: Registry is discovery, not orchestration

## Context

The product needs a way for agents and tools to discover available metadata inside Synapse API Mesh.

## Problem

If registry responsibilities are not explicit, it can be mistaken for a runtime orchestrator that chooses agents or executes calls.

## Decision

Registry is a discovery component. It stores and exposes metadata and access-filtered availability. It does not choose target agents and does not execute runtime calls.

## Rationale

This boundary keeps the component simple and avoids mixing metadata discovery, business decisions, and runtime execution.

## Alternatives considered

- Registry as metadata store only (without filtering)
- Registry as runtime orchestrator

## Rejected alternatives

### Registry as runtime orchestrator

Status: rejected.

Reason: this mixes discovery and runtime responsibilities and creates incorrect expectations about the registry.

## Consequences

- Agent selection remains outside registry.
- Runtime checks must be described separately.
- Code changes around registry must preserve this boundary unless a new decision supersedes it.

## Current behavior evidence

- FilterCardsForCaller in internal/registry/access_filter.go enforces discovery-only behavior.

## Affected modules

- agent-tool-registry

## Affected scenarios

- a2a-agent-discovery
