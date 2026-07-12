---
description: One-command LLM-assisted memory bank population — bootstrap + agent enrichment
---

Use the memory-bootstrap skill.

You are the orchestrator. Run the full pipeline yourself, dispatching subagents for each role:

1. **Scaffold**: Run `npm run memory -- bootstrap --root .` — deterministic CLI creates skeleton cards with code_refs/test_refs but placeholder content. Enriched cards (review_required=false or evidence_level=code_confirmed) are preserved automatically.
2. **List needs_review**: Run `npm run memory -- ls --status needs_review --json` — get cards to enrich.
3. **Enrich**: For each `needs_review` card, dispatch subagents (do NOT do the work yourself):
   - Dispatch `memory-extractor` subagent: it reads code_refs, fills Responsibility/Non-responsibilities/Current behavior/Known risks using the `updateCard` tool.
   - After extractor completes, dispatch `memory-coder` subagent: it verifies code evidence, adds Code evidence/Test evidence sections, sets evidence_level using the `updateCard` tool.
   - After coder completes, dispatch `memory-reviewer` subagent: it checks quality, promotes needs_review→current only with code_confirmed, sets review_required=false.
4. **Validate**: Run `npm run memory -- validate` — ensure no errors. Fix if needed.
5. **Summary**: Show card counts (created/enriched/still-needs-review) and `git diff .ai/memory/`.

Do NOT ask the user to manually classify specs or fill cards. The subagents do this automatically.

Arguments (optional): $ARGUMENTS — if a specific path or topic is given, focus enrichment on matching cards only.
