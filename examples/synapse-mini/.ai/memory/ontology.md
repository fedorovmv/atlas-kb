---
entity_type: ontology
id: memory-ontology
title: Memory Ontology
status: current
authority: source_of_truth
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
  - design_rationale
product_areas: []
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Memory Ontology

The memory bank is not a document archive. It is the current engineering understanding of the product, including behavior, rationale, historical context, proposals, conflicts, and open questions.

## Knowledge types

| Type | Meaning | Can update current behavior? |
|---|---|---|
| current_behavior | Confirmed actual behavior | yes, only with evidence |
| proposed_behavior | Described by a new spec, not confirmed yet | no |
| design_rationale | Why a decision was made | no, but can constrain changes |
| historical_context | Old specs and previous assumptions | no |
| code_evidence | Code/test/contract confirmation | yes |
| open_question | Something unresolved | no |
| conflict | Contradiction between sources | no |

## Entity types

- product_map
- architecture
- module
- scenario
- decision
- proposal
- historical
- conflict
- open_question

## Core relation types

- affects
- implements
- tests
- documents
- motivates
- proposes
- rejects
- conflicts_with
- supersedes

## Current behavior rule

Current behavior must be confirmed by code, tests, contracts, or explicit review. Specs and rationale alone are not enough.
