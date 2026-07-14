---
description: One-command LLM-assisted memory bank population — bootstrap + agent enrichment
---

Use the memory-bootstrap skill.

You are the orchestrator. Run the full pipeline yourself, dispatching subagents for each role. This is NOT a question — the user wants the FULL pipeline. Do NOT ask "Would you like me to proceed?" — just do it.

**THIS IS A LOOP, NOT A LINE.** You repeat STEP 2→3→4 until `ls --needs-enrichment` returns `[]` AND `ls --status needs_review` returns `[]`. Only then report "done". If you stop early — the user will have to re-run `/memory-bootstrap` manually, which is unacceptable.

## STEP 1 — Scaffold (run ONCE)

Run: `.ai/memory-tool/bin/memory bootstrap --root .`
Then run: `.ai/memory-tool/bin/memory ls --needs-enrichment --json`
Save the output.

## STEP 2 — Enrich cards (REPEAT until needs-enrichment is empty)

Take the FIRST 5 cards from `needs-enrichment` output. Dispatch ONE subagent per card (max 5 parallel). Card type → agent:
- module/scenario → memory-extractor → memory-coder
- decision/proposal/historical/architecture/reference → memory-analyst

Subagent prompt:
```
You are memory-<role> agent. Enrich ONE card: <card path>.
Leaf subagent — do ALL work yourself, use memory_updateCard tool, do NOT spawn tasks.
1. Read card file 2. Read source_refs/code_refs 3. Fill sections 4. Save via memory_updateCard
```

After batch completes, run `.ai/memory-tool/bin/memory ls --needs-enrichment --json`. If still >0 — dispatch next batch. Repeat until empty.

## STEP 3 — Promote cards (REPEAT until needs_review is empty)

Run: `.ai/memory-tool/bin/memory ls --status needs_review --json`

Take FIRST 5 needs_review cards. Dispatch `memory-reviewer` for EACH (max 5 parallel). Reviewer promotes needs_review→current or defers to open-questions.md.

After batch completes, run `ls --status needs_review --json`. If still >0 — dispatch next batch. Repeat until empty.

## STEP 4 — Check if done

Run BOTH:
```bash
.ai/memory-tool/bin/memory ls --needs-enrichment --json
.ai/memory-tool/bin/memory ls --status needs_review --json
```

If BOTH return `[]` — run `.ai/memory-tool/bin/memory validate`, show summary, report "done".
If EITHER returns cards — go back to STEP 2. Do NOT report "done". Do NOT ask the user. Loop.

Do NOT ask the user to manually classify specs or fill cards. The subagents do this automatically.
Arguments (optional): $ARGUMENTS — if a specific path or topic is given, focus enrichment on matching cards only.
