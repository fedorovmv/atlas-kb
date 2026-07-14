# Implementation Plan: Fix /memory-bootstrap convergence

**Branch:** v/kb-openspec
**Base commit:** 15479b4 (2026-07-14)
**Approved by:** council cou-1 (Option D sequenced B→C→A + non-destructive reconcile + agent fixes), revised per oracle ora-2 plan review (REVISE → patched), audited per design-unknowns (CONDITIONAL → patched)
**Status:** audited — ready for implementation after P0-1/P0-3/P1-3 decisions applied

## Decisions (design-unknowns interactive)
- **P0-1 (A):** `commands/memory-bootstrap.md` → чистый stub делегирования; весь control flow в `skills/memory-bootstrap.md`. Восстанавливает изначальную задумку 5eca8bf (command = точка входа, skill = источник правды). Убирает дублирование, ставшее причиной расхождения.
- **P0-3 (B):** Условный coder для proposals — только если у карты есть `code_refs`. Без code_refs → analyst → reviewer. С code_refs → analyst → coder → reviewer (partial-implementation-detection). `heuristic_match` card-level исключается из gate только для proposals БЕЗ code_refs.
- **P1-3 (измерено в a2a-mono):** 15 needs_review карт: 4 strong-evidence (STEP 3 не запускался), 7 architecture+reviewed_doc (terminal), 3 architecture+inferred (не terminal), 1 module+inferred (не terminal), 0 heuristic_match. Phase 1 расширяется на architecture+reviewed_doc. Phase 2 добавляет "STEP 3 обязателен". Phase 5 heuristic_match exclusion остаётся для будущих proposals.

## Problem
`/memory-bootstrap` doesn't converge. After 17 fix commits today, loop stalls: 127 cards, 89 current, 15 needs_review, 18 proposed, needs-enrichment 67→41 stuck, 118 validation errors.

## Root causes (verified by oracle ora-1, confirmed by council cou-1, plan re-verified by oracle ora-2)
1. Multi-factor `--needs-enrichment` gate (ls.ts:31-37) with structurally-unsatisfiable conditions
2. Unbounded LOOP without progress detection (memory-bootstrap.md:9,44-51)
3. reconcile --fix embeds oscillation (reconcileFix.ts:148-154, added commit 15479b4)
4. reconcile --fix re-injects terminal proposals (reconcileFix.ts:96-101)
5. Agent instruction gap: memory-analyst.md doesn't say "must infer for proposals"
6. ~~(council blind spot #1 — REFUTED by ora-2)~~ Two conflicting bootstrap docs — **FALSE**: `commands/memory-bootstrap.md` is a 5-line delegation stub (`"Use the memory-bootstrap skill."`), no conflict exists
7. heuristic_match has no exit path for decision/historical cards — no coder in pipeline, reviewer forbids promoting
8. Validator/gate desync: validate.ts:236 skips section-check for spec_only (CONFIRMED by ora-2), ls.ts:35 flags missing sections for all
9. Asymmetric gate: areCrossLinksEmpty (ls.ts:68-79) entity-specific but gate applies all 5 conditions to all types
10. Strict Russian-heading match in cardSections.ts causes silent loop resets (CONFIRMED by ora-2: ls.ts:18-24 trimStart + exact `.has(req)`)

## Phases (sequenced B→C→A→reconcile→agents→validator — Phase 0 deleted per ora-2)

### PHASE 1 — Option B: Accept terminal statuses (gate change)
**Why:** Largest stuck cohort. Measurement in a2a-mono (P1-3): 7 architecture+reviewed_doc + 18 proposal spec_only + 4 decision reviewed_doc are terminal — should be DONE, not gated.
**File:** `src/commands/ls.ts:31-37`
**Change:**
```typescript
if (options.needsEnrichment) {
  // NEW: terminal cards with weak-but-acceptable evidence, no placeholder, sections complete
  // Covers: proposal/historical spec_only, decision reviewed_doc, architecture reviewed_doc
  const isTerminalEntity = 
    (card.meta.entity_type === "proposal" || card.meta.entity_type === "historical") && card.meta.evidence_level === "spec_only" ||
    (card.meta.entity_type === "decision") && card.meta.evidence_level === "reviewed_doc" ||
    (card.meta.entity_type === "architecture") && card.meta.evidence_level === "reviewed_doc";
  if (isTerminalEntity &&
      !hasPlaceholderContent(card.body) &&
      !hasMissingRequiredSections(card.meta.entity_type, card.body)) {
    return false;  // terminal, done — not needs-enrichment
  }
  // ... existing conditions
}
```
**Done when:** `memory ls --needs-enrichment --json` excludes proposal/historical+spec_only, decision+reviewed_doc, architecture+reviewed_doc — all with complete sections.
**Test:** Create `test/ls.test.ts` from scratch (no existing test for listMemory/needsEnrichment — confirmed by grep). Use structure from `test/reconcileFix.test.ts` (mkdtemp + bootstrapMemory + write card + assert). Cases: proposal spec_only+sections → excluded; spec_only+missing section → included; decision reviewed_doc+sections → excluded; architecture reviewed_doc+sections → excluded; architecture inferred+sections → INCLUDED (not terminal); module code_confirmed+placeholder → included (placeholder check).
**Verification:** `npm test -- ls.test.ts`. Manual: re-run bootstrap, check stuck cohort drops by 7 architecture+reviewed_doc.
**⚠️ CRITICAL (ora-2):** Phase 1 and Phase 6 MUST ship in the same commit — otherwise window where incomplete spec_only proposals escape both gate and validator.

### PHASE 2 — Option C: Progress-based stop condition + mandatory STEP 3 (loop template)
**Why:** LOOP (39a4000) has no stuck detection → infinite loop on stuck cards. Measurement (P1-3) found 4 strong-evidence cards stuck in needs_review — STEP 3 (reviewer) was not dispatched by orchestrator. LOOP needs explicit "STEP 3 обязателен" instruction.
**Files:**
- `src/scaffold/templates/skills/memory-bootstrap.md` (the real implementation, 272 lines)
- `src/scaffold/templates/commands/memory-bootstrap.md` (per P0-1 decision: becomes 5-line stub delegating to skill)
**Change:**
- Track content hash per card: `hash(body + evidence_level + status + claims[].text)` — EXCLUDE `last_reviewed`, `review_required`, AND `cross_link_attempts` (ora-2: also churns without content progress). Check existing `test/subjectHash.test.ts` and `src/core/subjectHash.ts` for reusable hash utility before inventing new.
- Sort `claims` by `id` before hashing (deterministic)
- After each STEP 2→3→4 iteration: compare hash set against previous iteration
- If 2 iterations with no hash change → STOP, write stuck cards to `reconciliation/open-questions.md`, report "bootstrap incomplete — N cards stuck, see open-questions.md"
- Hard cap: max 5 iterations
- **NEW (P1-3):** Explicit "STEP 3 ОБЯЗАТЕЛЕН после STEP 2. If `ls --needs-enrichment` returns [] but `ls --status needs_review` returns cards — dispatch reviewer. Strong-evidence cards (code_confirmed/test_confirmed/contract_confirmed) with complete sections MUST be promoted by reviewer."
- **NEW (P0-1):** `commands/memory-bootstrap.md` reduced to 5-line stub: `---\ndescription: One-command LLM-assisted memory bank population — bootstrap + agent enrichment\n---\nUse the memory-bootstrap skill.\n` (restore original 5eca8bf design)
- **NEW (P1-5):** Completion gate explicitly stated: "done = `ls --needs-enrichment-content` = [] AND `ls --needs-enrichment-review` = [] (after Phase 3 split). `--needs-enrichment-links` = [] OR accept-empty fallback."
**Done when:** skill explicitly says "if hash unchanged 2 iterations → stop + report; never exceed 5 iterations; STEP 3 обязателен; completion gate = content+review empty, links=empty or accept-empty".
**Verification:** Manual doc review. No build.

### PHASE 3 — Option A: Split gate + accept-empty cross-links
**Why:** `emptyCrossLinks` is structurally unsatisfiable when target card doesn't exist; oscillation with reconcile --fix.
**Files:**
- `src/commands/ls.ts` — split `--needs-enrichment` into 3 flags:
  - `--needs-enrichment-content` (placeholders + weak evidence + missing sections)
  - `--needs-enrichment-links` (empty cross-links)
  - `--needs-enrichment-review` (status=needs_review)
  - Keep `--needs-enrichment` as union of all 3 for backward compat (but exclude Phase 1 terminal)
- `src/scaffold/templates/skills/memory-bootstrap.md` — STEP 2/3/4 use split flags (commands/ stub delegates to skill)
- `src/scaffold/templates/tools/memory.ts` — updateCard with cross-link fields increments `cross_link_attempts` in frontmatter
- `src/schemas/frontmatter.ts` — add `cross_link_attempts` to known keys (also validate.ts:21-32 KNOWN_FRONTMATTER_KEYS — CONFIRMED by ora-2)
- `src/core/validate.ts:21-32` — add `cross_link_attempts` to KNOWN_FRONTMATTER_KEYS (ora-2 verified: does NOT currently include it)
- **(ora-2)** NEW frontmatter field `has_broken_relations: boolean` — set by Phase 4 reconcile when broken relation detected; `--needs-enrichment-links` gate INCLUDES cards with this flag (don't accept-empty until human fixes)
- **(design-unknowns P0-2)** Add `cross_link_attempts: z.number().int().min(0).optional().default(0)` and `has_broken_relations: z.boolean().optional().default(false)` to `MemoryFrontmatterSchema` in `src/schemas/frontmatter.ts` BEFORE `.passthrough()` (line 157). `.passthrough()` lets any field through without validation — typos become warnings (not errors) via KNOWN_FRONTMATTER_KEYS. Adding to schema makes typos **zod errors** (rejected at parse), preventing silent oscillation from `cross_link_atempts` typo → gate sees undefined → exclude from accept-empty → oscillation.
**Accept-empty logic:** In `--needs-enrichment-links` gate: if `cross_link_attempts >= 2` AND `has_broken_relations !== true` → exclude from gate (accept empty), log to open-questions.md.
**Asymmetry fix (council finding #9, ora-2 AGREE):** Gate conditions should be entity-specific (module only checks related_scenarios; decision/proposal check related_modules+affects_modules) — align with areCrossLinksEmpty rules.
**Feature-flag (ora-2 rollback mitigation):** env var `ENABLE_CROSS_LINK_TRACKING` — if unset, gate behaves as before (no cross_link_attempts/has_broken_relations logic). Allows safe rollback without leaving orphan frontmatter fields triggering typo warnings.
**Done when:** `ls --needs-enrichment-links --json` excludes cards with cross_link_attempts>=2 (and no broken relations); `ls --needs-enrichment-content` and `--review` work independently.
**Test:** Unit tests for each split flag. Integration test: card with cross_link_attempts=2+no broken → excluded from --links but still checked by --content/--review; card with cross_link_attempts=2+has_broken_relations=true → INCLUDED.
**Verification:** `npm test`. Manual: re-run bootstrap, check cross-link oscillation stops.

### PHASE 4 — Non-destructive reconcile --fix
**Why:** reconcile --fix currently deletes agent-set cross-links (oscillation) and downgrades terminal proposals (churn).
**File:** `src/core/reconcileFix.ts`
**Changes:**
- `reconcileFix.ts:148-154` (broken relation removal): instead of filtering IDs from frontmatter, append to `reconciliation/open-questions.md` with `{cardId, field, targetId, reason}`. Do NOT delete IDs from frontmatter. **(ora-2)** SET frontmatter flag `has_broken_relations: true` on the card — this keeps it in `--needs-enrichment-links` gate until human reviews (prevents oscillation AND prevents silent acceptance of broken links).
- `reconcileFix.ts:96-101` (stale proposal downgrade): DELETE this block entirely. Status changes are agent-driven, not CLI-driven.
- Keep diagnostic logging (stale refs, orphans, weak claims → open-questions.md / conflicts.md) — net-positive.
- `src/commands/reconcile.ts` — if `--fix` flag: report would-fix vs applied (since applied is now append-only to open-questions + flag set).
**Done when:** `reconcile --fix` no longer deletes IDs from card frontmatter (only sets `has_broken_relations: true` + writes to reconciliation/*.md); no proposal downgrade loop.
**Test:** Unit test: broken relation → open-questions entry + has_broken_relations=true set, ID stays in frontmatter; Stale proposal → no status change. Integration test: run reconcile --fix twice on same state — second run is no-op (idempotent). Check existing `test/reconcileFix.test.ts` first.
**Verification:** `npm test`. Manual: run reconcile --fix twice on same state — second run is no-op.

### PHASE 5 — Agent instruction fixes
**Why:** Agent doesn't know it must infer for proposals; proposals with code_refs need coder for partial-implementation-detection (per P0-3 decision B).
**Files:**
- `src/scaffold/templates/agents/memory-analyst.md:183-193` — add explicit: "For proposal cards: if spec lacks rationale/alternatives, YOU MUST INFER from requirements+solution+trade-offs. Mark `evidence_level: inferred`. Never leave `## Обоснование из спецификации` empty or as placeholder."
- `src/scaffold/templates/skills/memory-bootstrap.md` — **(P0-3 decision B: conditional coder for proposals)** routing:
  - proposals WITH `code_refs` → `analyst → coder → reviewer` (coder checks partial implementation, upgrades claim evidence)
  - proposals WITHOUT `code_refs` → `analyst → reviewer` (no code to verify)
  - decision/historical cards with `evidence_level=heuristic_match` → EXCLUDE from `--needs-enrichment-content` gate (spec-based cards don't have code_refs; heuristic_match is CLI keyword-match artifact)
- `src/scaffold/templates/skills/memory-bootstrap.md:43-46` — **(P2-2)** update anti-rationalization block: "spec_only is expected for proposals — FALSE" should align with Phase 1 terminal exclusion (spec_only+sections complete = terminal, not "must be enriched")
**Done when:** memory-analyst.md explicitly says infer-for-proposals; skill routing has conditional coder for proposals; heuristic_match excluded from gate for decision/historical; anti-rationalization block aligns with Phase 1.
**Verification:** Manual doc review. Unit test: decision card with heuristic_match → excluded from `--needs-enrichment-content`; proposal with code_refs → coder in pipeline; proposal without code_refs → no coder.

### PHASE 6 — Validator/gate desync + heading normalization
**Why:** validate.ts:236 skips spec_only section-check but ls.ts:35 flags them → Option B exclusions leave nothing enforcing section completeness (ora-2 CONFIRMED: line 236 `if (... || evidence_level === "spec_only") continue`). Strict Russian heading match causes silent loop resets.
**⚠️ MUST ship in same commit as Phase 1 (ora-2):** without this, incomplete spec_only proposals escape both gate (Phase 1 excludes them) and validator (line 236 skips them) → silent acceptance of incomplete cards.
**Files:**
- `src/core/validate.ts:236` — **(ora-2 decision: REMOVE spec_only skip entirely)** change:
  ```typescript
  // OLD:
  if (card.meta.review_required || card.meta.evidence_level === "spec_only") continue;
  // NEW:
  if (card.meta.review_required) continue;
  ```
  Enforce section-check for all cards except `review_required=true`. Incomplete spec_only proposals → validation errors (forcing human/agent fix). This is correct: proposals must be complete before terminal.
- `src/commands/ls.ts:18-24` `hasMissingRequiredSections` — **(ora-2)** normalize heading match: `toLowerCase` both contract heading and card heading before `.has(req)` comparison. Validator (validate.ts) stays strict (encourages consistency), ls.ts (gate) is lenient (prevents silent loop resets on LLM phrasing variance).
- `src/schemas/cardSections.ts` — document exact strings agents must use (sync with memory-analyst.md heading table)
**Done when:** spec_only proposals excluded from --needs-enrichment (Phase 1) still get section-checked by validate; heading variants pass ls.ts gate (lowercase), validator stays strict.
**Test:** Unit test: spec_only proposal with missing section → validation error; heading `## обоснование из спецификации` (lowercase) passes ls.ts gate, fails validator (or passes if exact match in cardSections). Check existing `test/validate.test.ts` first.
**Verification:** `npm test -- validate`.

## Build / lint / test commands
- Build: `npm run build` (TypeScript compile)
- Test: `npm test` (vitest)
- **(P1-1)** No `lint` script in package.json — omit lint from verification
- Manual smoke: `.ai/memory-tool/bin/memory bootstrap --root .` on a2a-mono

## Rollout / rollback
- Phase 1+6 ship together as ONE commit (ora-2 constraint)
- Phase 2 (template only, command → stub) — low risk, independent. P0-1: command stub restore.
- Phase 3 (split gate) — medium risk, schema change (cross_link_attempts, has_broken_relations added to zod schema per P0-2) — feature-flagged via `ENABLE_CROSS_LINK_TRACKING` for safe rollback
- Phase 4 (reconcile) — medium risk, behavior change. **(P1-4)** Must update `test/reconcileFix.test.ts` — remove tests for deleted proposal-downgrade block (reconcileFix.ts:96-101), add idempotency tests.
- Phase 5 (agent docs) — low risk, independent
- Rollback: revert the phase commit. Phase 3 revert leaves orphan frontmatter fields (`cross_link_attempts`, `has_broken_relations`) → since they're in zod schema (P0-2), no warning. Feature-flag avoids in practice.

## Integration / whole-branch verification
After all phases:
1. `npm run build` — compiles
2. `npm test` — all tests pass
3. Manual: `.ai/memory-tool/bin/memory bootstrap --root <test-repo>` on a2a-mono-v3 → converges OR stops with stuck report in open-questions.md (not infinite loop)
4. Manual: check open-questions.md contains stuck cards with reason — convergence theater check (council risk)
5. Manual: re-run bootstrap → idempotent (no re-work needed on already-complete cards)
6. Manual: final report MUST include open-questions.md count + require human ack (council risk #1 mitigation)

## Risks (from council cou-1 + ora-2 additions)
1. **Convergence theater** — "done" by exclusion to open-questions.md. Mitigation: final report includes open-questions.md count, requires human ack.
2. ~~**B hides real gaps** — partially-implemented proposals skip coder verification.~~ (ora-2: removing `claims?.length` check, section completeness is the gate. Mitigation: Phase 6 enforces section check via validator.)
3. **C premature stop** — hash must exclude `last_reviewed`, `review_required`, `cross_link_attempts` (ora-2 added). Mitigation: documented hash fields + sort claims by id.
4. **A frontmatter schema bloat** — cross_link_attempts + has_broken_relations typo warnings. Mitigation: add to KNOWN_FRONTMATTER_KEYS (Phase 3) + feature-flag for rollback.
5. **Validator/gate disagreement persists** — Phase 6 resolves (same commit as Phase 1).
6. **Enrichment latency** — bounded loop (3 iter / 2 stable) mitigates.
7. **(ora-2 NEW)** Cross-link oscillation may persist (Phase 3+4 interaction) — has_broken_relations flag ensures card stays in gate until human fixes. Mitigation: flag-based, not deletion-based.
8. **(ora-2 NEW)** Heading normalization scope — ls.ts lenient (lowercase), validate.ts strict. Mismatch acceptable: gate prevents loop, validator enforces quality.

## Resolved open questions (from ora-2 + design-unknowns)
- ~~Phase 1: should terminal exclusion also cover `decision` cards with `evidence_level=reviewed_doc` + complete sections?~~ **YES (ora-2)** — added to Phase 1. **(design-unknowns P1-3):** extended to `architecture`+reviewed_doc (measured in a2a-mono: 7 terminal architecture cards).
- ~~Phase 5: add memory-coder to decision/historical pipeline, OR exclude heuristic_match?~~ **(P0-3 decision B):** conditional coder for proposals only (if code_refs). Exclude heuristic_match for decision/historical.
- ~~Phase 6: remove spec_only skip, OR add separate check?~~ **REMOVE skip (ora-2)** — cleaner, enforce sections for all except review_required.
- ~~Are there existing tests?~~ **YES (ora-2)** — test/ has 50 files. **(design-unknowns P1-2):** NO test/ls.test.ts — create from scratch. reconcileFix.test.ts exists — update for Phase 4.
- **(design-unknowns P0-1):** `commands/memory-bootstrap.md` → stub (restore 5eca8bf). Entire control flow in skill.
- **(design-unknowns P0-2):** Add `cross_link_attempts`/`has_broken_relations` to `MemoryFrontmatterSchema` zod (before `.passthrough()`) — make typos errors, not warnings.
- **(design-unknowns P1-1):** No `lint` script — omit from verification.
- **(design-unknowns P1-5):** Completion gate = content+review empty, links=empty or accept-empty — stated explicitly in Phase 2.

## Measurement evidence (a2a-mono, 2026-07-14)
15 needs_review cards:
- 4 strong-evidence (code_confirmed/contract_confirmed/test_confirmed) + needs_review — **STEP 3 not dispatched** → Phase 2: "STEP 3 обязателен"
- 7 architecture + reviewed_doc + needs_review — **terminal** → Phase 1: architecture+reviewed_doc exclusion
- 3 architecture + inferred + needs_review — **not terminal** → requires analyst re-synthesis (stays in gate)
- 1 module + inferred + needs_review — **not terminal** → requires extractor (stays in gate)
- 0 heuristic_match — Phase 5 heuristic_match exclusion stays for future proposals, not current stuck