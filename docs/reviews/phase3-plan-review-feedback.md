# Phase 3 Plan Review Feedback Ledger

## Metadata

- **Requirements**: `docs/specs/GAP_CLOSURE_SPEC.md` §3 Domains G, H
- **Plan**: `docs/plans/phase3-plan.md`
- **Brief**: `docs/plans/phase3-brief.md`
- **Base**: Phase 2 complete (v0.6.0, 385 tests)
- **Council preset**: balanced-plan
- **Verdict**: REVISE (unanimous 3/3)

## Decision Ledger

| ID | Source | Severity | Status | Evidence | Decision | Required change | Verification |
|---|---|---|---|---|---|---|---|
| 1 | C1,C2,C3 | CRITICAL | ACCEPTED | saveSessions writes temp then final directly, never renames. Violates atomic write constraint. Existing pattern: updateMemory.ts:76-85 uses rename. | Apply Patch 1: replace `writeFile(sessionPath, ...)` with `rename(temp, sessionPath)` | Plan lines 137-139 edited | build + test pass |
| 2 | C1,C2,C3 | CRITICAL | ACCEPTED | `git diff --name-only HEAD` with no `--cached` produces empty diff if changes committed. Acceptance criteria "1 file bugfix → DIRECT" untestable. | Apply Patch 2: default `baseRef` to `HEAD~1`, update CLI default | Plan line 1068 + CLI option edited | route test with 1 file → DIRECT |
| 3 | C1,C2 | MAJOR | ACCEPTED | switchProfile reads YAML as `any`, modifies, dumps without Zod validation. Invalid state propagates silently. | Apply Patch 3: `ModelRoutingSchema.parse()` before and after change, atomic write with rename | Plan lines 407-411 edited | modelRouting test validates corrupted YAML rejected |
| 4 | C1,C3 | MAJOR | ACCEPTED | `npx --no` not standard across npm versions. Detection fails silently. | Apply Patch 5: try `openspec --version` first, then `npx @fission-ai/openspec --version` | Plan lines 811-817 edited | openspec test: both paths covered |
| 5 | C1,C2 | MINOR | ACCEPTED | G3 modifies overview.ts after G2. Must merge, not overwrite. | Apply Patch 6: add prerequisite note to Task 8 | Plan Task 8 step 1 edited | overview test has both session + route sections |
| 6 | C1,C2,C3 | — | REJECTED | resolveRoot signature mismatch claim. All 3 councillors verified: TypeScript structural typing allows passing wider object. Existing code uses this pattern. | No change needed | — | — |
| 7 | C1,C2 | MAJOR | ACCEPTED | routeWorkflow checks FULL first, spec says "Priority chain: DIRECT → PLAN → FULL". Non-heuristic risks in full.triggerRisks but not direct.forbiddenRisks would route to FULL when DIRECT is eligible. | Apply Patch 4: reorder to DIRECT→PLAN→FULL check order | Plan lines 1161-1247 replaced | workflow test: 1 file + trigger-only risk → still DIRECT (not FULL) |
| 8 | C2 | MINOR | DEFERRED | Risk detection crude (file.includes). Acceptable for MVP. | Add TODO comment for Phase 4. Applied as note in plan. | Plan edited with TODO comment | — |
| 9 | C1 | MINOR | DEFERRED | H1 hooks `npx repo-memory` fails if offline or unpublished. | Add local install detection (`./node_modules/.bin/repo-memory` first). Applied to all 4 hook templates. | Plan hook templates edited | — |
| 10 | C1 | MINOR | DEFERRED | Template changes don't propagate to existing projects. | Document in CHANGELOG: re-run `init --force`. Applied to Task 6 completion evidence. | Plan edited | — |

## Preserved Disagreement

**Finding 7**: C3 dissents — argues "DIRECT → PLAN → FULL" describes preference not execution order, and heuristic-detectable risks overlap between direct.forbiddenRisks and full.triggerRisks. C1 and C2 disagree citing spec compliance. **Resolution**: Applied Patch 4 per majority — spec compliance is non-negotiable, behavioral difference exists for non-heuristic risks.

## Patch Summary

- **Critical (blocking)**: Patches 1-2 applied to plan
- **Major**: Patches 3-5 applied to plan
- **Minor (implementation-time)**: Patches 6-9 applied to plan as notes/comments

All patches modify the plan document only. No code changes yet — implementation starts after Council re-approval.

## Next Gate

RERUN_COUNCIL — re-run balanced-plan with patched plan.