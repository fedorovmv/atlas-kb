---
description: Build a compact memory context pack for a task
agent: atlas-coder
---

Use the atlas-bank skill. **Load it via the `skill` tool first.**

Task:
$ARGUMENTS

Steps:
1. Read `.ai/memory/README.md` and `.ai/memory/ontology.md`.
2. Run: `.ai/atlas/bin/atlas recall "$ARGUMENTS"`.
3. Read the recommended memory files.
4. Summarize relevant modules, scenarios, decisions, code paths, tests, conflicts, open questions, and things that must not be assumed.
