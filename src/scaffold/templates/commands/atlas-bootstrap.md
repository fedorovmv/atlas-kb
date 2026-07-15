---
description: One-command LLM-assisted memory bank population — bootstrap + agent enrichment
---

**MANDATORY: Load the `atlas-bootstrap` skill using the `skill` tool BEFORE doing anything else.** Do NOT proceed without loading it — the skill contains the full pipeline you must follow. Without it you have only this short command file and will miss critical instructions.

You are the orchestrator. Run the full pipeline yourself, dispatching subagents for each role. This is NOT a question — the user wants the FULL pipeline. Do NOT ask "Would you like me to proceed?" — just do it.

**THIS IS A LOOP, NOT A LINE.** You repeat STEP 2→3→4 until `ls --needs-enrichment` returns `[]` AND `ls --status needs_review` returns `[]`. Only then report "done". If you stop early — the user will have to re-run `/atlas-bootstrap` manually, which is unacceptable.

Arguments (optional): $ARGUMENTS — if a specific path or topic is given, focus enrichment on matching cards only.
