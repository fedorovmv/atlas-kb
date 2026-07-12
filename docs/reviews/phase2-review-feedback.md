# Phase 2 Review Feedback Ledger

- **Spec**: `docs/specs/GAP_CLOSURE_SPEC.md` §3 Domains D, E, F
- **Plan**: `docs/plans/phase2-plan.md`
- **Base**: Phase 2 commit (v0.6.0, 375 tests)
- **Council preset**: balanced-code
- **Initial verdict**: REVISE → APPROVE (after B1-B3, N1-N3 fixed in commit 049d408)
- **Round 2 review**: @oracle code-reviewer on 909518d..049d408 — verdict: With fixes (5 Important)

## Round 1 Findings (Council corrections, commit 049d408)

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

## Round 2 Findings (post-correction code review)

All 5 verified against repository evidence by orchestrator before delegation.

| ID | Status | Evidence | Decision | Required change | Verification |
|---|---|---|---|---|---|
| R2-1 | ACCEPTED | `src/core/semanticRepair.ts:619-625` rebuildIndexes returns booleans only, never writes. `src/commands/semanticRepair.ts:44` reports `decisionsIndex: true` but DECISIONS.md/FLOWS.md unchanged. | Write DECISIONS.md/FLOWS.md index tables from child cards in semanticRepairCommand after rebuildIndexes. Atomic temp+rename. | `npm test` passes + new test verifying DECISIONS.md content updated after semanticRepairCommand |
| R2-2 | ACCEPTED | `src/core/semanticRepair.ts:551-584` repairLinks modifies `newBody` but never assigns to `card.body` (line 581 comment). Command only writes `semanticRepairCard.repaired` cards, not link-repaired ones. | repairLinks assigns `card.body = newBody` when changed. Command writes link-repaired cards to disk. | `npm test` passes + new test verifying broken link fixed in file after repair |
| R2-3 | ACCEPTED | `src/core/semanticRepair.ts:586-598` repairModuleTiers updates `card.meta.runtime_tier` in memory. `src/commands/semanticRepair.ts:46-51` stub loop, no write. | Command writes cards with updated runtime_tier to disk (frontmatter rewrite). Track changed cards. | `npm test` passes + new test verifying runtime_tier persisted after repair |
| R2-4 | ACCEPTED | `src/core/legacyIngest.ts:490` `path.resolve(candidate.path, e.path)` resolves evidence relative to legacy doc path, not project root. Broken path → "MISSING:" hash → determinism violation. | Pass root to computeSubjectHash, resolve evidence relative to root: `path.resolve(root, e.path)`. Update approveCandidate/applyCandidate calls. | `npm test` passes + existing subjectHash tests still pass |
| R2-5 | ACCEPTED | `src/core/validate.ts:390` pushes "treeHash set — verification pending" warning. validateMemory (264-279) does actual async check → ERROR or silent. Pending warning = noise even on success. | Remove "verification pending" warning push at line 390. Async check in validateMemory is sufficient. | `npm test` passes + no duplicate warnings for reference cards with treeHash |

### Scope gates
- R2-1/2/3 share root cause (D3 post-repair writes incomplete) but touch different functions → single fixer lane for semanticRepair.ts + semanticRepair.ts command to avoid write conflict.
- R2-4 isolated to legacyIngest.ts → separate fixer lane.
- R2-5 isolated to validate.ts → separate fixer lane.
- No architecture conflicts. All within approved Phase 2 scope.
- Deferred from review: minor items (mode field N5, overview N/A N6, pattern consolidation, test output noise) — not required for merge.

## Verification (post-fix)

| ID | Diff verified | Tests added | Build | Test suite |
|---|---|---|---|---|
| R2-1 | ✓ rebuildIndexes returns decisionsTable/flowsTable; command writes DECISIONS.md/FLOWS.md preserving frontmatter | 1 (postRepair: table markdown) | clean | 382 pass |
| R2-2 | ✓ repairLinks assigns card.body, returns changedCards; command writes them | 1 (postRepair: card.body has fixed link) | clean | 382 pass |
| R2-3 | ✓ repairModuleTiers returns changedCards; command writes them | 2 (postRepair: changedCards populated + empty when no updates) | clean | 382 pass |
| R2-4 | ✓ computeSubjectHash(candidate, root?) resolves evidence via path.resolve(baseDir, e.path); approve/apply pass options.root | 1 (subjectHash: root-relative resolution) | clean | 382 pass |
| R2-5 | ✓ "verification pending" warning removed; async check in validateMemory sole source | 2 (referenceValidation: no pending warning unit + integration) | clean | 382 pass |

**Final state**: build clean, 382 tests pass (375 original + 7 new), diff confined to 6 source/test files + ledger. No scope creep.

## Round 3 (final review gate)

Final @oracle review on R2 corrections returned REVISE — 1 Critical regex bug in buildIndexContent.

| ID | Status | Evidence | Decision | Required change | Verification |
|---|---|---|---|---|---|
| R3-1 | ACCEPTED | `src/commands/semanticRepair.ts:40` — regex used `"m"` flag making `$` match end-of-every-line. Non-greedy `[\\s\\S]*?` stopped at first line end, capturing only first line of existing section → orphaned table rows when replacing populated index. | Drop `"m"` flag, change `^## ` to `\n## ` in lookahead. | `npm test` passes + new integration test |
| R3-2 | ACCEPTED | No test verifying buildIndexContent replaces existing populated section without orphaning rows. | Export buildIndexContent, add 3 tests: populated table replacement, frontmatter+custom preserved, no existing section appends. | `npm test` passes |
| R3-3 | DEFERRED | Multi-write inefficiency: same card written 2-3x if modified by multiple repair functions. Functionally correct (last write includes all mutations via shared in-memory object). | Acceptable for Phase 2 scope. Consolidate writes in future. | — |

### Post-R3 verification
- R3-1 regex fix: ✓ `"m"` flag removed, `\n## ` lookahead — verified in diff
- R3-2 tests: ✓ 3 new buildIndexContent tests (populated replacement, frontmatter preservation, append)
- Build: clean (tsc strict)
- Tests: 384/385 pass. 1 failure = pre-existing E2E integration timeout (verified fails on clean 049d408 commit too — unrelated to corrections)
- Total new tests across all rounds: 10 (7 R2 + 3 R3)