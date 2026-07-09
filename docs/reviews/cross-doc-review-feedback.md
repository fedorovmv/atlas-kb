# Review Feedback: cross-document comparison

- **Base:** 493826b
- **Head:** working tree (cross-doc comparison)
- **Council:** balanced-code → REVISE
- **Plan:** docs/plans/cross-doc-comparison-plan.md

## Findings ledger

| ID | Source | Severity | Status | Evidence | Decision | Required change | Verification |
|----|--------|----------|--------|----------|----------|-----------------|--------------|
| 1 | ora-3 | HIGH | ACCEPTED | ingestSpec.ts:122 — no change detection before updateMemoryCard. Re-run triggers unnecessary disk writes even when relations identical. Idempotency gap. | Add change detection: only call updateMemoryCard if merged differs from existing. Add idempotency test. | See fix below. | New test: ingestSpec twice → same relation IDs, no duplicates. |
| 2 | ora-3 | MEDIUM | ACCEPTED | specRelations.ts:58 — `isAccepted` regex matches anywhere in body, including quoted text/code blocks. False positive risk. | Limit search to top section (first 500 chars) + Status heading section. | Tighten regex scope. | Tests stay green. |
| 3 | ora-3 | MEDIUM | ACCEPTED | specRelations.ts:14 — `extractSpecTopics` duplicated from specClassification.ts:51-56 without comment. | Add JSDoc explaining duplication rationale. | Document architectural choice. | N/A (comment only). |
| 4 | ora-3 | LOW | DEFERRED | ingestSpec.ts:131 — redundant `resolveMemoryRoot` (already called line 46). Harmless. | Defer — minor cleanup, no correctness impact. | None. | N/A |
| 5 | ora-3 | — | ACCEPTED | No idempotency test for ingestSpec relation updates. | Add test. | See fix below. | New test green. |

## Accepted fixes (one bounded fixer task)

1. **ID #1** — `src/commands/ingestSpec.ts`: add change detection before `updateMemoryCard`. Only write if `merged` differs from existing field values.
2. **ID #2** — `src/core/specRelations.ts:58`: tighten `isAccepted` to search only top 500 chars + Status heading section.
3. **ID #3** — `src/core/specRelations.ts:14`: add JSDoc explaining duplication.
4. **ID #5** — `test/ingest-spec.test.ts`: add idempotency test (ingestSpec twice → same relations, no duplicates).