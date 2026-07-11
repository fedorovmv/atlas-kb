# Plan: content quality enforcement

3 tasks, sequential.

## Task 1: validate evidence format check

**Files:** `src/core/evidenceSection.ts`, `src/core/validate.ts`, `test/validate.test.ts`

**Steps:**
1. `evidenceSection.ts` — add `hasQualityEvidenceSection(body, sectionName): boolean`:
   - Find `## ${sectionName}` section (same as hasEvidenceSection).
   - Extract bullet lines.
   - Each bullet MUST match `/at\s+\S+\.\w+:\d+/` (contains `at <path>:<line>`).
   - If any bullet doesn't match → return false.
   - If no bullets → return false.
   - Keep existing `hasEvidenceSection` for backward compat (used by updateMemoryCard guard).
2. `validate.ts` — use `hasQualityEvidenceSection` for code_confirmed/test_confirmed checks. Change error message: "requires ## Code evidence section with entries in format 'at <path>:<line>'".
3. `updateMemory.ts` guard — keep using `hasEvidenceSection` (write-time check is structure-level; validate is quality-level).

**Tests:**
- "validate errors: evidence bullet without file:line pattern" — `## Code evidence\n- TODO` → ERROR.
- "validate errors: evidence bullet with generic content" — `## Code evidence\n- something at file.ts:1 (index)` → passes (has file:line). But `## Code evidence\n- checked` → ERROR (no `at path:line`).
- "validate passes: proper evidence entry" — `## Code evidence\n- Filter at internal/registry/access_filter.go:12 (FilterCardsForCaller)` → passes.
- "validate errors: test evidence without file:line" — `## Test evidence\n- checked` → ERROR.
- "validate passes: proper test evidence" — proper format → passes.

**Completion:** `npx vitest run` all green. Check fixture cards still pass (they should have proper format from B-LLM fixup).

---

## Task 2: agent instructions quality rubric + anti-patterns

**Files:** `src/scaffold/templates.ts`

**Steps:**
1. **memory-extractor** — add after "What you do" section:
   ```
   ## Quality checklist (before calling updateCard)
   - [ ] ## Responsibility: 2-4 sentences, cites ≥1 function/type name from code_refs
   - [ ] ## Non-responsibilities: ≥1 specific item (not "None identified")
   - [ ] ## Current behavior: references ≥1 specific function/type/method from code
   - [ ] ## Known risks: only if TODO/FIXME/deprecated found; otherwise omit section
   
   ## Anti-patterns — DON'T write:
   - "This module handles functionality" — too vague
   - "Provides robust solutions for..." — marketing language
   - "Leverages industry best practices" — meaningless
   - "Implements core logic" — doesn't say WHAT
   - "Handles data processing" — generic
   Instead write: "Filters agent cards by caller service identity at internal/registry/access_filter.go (FilterCardsForCaller)"
   
   ## Good examples:
   - Responsibility: "Registry stores agent/tool metadata and filters cards by caller service identity. Exposes query API, not runtime orchestration."
   - Non-responsibilities: "Does NOT choose target agents. Does NOT transform request payloads. Does NOT cache results."
   - Current behavior: "FilterCardsForCaller(caller string) returns []string of visible card IDs. AccessFilter struct holds policy map."
   ```

2. **memory-coder** — add:
   ```
   ## Quality checklist (before setting evidence_level)
   - [ ] ≥1 evidence entry per code_refs file (not just 1 total)
   - [ ] Each entry has: description + file path + line number + symbol name
   - [ ] Symbol name is a real function/type/method, not "index", "main", "unknown"
   - [ ] You actually opened and read the file — symbol exists at that line
   
   ## Anti-patterns:
   - "Module exists at file:1 (index)" — line 1 + "index" = didn't read the file
   - "Code is present at src/module.ts:1" — no symbol name
   - "Implements functionality at file:10" — generic description
   ```

3. **memory-reviewer** — add:
   ```
   ## Quality rubric (per card, before promoting to current)
   - Responsibility: ≥1 function/type name cited? Score 0-2
   - Current behavior: ≥1 specific behavior from code? Score 0-2
   - Code evidence: each entry has file:line + real symbol? Score 0-2
   - Total ≥4/6 required to promote to current. If <4 → keep needs_review.
   
   ## RE-READ verification step:
   For at least ONE code_refs file in each card: open it and verify the cited symbol exists at the cited line. If symbol not found or line doesn't match → keep needs_review, add to open-questions.md.
   ```

**Completion:** `npx vitest run` all green (template strings, no test changes).

---

## Task 3: bootstrap placeholder quality hints + docs

**Files:** `src/core/bootstrapMemory.ts`, `docs/LIMITATIONS.md`

**Steps:**
1. `bootstrapMemory.ts` renderModuleCard — replace placeholder text:
   - OLD: "Needs review — read code_refs to fill this section."
   - NEW: "Needs review — EXAMPLE: 'Filters agent cards by caller service identity at internal/registry/access_filter.go (FilterCardsForCaller)'"
   - Add example for each section (Responsibility, Non-responsibilities, Current behavior, Known risks).
2. Same for renderScenarioCard, renderDecisionCard — add examples to placeholders.
3. `docs/LIMITATIONS.md` — update §4.9: "content quality enforcement: validate checks evidence bullet format (file:line + symbol); agent instructions include quality rubric + anti-patterns; reviewer re-reads code".

**Completion:** `npx vitest run` all green.