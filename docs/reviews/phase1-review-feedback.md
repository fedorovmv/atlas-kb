# Phase 1 Review Feedback Ledger

- **Spec**: `docs/specs/PHASE1_IMPLEMENTATION_SPEC.md`
- **Base**: `0403353125eae5d727ab8d6c10d9d76894f1f69a`
- **Head**: working tree (uncommitted)
- **Council preset**: balanced-code
- **Verdict**: REVISE

## Findings

| ID | Status | Evidence | Decision | Required change | Verification |
|---|---|---|---|---|---|
| B1 | ACCEPTED | `src/schemas/cardSections.ts:42-57` — decision contract has 8 required + 2 recommended; spec §3.2 L346-359 requires 10 required including `## Consequences`, `## Affected modules`, `## Affected scenarios`. Also `## Consequences/trade-offs` renamed from spec's `## Consequences`. | Make `## Affected modules` and `## Affected scenarios` required. Rename `## Consequences/trade-offs` → `## Consequences`. Update scaffold + bootstrap templates to match. | `npm test` passes + new test for decision with all 10 required sections |
| B2 | ACCEPTED | `src/schemas/cardSections.ts:126` — architecture contract requires `## Architecture by submodule`; spec §3.2 L426-428 requires `## Architecture overview`. | Change required to `## Architecture overview`. Update scaffold ARCHITECTURE.md + bootstrap template to use `## Architecture overview` instead of `## Architecture by submodule`. | `npm test` passes |
| B3 | ACCEPTED | `src/core/validate.ts:69` — `requiredSubdirs` includes `reference/`. `src/core/bootstrapMemory.ts:116-117` — only creates `flows/` and `architecture/`, NOT `reference/`. Fresh bootstrap → validate fails with "Missing required subdirectory: reference/". | Remove `reference/` from `requiredSubdirs` (spec §2 defers reference/ to Phase 2). Also remove `decisions/` if bootstrap doesn't create it — check. Bootstrap creates `modules/` implicitly via module cards, `flows/` and `architecture/` explicitly. `decisions/` is created by decision card writes. Keep only dirs bootstrap actually creates: `modules`, `flows`, `decisions`, `architecture`. | `npm test` passes; new test: bootstrap then validate → no missing subdir errors |
| T1 | ACCEPTED | `test/triage.test.ts:111` — test ">30% unknown throws" doesn't test the throw. Test body explains it can't trigger and doesn't assert throw. Spec §8.4 requires this test. | Add test that forces >30% unknown by mocking `triageDisposition` or constructing a SourceCoverage with >30% unknown entries and calling triageSources (or testing the ratio check directly). | New test passes |
| N5 | ACCEPTED | `src/core/sourceCoverage.ts` `triageSources` writes source-coverage.json unconditionally. `src/core/bootstrapMemory.ts:248` has empty `if (!options.dryRun)` block. `bootstrap --dry-run` writes source-coverage.json to disk. | Pass `dryRun` option through to `triageSources` and skip file write when dryRun is true. | `npm test` passes; verify `bootstrap --dry-run` doesn't create source-coverage.json |

## Rejected findings
(none)

## Deferred findings
(none)