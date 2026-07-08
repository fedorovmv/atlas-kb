# Agent & Tool Registry 2027

Status: accepted
Status: implemented

## Background

Synapse Mini needed a single, versioned specification that describes how
agents and their tool interfaces are registered and discovered. This spec
replaces the ad-hoc routing conventions from 2025 and introduces
identity-scoped filtering so that each service sees only the agents it
is authorized to use.

## Requirements

1. The registry SHALL maintain a list of agent cards (capabilities,
   endpoints, version).
2. Every discovery request MUST be scoped to the caller's service identity.
3. The registry SHALL return only the cards visible to the requesting caller.
4. The filtering logic lives in `internal/registry/access_filter.go`.
5. This component is NOT an orchestration layer.

## Claims

- Registry filters available agent cards by caller service identity
  (see `internal/registry/access_filter.go`, `FilterCardsForCaller`).
- Agent cards follow the A2A Agent Cards schema.
- The registry is a query-only discovery service; it does not mediate
  inter-agent communication.
