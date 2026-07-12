# Phase 2 Review Feedback Ledger

- **Spec**: `docs/specs/GAP_CLOSURE_SPEC.md` §3 Domains D, E, F
- **Plan**: `docs/plans/phase2-plan.md`
- **Base**: Phase 2 commit (v0.6.0, 375 tests)
- **Council preset**: balanced-code
- **Verdict**: REVISE

## Findings

| ID | Status | Evidence | Decision | Required change | Verification |
|---|---|---|---|---|---|
| B1 | ACCEPTED | `src/core/validate.ts:368-370` — F5 treeHash verification emits WARNING instead of ERROR. F1 hashing.ts IS available. Stale comment "pending". | Replace warning with actual `treeHash` call from F1. ERROR on mismatch. Add test. | `npm test` passes + new test for tree hash mismatch → error |
| B2 | ACCEPTED | `src/core/semanticRepair.ts:552-627` + `src/commands/semanticRepair.ts:26-35` — D3 post-repair functions compute results but never write to disk. CLI reports success but files unchanged. | Add file writes to semanticRepairCommand: write repaired card bodies, write updated coverage, write rebuilt index files. | `npm test` passes + test that verifies file content changes |
| B3 | ACCEPTED | `src/core/semanticRepair.ts:337-403` — semanticRepairCard reports `repaired: true` but never modifies card.body. writeDecisionCard/writeFlowCard are dead code. | Wire semanticRepairCard to actually fill sections and return new body. Command writes updated body to disk. | `npm test` passes + test that verifies boilerplate section is filled |
| N1 | ACCEPTED | `src/core/legacyIngest.ts:484` — computeSubjectHash hashes evidence path string, not file content. | Read file content then hash. | `npm test` passes |
| N2 | ACCEPTED | `src/core/legacyIngest.ts:30-44` — validateStateTransition exists but never called. | Add state transition validation in legacyIngest and CLI commands. | `npm test` passes |
| N3 | ACCEPTED | `src/cli.ts:28` — version "0.1.0" but package.json is "0.6.0" | Update to "0.6.0" | `repo-memory --version` shows 0.6.0 |
| N4 | DEFERRED | Missing plan-required tests (file moved/renamed freshness, tree hash mismatch) | Covered by B1 fix for tree hash. File moved test deferred. | — |
| N5 | DEFERRED | Compaction missing "mode" field | Minor — deferred | — |
| N6 | DEFERRED | Overview hardcoded "N/A" | Acceptable for Phase 2 — G2/G3 out of scope | — |