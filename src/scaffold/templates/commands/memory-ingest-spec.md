---
description: Process a new spec into proposal/rationale/conflict memory updates
---

You are the orchestrator. Use the memory-ingest-spec skill.

Spec path:
$ARGUMENTS

Steps (dispatch subagents for each role, do NOT do all work yourself):

1. Read the spec and `.ai/memory/ontology.md` yourself.
2. Run `.ai/memory-tool/bin/memory context "$ARGUMENTS" --json` to get related memory.
3. Dispatch `memory-analyst` subagent: it reads the spec deeply, extracts rationale/constraints/alternatives, fills decision card sections, performs semantic claim matching against existing memory.
4. Dispatch `memory-coder` subagent: it checks claims against code/test evidence, returns evidence results.
5. Dispatch `memory-reviewer` subagent: it decides proposal/historical/conflict, creates the card using `memory_updateCard` tool or `.ai/memory-tool/bin/memory ingest-spec`, updates conflicts/open-questions if needed.
6. Run `.ai/memory-tool/bin/memory validate` — ensure no errors.
7. Show final diff and review notes.

Do NOT update Current behavior unless evidence confirms it.
