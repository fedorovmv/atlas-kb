# Agent Registry

## Overview

The Agent Registry is a discovery service that manages available agent cards
and controls which agents a calling service may discover or invoke. It is
**not** an orchestration or mediation layer — it does not route messages,
transform payloads, or enforce request ordering. Its sole concern is providing
the correct view of available agents to each caller.

## Responsibilities

- **Filter by caller identity.** Every discovery request is scoped to the
  calling service. The registry returns only the agent cards that the caller
  is authorized to see, using the logic in `internal/registry/access_filter.go`.

- **Serve agent cards in A2A format.** Registered agents are exposed as
  structured agent cards (Agent Cards v0.2.0 compatible) so that clients
  can perform self-service discovery without manual configuration.

- **Keep a single source of truth.** The registry reads from and writes to
  the project's knowledge base (`.ai/memory`) so that the same cards used
  by operators are the cards seen by consumers.

## Flows

1. **Registration.** A new agent publishes its card (capabilities,
   endpoints, version) to the registry. The card is stored alongside the
   rest of the knowledge base and receives an access filter entry.

2. **Discovery.** A caller sends its service identity to the registry.
   The registry filters the card set using `FilterCardsForCaller` and
   returns the subset relevant to that caller.

3. **Invocation.** The caller uses the returned card information directly
   to contact the agent (A2A protocol). The registry is **not** involved
   in the request path after discovery.
