# Plan: LLM validation enforcement — evidence-gated code_confirmed

4 tasks, sequential. Task 2 depends on Task 1's validate function. Task 3 depends on Task 1+2. Task 4 docs.

## Task 1: validate evidence section check

**Outcome:** `validate` rejects `code_confirmed`/`test_confirmed` without matching evidence sections.

**Files:** `src/core/validate.ts`, `test/validate.test.ts`

**Steps:**
1. Add function `hasEvidenceSection(body: string, sectionName: string): boolean`:
   - Checks if body contains `## ${sectionName}` heading followed by ≥1 bullet entry (`- `).
   - Pattern: `/^##\s+${sectionName}\s*\n[\s\S]*?(?=\n##\s|$)/im` then check for `- ` in captured section.
2. In validate per-card loop, add checks:
   - If `evidence_level === "code_confirmed"` and NOT `hasEvidenceSection(body, "Code evidence")` → push ERROR: `${card.relativePath}: evidence_level=code_confirmed requires ## Code evidence section with entries`.
   - If `evidence_level === "test_confirmed"` and NOT `hasEvidenceSection(body, "Test evidence")` → push ERROR.
   - Other evidence levels: no section required.
3. These are ERRORS (push to `errors`, not `warnings`).

**Tests-first — `test/validate.test.ts`:**
- "validate errors: code_confirmed without ## Code evidence section" — card with evidence_level=code_confirmed, body without section → `report.ok === false`, errors contain "Code evidence".
- "validate passes: code_confirmed with ## Code evidence section" — same card + body with `## Code evidence\n- Function FilterCardsForCaller at internal/registry/access_filter.go:12` → passes.
- "validate errors: test_confirmed without ## Test evidence section" — similar.
- "validate passes: reviewed_doc without evidence section" — evidence_level=reviewed_doc, no section → passes (no requirement).

**Completion evidence:** `npx vitest run test/validate.test.ts` green, `npx vitest run` all green.

---

## Task 2: updateMemoryCard write-time guard

**Outcome:** `updateMemoryCard` throws if setting `code_confirmed`/`test_confirmed` without evidence section in body.

**Files:** `src/core/updateMemory.ts`, `test/update.test.ts` (new or existing)

**Steps:**
1. In `updateMemoryCard`, before `writeFile`, add check:
   - If `options.fields.evidence_level` is `"code_confirmed"` or `"test_confirmed"`:
     - Determine body to check: `options.body` if provided, else `card.body` (existing).
     - If setting `code_confirmed` → check `hasEvidenceSection(body, "Code evidence")`.
     - If setting `test_confirmed` → check `hasEvidenceSection(body, "Test evidence")`.
     - If missing → throw `Error("Cannot set evidence_level=${level}: body must contain ## ${sectionName} section with entries")`.
2. Extract `hasEvidenceSection` to shared location (either export from validate.ts, or duplicate small helper). Prefer: move to a small `src/core/evidenceSection.ts` shared module.

**Tests-first:**
- "updateCard throws: set code_confirmed without evidence section in body" — call updateMemoryCard with fields.evidence_level=code_confirmed, no body change → throws.
- "updateCard succeeds: set code_confirmed with evidence section in new body" — fields.evidence_level=code_confirmed + body containing `## Code evidence\n- entry` → succeeds.
- "updateCard succeeds: set code_confirmed when existing body already has section" — existing card body has section, only update field → succeeds.
- "updateCard succeeds: set reviewed_doc without section" → no check, succeeds.

**Completion evidence:** `npx vitest run` all green.

---

## Task 3: Agent instructions tightened + project instruction

**Outcome:** Agent prompts require structured evidence sections; AGENTS.md adds advisory pre-task context.

**Files:** `src/scaffold/templates.ts`

**Steps:**
1. **memory-coder** (lines 927-967) — add to "What you do" step 4:
   - `## Code evidence` section MUST use format: `- <description> at <file>:<line>`.
   - Example: `- Caller-based filtering at internal/registry/access_filter.go:12 (FilterCardsForCaller)`.
   - `## Test evidence` section: `- Test <name> at <file>:<line> covers <behavior>`.
   - Add to Rules: "You MUST output ## Code evidence section with specific entries before setting evidence_level=code_confirmed. The CLI will REJECT the update without it."
2. **memory-reviewer** (lines 969-1016) — add to checks:
   - "For each card with evidence_level=code_confirmed: verify ## Code evidence section exists and contains ≥1 entry with file:line reference. If missing → keep needs_review, do NOT promote."
3. **memory-bootstrap skill** (lines 707-800) — update note about evidence format requirement.
4. Add `AGENTS.md` template (scaffolded to project root) with:
   - "Before coding tasks involving product behavior: run /memory-context to load memory."
   - "Before changing product behavior: read relevant memory module cards."
   - Advisory, not enforcement — but gives project-level instruction.

**Tests:** No new tests (instruction text only). Verify scaffolding still works via existing bootstrap/integration tests.

**Completion evidence:** `npx vitest run` all green (existing tests check scaffolding produces valid files).

---

## Task 4: Документация — LIMITATIONS §4.9 + README

**Files:** `docs/LIMITATIONS.md`, `README.md`

**Steps:**
1. §4.9 — move "enforcement, что agent обязан прочитать memory" to partially implemented:
   - Evidence-gated code_confirmed (validate + updateCard guard) — implemented.
   - Pre-task context injection (advisory AGENTS.md) — implemented.
   - Full plugin lifecycle enforcement — still v0.4.
2. §7.1 mitigation — update: evidence section now required by CLI.
3. README — mention evidence format requirement.

**Completion evidence:** diff shows updates, tests green.

---

## Risk / rollback

- **Risk:** existing memory cards with `code_confirmed` but no `## Code evidence` section → validate will now error. Check synapse-mini fixture — may need fixture update.
- **Mitigation:** check fixture cards before merge; if affected, add evidence sections to fixture or change evidence_level to `reviewed_doc`.
- **Rollback:** `git revert` — isolated in validate.ts, updateMemory.ts, templates.ts, docs.