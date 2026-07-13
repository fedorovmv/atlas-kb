---
description: One-command LLM-assisted memory bank population — bootstrap + agent enrichment
---

Use the memory-bootstrap skill.

You are the orchestrator. Run the full pipeline yourself, dispatching subagents for each role:

1. **Scaffold**: Run `.ai/memory-tool/bin/memory bootstrap --root .` — deterministic CLI creates skeleton cards: module cards from code, decision/proposal/historical cards from specs/docs. All with placeholder content. Enriched cards (review_required=false or evidence_level=code_confirmed) are preserved automatically.
2. **List needs_review**: Run `.ai/memory-tool/bin/memory ls --status needs_review --json` — get cards to enrich.
3. **Enrich by card type** (dispatch subagents, do NOT do the work yourself):

   **CRITICAL — one card per subagent dispatch.** Never bundle multiple cards into a single subagent task. Each subagent gets exactly one card, reads its source_refs, fills content, returns. This keeps context bounded and quality high.

   **Concurrency limit — max 5 parallel subagents.** Dispatch in batches of 5. Wait for each batch to complete before starting next batch. Subagents are lightweight (one card, bounded context), so 5 parallel is safe.

   **MUST COMPLETE ALL STAGES.** Do NOT stop after module enrichment. The pipeline has 4 mandatory subagent dispatch stages. Complete ALL before reporting "done":

   ```
   Stage A: module cards      → extractor → coder → reviewer
   Stage B: scenario cards    → extractor → coder → reviewer
   Stage C: decision/proposal/historical cards → analyst → coder (proposals only) → reviewer
   Stage D: validate + summary
   ```

   If you stop after Stage A or B without completing Stage C (analyst for decision/proposal/historical), the bootstrap is INCOMPLETE. Decision cards will have placeholder rationale "Требует ревью — какие альтернативы были рассмотрены?" — this is unacceptable.

   - **module cards** → for EACH module card: dispatch `memory-extractor` with that one card path (reads code_refs, fills Ответственность/Поведение) → then dispatch `memory-coder` with same card (verifies symbols, adds Свидетельства из кода) → then `memory-reviewer` (quality gate, promotes needs_review→current).
   - **decision/proposal/historical cards** → for EACH card: dispatch `memory-analyst` with that one card path (reads source_refs/specs, extracts Rationale/Alternatives/Consequences) → then `memory-coder` (for proposal cards: checks if proposed behavior is partially implemented) → then `memory-reviewer` (quality gate, promotes decision→current, keeps proposal→proposed).
   - **scenario cards** → for EACH scenario card: dispatch `memory-extractor` (reads source_refs, fills Цель/Участники/Поток выполнения/Связанные модули/Связанные тесты) → then `memory-coder` (verifies flow against code, fills Свидетельства из кода/тестов) → then `memory-reviewer`.

   Subagent dispatch prompt template:
   ```
   You are memory-<role> agent. Your task is to enrich ONE card: <card path>.

   1. Read the card file: <card path>
   2. Read its source_refs/code_refs files (from frontmatter)
   3. Fill in card body sections per your agent instructions
   4. Use updateCard tool to save — NEVER use Write tool
   ```

4. **Validate**: Run `.ai/memory-tool/bin/memory validate` — ensure no errors. Fix if needed.
5. **Summary**: Show card counts by type (created/enriched/still-needs-review) and `git diff .ai/memory/`.

Do NOT ask the user to manually classify specs or fill cards. The subagents do this automatically.

Arguments (optional): $ARGUMENTS — if a specific path or topic is given, focus enrichment on matching cards only.
