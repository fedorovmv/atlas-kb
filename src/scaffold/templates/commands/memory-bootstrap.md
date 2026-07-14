---
description: One-command LLM-assisted memory bank population — bootstrap + agent enrichment
---

Use the memory-bootstrap skill.

You are the orchestrator. Run the full pipeline yourself, dispatching subagents for each role. This is NOT a question — the user wants the FULL pipeline. Do NOT ask "Would you like me to proceed?" — just do it.

## STEP 1 — Scaffold (run this FIRST)

Run: `.ai/memory-tool/bin/memory bootstrap --root .`

Then run: `.ai/memory-tool/bin/memory ls --needs-enrichment --json`

Save the output. Count how many cards need enrichment.

## STEP 2 — Dispatch enrichment subagents (run this IMMEDIATELY after STEP 1)

If STEP 1 returned ANY cards needing enrichment — you MUST dispatch subagents NOW. Not after asking the user. Not after offering options. NOW.

**Dispatch by card type (one card per subagent dispatch):**

   **CRITICAL — one card per subagent dispatch.** Never bundle multiple cards into a single subagent task. Each subagent gets exactly one card, reads its source_refs, fills content, returns. This keeps context bounded and quality high.

   **Concurrency limit — max 5 parallel subagents.** Dispatch in batches of 5. Wait for each batch to complete before starting next batch. Subagents are lightweight (one card, bounded context), so 5 parallel is safe.

   **MUST COMPLETE ALL STAGES.** Do NOT stop after module enrichment. The pipeline has 6 mandatory subagent dispatch stages. Complete ALL before reporting "done":

   ```
   Stage A: module cards      → extractor → coder → reviewer
   Stage B: scenario cards    → extractor → coder → reviewer
   Stage C: decision/proposal/historical cards → analyst → coder (proposals only) → reviewer
   Stage D: architecture cards → analyst (synthesis) → reviewer
   Stage E: reference cards → analyst (synthesis from guide docs) → reviewer
   Stage F: validate + summary
   ```

   **Per-stage: enrichment → reviewer.** Each stage has TWO subagent roles: first enrich (extractor/analyst fills content), then review (reviewer promotes needs_review→current). Do NOT skip the reviewer step. Cards with `status: needs_review` after enrichment are NOT complete — they need reviewer to promote to `current`.

   - **module cards** → for EACH module card: dispatch `memory-extractor` (reads code_refs, fills Ответственность/Поведение) → then dispatch `memory-coder` (verifies symbols, adds Свидетельства из кода) → then `memory-reviewer` (quality gate, promotes needs_review→current).
   - **decision/proposal/historical cards** → for EACH card: dispatch `memory-analyst` (reads source_refs/specs, extracts Rationale/Alternatives/Consequences) → then `memory-coder` (for proposal cards: checks if proposed behavior is partially implemented) → then `memory-reviewer` (quality gate, promotes decision→current, keeps proposal→proposed).
   - **scenario cards** → for EACH scenario card: dispatch `memory-extractor` (reads source_refs, fills Цель/Участники/Поток выполнения/Связанные модули/Связанные тесты) → then `memory-coder` (verifies flow against code, fills Свидетельства из кода/тестов) → then `memory-reviewer`.
   - **architecture cards** → for EACH architecture card: dispatch `memory-analyst` (reads module card + source_refs, synthesizes architecture overview/components/dependencies/data flow) → then `memory-reviewer` (quality gate).
   - **reference cards** → for EACH reference card: dispatch `memory-analyst` (reads guide docs + module card, synthesizes reference content: migrated behavior, invariants, error handling, compatibility) → then `memory-reviewer` (quality gate).

   Subagent dispatch prompt template (send this text TO the subagent):
   ```
   You are memory-<role> agent. Your task is to enrich ONE card: <card path>.

   Execution mode: You are a leaf subagent. Do ALL work yourself — read files, fill content, update via memory_updateCard tool. Do NOT spawn tasks or delegate.

   1. Read the card file: <card path>
   2. Read its source_refs/code_refs files (from frontmatter)
   3. Fill in card body sections per your agent instructions
   4. Use memory_updateCard tool to save — NEVER use Write tool
   ```

   **You (the orchestrator) MUST dispatch subagents using the Task tool. Do NOT do the enrichment work yourself. Your job is dispatch + reconcile + validate.**

## STEP 3 — Reviewer promotion (MANDATORY — run this IMMEDIATELY after STEP 2)

After all enrichment subagents complete, run:
```bash
.ai/memory-tool/bin/memory ls --status needs_review --json
```

If this returns ANY cards — you MUST dispatch `memory-reviewer` subagent for EACH card. This is NOT optional. This is NOT "next steps". This is STEP 3 — you are here because STEP 2 completed.

**Cards with `status: needs_review` are NOT complete.** They are enriched but NOT promoted. You MUST dispatch reviewer for every needs_review card.

**Do NOT offer options "A/B/C" to the user.** Do NOT say "next steps (optional)". Do NOT say "would you like me to". Just dispatch reviewer subagents.

Dispatch `memory-reviewer` for each needs_review card (one card per dispatch, max 5 parallel). Reviewer will:
- Check required sections are filled
- Promote `needs_review` → `current` (if evidence is sufficient)
- Add incomplete cards to `open-questions.md` (if content is incomplete)
- Set `review_required: false` for promoted cards

## STEP 4 — Validate + summary

Run `.ai/memory-tool/bin/memory validate` — ensure no errors.

Run `.ai/memory-tool/bin/memory ls --needs-enrichment --json` — if returns `[]`, bootstrap is complete. If returns ANY cards — go back to STEP 2.

Show card counts by type (created/enriched/still-needs-review) and `git diff .ai/memory/`.

Do NOT ask the user to manually classify specs or fill cards. The subagents do this automatically.
Do NOT ask "Would you like me to proceed?" — the user invoked /memory-bootstrap, they want the FULL pipeline. Proceed automatically.
Arguments (optional): $ARGUMENTS — if a specific path or topic is given, focus enrichment on matching cards only.
