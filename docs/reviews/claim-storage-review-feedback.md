# Review Feedback: claim storage feature

- **Base:** 407251a
- **Head:** working tree (claim storage)
- **Council:** balanced-code → REVISE
- **Plan:** docs/plans/claim-storage-plan.md

## Findings ledger

| ID | Source | Severity | Status | Evidence | Decision | Required change | Verification |
|----|--------|----------|--------|----------|----------|-----------------|--------------|
| 1 | ora-2 | critical | ACCEPTED | `claim.ts:47` default `claim_id: ""` violates `EvidenceSchema` `z.string().min(1)`. Parse fails (reproduced via tsx: `success: false, errors: too_small claim_id`). | Fix default: remove `.default(...)`, use `.optional()` only. ingestSpec always provides evidence explicitly. | `evidence: EvidenceSchema.optional()` (no default) in StoredClaimSchema. | `npx tsx` parse test: StoredClaimSchema.safeParse без evidence → success true. |
| 3 | ora-2 | minor | DEFERRED | `as Claim[]` cast redundant (StoredClaim extends Claim structurally). Stylistic only. | Defer — no correctness impact. | None. | N/A |
| 5 | ora-2 | critical | ACCEPTED | `LIMITATIONS.md` §4.2 lines 96,97,99 and §6 lines 282-283 NOT updated — Task 4 fixer returned truncated result, edits not applied. | Apply Task 4 docs update as originally planned. | Move 3 items to "Реализовано" in §4.2; mark ✅ in §6 v0.2 for claim storage + re-check. | `git diff docs/LIMITATIONS.md` shows changes. |
| 2 | ora-2 | critical | REJECTED | Council claimed idempotency bug, but actual issue is #1 (default evidence). After #1 fix, `sc.evidence` may be undefined → condition `sc.evidence &&` correctly guards. No separate fix needed. | Reject — subsumed by #1. | None (fixed by #1). | N/A |
| 4 | ora-2 | minor | DEFERRED | Dead code fallback in ingestSpec.ts:50 (`ev ?? {...}`). Defensive, no harm. | Defer. | None. | N/A |
| 6 | ora-2 | nit | DEFERRED | Test mkdir/rm cleanup pattern. Pre-existing, not introduced by this feature. | Defer. | None. | N/A |

## Accepted fixes

1. **ID #1** — `src/schemas/claim.ts`: change `evidence: EvidenceSchema.optional().default({...})` → `evidence: EvidenceSchema.optional()`. Re-run tests.
2. **ID #5** — `docs/LIMITATIONS.md` §4.2 + §6: move 3 items to Реализовано, mark ✅.

Both in one bounded fixer task (same-feature correction, fresh session per isolation policy).