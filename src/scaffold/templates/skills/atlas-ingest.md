---
name: atlas-ingest
description: Process a new product spec into proposals, rationale, conflicts, and safe memory updates.
---

# Memory Ingest Spec Skill

## Goal

Convert a new spec into safe memory updates.

## Steps

1. Classify the spec: document type, product area, modules, scenarios, decisions.
2. Extract proposed behavior, problem, value, rationale, constraints, alternatives, risks, acceptance criteria, open questions.
3. Compare with current memory: modules, scenarios, decisions, proposals, historical cards.
4. Check code evidence using code_refs/test_refs and repository search.
5. Create or update a proposal in `.ai/memory/proposals/`.
6. Update decisions only for rationale, not as direct code instructions.
7. Update conflicts/open-questions where needed.
8. Update Current behavior only if confirmed by code, tests, contracts, or explicit review.

## Forbidden

- Do not mark proposed behavior as current without evidence.
- Do not delete historical rationale.
- Do not treat historical specs as implementation guides.
- Do not silently resolve conflicts.
