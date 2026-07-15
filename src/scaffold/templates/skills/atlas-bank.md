---
name: atlas-bank
description: Use repository memory bank before product, architecture, or behavior changes.
---

# Memory Bank Skill

Use this skill when changing product behavior, architecture boundaries, specs, or documentation.

## Required reading order

1. `.ai/memory/README.md`
2. `.ai/memory/ontology.md`
3. Relevant module cards
4. Relevant scenario cards
5. Relevant decision cards
6. Proposals and historical cards only when needed

## Before editing code

Run:

```bash
.ai/atlas/bin/atlas recall "$ARGUMENTS"
```

Then read related module, scenario, decision, code and test references.

## Critical rules

- Current behavior must be confirmed by code, tests, contracts, or reviewed memory. CLI heuristic_match is a candidate, not confirmation.
- New specs are proposed behavior, not current behavior.
- Historical specs may preserve rationale but must not override current code.
- Demo code is example-only unless explicitly marked otherwise.
- Do not implement from rationale alone.
- If sources conflict, write the conflict to `.ai/memory/reconciliation/conflicts.md`.
- If information is missing, write an open question to `.ai/memory/reconciliation/open-questions.md`.
