---
description: Process a new spec into proposal/rationale/conflict memory updates
agent: memory-reviewer
---

Use the memory-ingest-spec skill.

Spec path:
$ARGUMENTS

Steps:
1. Read the spec.
2. Read `.ai/memory/ontology.md`.
3. Run memory context for the spec topic.
4. Classify the spec.
5. Extract proposed behavior and rationale.
6. Check related code/test evidence.
7. Create or update a proposal in `.ai/memory/proposals/`.
8. Update conflicts/open-questions if needed.
9. Do not update Current behavior unless evidence confirms it.
10. Show final diff and review notes.
