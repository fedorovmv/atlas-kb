# Phase 3 Code Review Feedback Ledger

## Metadata

- **Requirements**: `docs/specs/GAP_CLOSURE_SPEC.md` §3 Domains G, H
- **Plan**: `docs/plans/phase3-plan.md`
- **Brief**: `docs/plans/phase3-brief.md`
- **Base**: Phase 2 complete (v0.6.0, 385 tests)
- **Head**: working tree (uncommitted Phase 3 implementation)
- **Council preset**: balanced-code
- **Verdict**: APPROVE (3/3 councillors, 6 minor non-blocking findings)
- **Metrics reported**: 456 tests, 9 CLI commands, 7 OpenCode tools, 7 epics, v0.7.0

## Decision Ledger

| ID | Severity | Status | Evidence | Decision | Required change | Verification |
|---|---|---|---|---|---|---|
| 1 | MAJOR (spec deviation) | ACCEPTED (follow-up) | `checkSessions` pushes active-lanes-at-readiness to `warnings` (sessionTracking.ts:93). Spec GAP_CLOSURE_SPEC.md:1111 says "Active lane at readiness → ERROR". | Move active-lanes check from `warnings.push` to `errors.push` in `checkSessions`. | sessionTracking.ts:91-94 | test "active lanes → error" asserts `result.errors` (not warnings) contains the message; `result.valid === false` |
| 2 | MINOR | DEFERRED | `checkSessions` does not validate `continuations[].reason` against `ContinuationReasonSchema` enum. Runtime relies on Zod parse at load time only. | Add note in plan for Phase 4 hardening. | — | — |
| 3 | MINOR | DEFERRED | `allowedTypes` in `WorkflowPolicySchema.modes.direct` is declared but `routeWorkflow` never enforces it (only checks `refactor && behaviorChange`). | Add note in plan for Phase 4: enforce allowedTypes gate. | — | — |
| 4 | MINOR | DEFERRED | `behaviorChange=false` short-circuit only applies to `refactor`; docs/test/chore types with `behaviorChange=true` are not rejected from DIRECT. Spec is ambiguous; defer until spec clarified. | — | — | — |
| 5 | MAJOR (test integrity) | ACCEPTED (follow-up) | `sessionTracking.test.ts:42,60` use `expect(true).toBe(true)` vacuous assertions after `sessionOpen`/`sessionClose`. `workflow.test.ts:22-25` first test uses `toBeGreaterThanOrEqual(0)` on empty diff and does not actually exercise `analyzeChangeSurface` happy path. | Replace vacuous assertions with real `loadSessions` + field assertions for open/close; strengthen workflow "1 file" test to assert `components.length === 1` and `changedFiles.length === 1` via a real git repo. | sessionTracking.test.ts, workflow.test.ts | tests pass with meaningful assertions |
| 6 | MINOR | DEFERRED | `sessionOpen` casts `options.phase as any` (sessionTracking.ts:42) bypassing `SessionPhaseSchema` enum. | Add runtime `SessionPhaseSchema.parse(options.phase)` before assignment; drop `as any`. Optional follow-up; load-time Zod parse catches persisted bad data, but caller-side validation is cleaner. | — | — |

## Preserved Disagreement

None. All 3 councillors agreed on APPROVE with non-blocking findings.

## Follow-up patch scope (this ledger drives)

- Findings 1 and 5 are ACCEPTED for immediate follow-up patch.
- Findings 2, 3, 4, 6 are DEFERRED to Phase 4 (non-blocking, do not affect v0.7.0 correctness).
- Patch must not regress the 456 passing tests.

## Next Gate

No re-run required — APPROVE verdict is final. Follow-up patch is a bounded correction; verify with build + full test suite.