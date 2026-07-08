# Agent Routing 2025 (deprecated)

Status: deprecated

## Background

The 2025 routing specification described a centralized message router that
received all inter-agent requests and forwarded them based on a global
routing table. This approach became a bottleneck and was replaced by
identity-scoped agent discovery (see `../2027-agent-tool-registry.md`).

## Prior approach

- A single routing service sat between all callers and agents.
- The routing table was a static map of agent-name → endpoint.
- No per-callerscoping existed; every caller could discover every agent.
- The router also transformed request payloads, which added latency
  and coupling.

This spec is retained for historical context only.
