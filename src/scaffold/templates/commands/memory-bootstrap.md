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

   **Progress tracking — MANDATORY.** After each batch, run `.ai/memory-tool/bin/memory ls --status needs_review --json` and count remaining. Do NOT advance to next stage until current stage has 0 needs_review cards of that entity_type.

   **Completion gate — MANDATORY.** Before reporting "done", run `.ai/memory-tool/bin/memory ls --status needs_review --json`. If ANY cards remain, bootstrap is INCOMPLETE — continue dispatching. Do NOT report "done" until needs_review count is 0 (or remaining cards are explicitly deferred in open-questions.md with a reason).

   **MUST COMPLETE ALL STAGES.** Do NOT stop after module enrichment. The pipeline has 6 mandatory subagent dispatch stages. Complete ALL before reporting "done":

   ```
   Stage A: module cards      → extractor → coder → reviewer
   Stage B: scenario cards    → extractor → coder → reviewer
   Stage C: decision/proposal/historical cards → analyst → coder (proposals only) → reviewer
   Stage D: architecture cards → analyst (synthesis) → auto: reviewer
   Stage E: reference cards → analyst (synthesis from guide docs) → auto: reviewer
   Stage F: validate + summary
   ```

   **Auto-reviewer dispatch (Stages D & E):**
   After analyst completes enrichment for a stage, **automatically dispatch memory-reviewer** for all cards in that stage. Do NOT wait for manual trigger. Reviewer promotes cards from `needs_review` to `current` (if evidence is sufficient) or adds to `open-questions.md` (if content is incomplete).

   **Per-stage checkpoint:** after each stage, run `ls --status needs_review --json` filtered by entity_type. If count >0 — continue dispatching. Do NOT proceed to next stage until count is 0.

   If you stop after Stage A or B without completing Stage C (analyst for decision/proposal/historical), the bootstrap is INCOMPLETE. Decision cards will have placeholder rationale "Требует ревью — какие альтернативы были рассмотрены?" — this is unacceptable.

   - **module cards** → for EACH module card: dispatch `memory-extractor` with that one card path (reads code_refs, fills Ответственность/Поведение) → then dispatch `memory-coder` with same card (verifies symbols, adds Свидетельства из кода) → then `memory-reviewer` (quality gate, promotes needs_review→current).
   - **decision/proposal/historical cards** → for EACH card: dispatch `memory-analyst` with that one card path (reads source_refs/specs, extracts Rationale/Alternatives/Consequences) → then `memory-coder` (for proposal cards: checks if proposed behavior is partially implemented) → then `memory-reviewer` (quality gate, promotes decision→current, keeps proposal→proposed).
   - **scenario cards** → for EACH scenario card: dispatch `memory-extractor` (reads source_refs, fills Цель/Участники/Поток выполнения/Связанные модули/Связанные тесты) → then `memory-coder` (verifies flow against code, fills Свидетельства из кода/тестов) → then `memory-reviewer`.
   - **architecture cards** → for EACH architecture card: dispatch `memory-analyst` (reads module card + source_refs, synthesizes architecture overview/components/dependencies/data flow) → then `memory-reviewer` (quality gate). **AUTO-DISPATCH**: after analyst completes ALL architecture cards, dispatch reviewer for the entire batch.
   - **reference cards** → for EACH reference card: dispatch `memory-analyst` (reads guide docs + module card, synthesizes reference content: migrated behavior, invariants, error handling, compatibility) → then `memory-reviewer` (quality gate). **AUTO-DISPATCH**: after analyst completes ALL reference cards, dispatch reviewer for the entire batch.

   Subagent dispatch prompt template:
   ```
   You are memory-<role> agent. Your task is to enrich ONE card: <card path>.

   ## Execution mode — CRITICAL
   You are a subagent. Do ALL work yourself — read files, fill content, update via updateCard tool.
   NEVER dispatch subagents, spawn tasks, or delegate to other agents. You are the leaf of the dispatch tree.

   1. Read the card file: <card path>
   2. Read its source_refs/code_refs files (from frontmatter)
   3. Fill in card body sections per your agent instructions
   4. Use updateCard tool to save — NEVER use Write tool
   ```

4. **Validate**: Run `.ai/memory-tool/bin/memory validate` — ensure no errors. Fix if needed.
5. **Summary**: Show card counts by type (created/enriched/still-needs-review) and `git diff .ai/memory/`.

Do NOT ask the user to manually classify specs or fill cards. The subagents do this automatically.

Arguments (optional): $ARGUMENTS — if a specific path or topic is given, focus enrichment on matching cards only.
