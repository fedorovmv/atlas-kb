---
entity_type: readme
id: memory-readme
title: Memory Bank README
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
product_areas: []
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Project Memory Bank

Read this first before using repository memory.

## Required reading order

1. `.ai/memory/README.md`
2. `.ai/memory/ontology.md`
3. Relevant module cards
4. Relevant scenario cards
5. Relevant decision cards
6. Proposals and historical cards only when needed

## Source priority

1. Current code
2. Current tests
3. API contracts / schemas
4. Reviewed memory
5. Current docs
6. Reviewed specs
7. New specs
8. Historical specs
9. Demo modules

## Critical rules

- A new spec is proposed behavior, not current behavior.
- Historical specs may preserve rationale but must not override current code.
- Demo code is example-only unless explicitly marked otherwise.
- Do not implement from rationale alone.
- If sources conflict, record the conflict instead of silently resolving it.
