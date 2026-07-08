# KB Gaps — Final Code Council Feedback (balanced-code)

## Review metadata

- Preset: balanced-code
- Councillors: design (claude-sonnet-4-6), independent-coder (Qwen3-Coder-Next), correctness (glm-5.2 — timed out), adversarial-tests (gemini-3-flash — timed out)
- Base: 24d5bc176f84d0ce43482404f311ba0d01d3fb30
- Branch: v/kb-openspec
- Verification evidence: `npm run check` → build OK, 39 tests / 8 files pass (run by orchestrator 2026-07-09)
- Specs: docs/specs/REQUIREMENTS.md, docs/specs/IMPLEMENTATION_DESIGN.md
- Plan: docs/plans/kb-gaps-plan.md

## Councillor verdicts

| Councillor | Verdict |
|---|---|
| design | APPROVE |
| independent-coder | REVISE |
| correctness | (timed out — no verdict) |
| adversarial-tests | (timed out — no verdict) |

Consensus: SPLIT (1 APPROVE, 1 REVISE, 2 no-data). Orchestrator independently verified every finding against repo evidence.

## Disagreements preserved

1. `--memory-root` CLI option: design did not flag; independent-coder flagged as HIGH/MEDIUM. Orchestrator verdict: REJECTED (plan §11 says "where relevant"; bootstrap derives memoryRoot from --root, consistent with all other commands in repo).
2. Bootstrap idempotency merge strategy: design approved as-is; independent-coder requested merge. Orchestrator verdict: REJECTED (plan §4 step 7 explicitly mandates skip-without-force; merge strategy is v0.2 scope, YAGNI now).
3. Pure-function test coverage: independent-coder claimed missing; design confirmed present. Orchestrator verdict: REJECTED (test/ingest-spec.test.ts tests classifySpecActuality/extractClaims/checkEvidence directly; test/reconcile.test.ts tests reconcileMemory core directly).

## Findings ledger

| ID | Status | Evidence | Decision | Required change | Verification |
|---|---|---|---|---|---|
| F1 | ACCEPTED | src/index.ts:12 and :14 both `export * from "./core/bootstrapMemory.js"` | Duplicate export — harmless but sloppy | Remove line 14 | `npm run check` still passes |
| F2 | REJECTED | independent-coder claimed `--memory-root` missing in bootstrap command (cli.ts:94-102) | Plan §11 says "where relevant"; bootstrap uses resolveMemoryRoot(options) derived from --root, matching init/validate/context convention. No other command exposes --memory-root. Adding it would be inconsistent scope expansion. | None | n/a |
| F3 | REJECTED | independent-coder claimed missing pure-function tests for classifySpecActuality/extractClaims/checkEvidence | test/ingest-spec.test.ts:9-93 tests all three functions directly (extractClaims line 13, classifySpecActuality line 27, checkEvidence line 71 + 86). 6 tests. | None | n/a |
| F4 | REJECTED | independent-coder claimed missing reconcile unit tests | test/reconcile.test.ts:9-40 tests reconcileMemory core function directly (staleRefs, clean, read-only). 3 tests. | None | n/a |
| F5 | REJECTED | independent-coder claimed bootstrap needs merge strategy for existing cards | Plan Task 4 step 7 explicitly: "skip existing card files unless --force. Never overwrite hand-written cards silently." Merge strategy = v0.2, YAGNI. Current skip behavior is spec-compliant. | None | n/a |
| F6 | REJECTED | independent-coder C3: reconcile memory-root path handling inconsistency | bootstrapMemory.ts:17 uses resolveMemoryRoot(options); reconcile uses same options flow. No real inconsistency — both use resolveMemoryRoot under the hood. | None | n/a |
| F7 | REJECTED | independent-coder C4: ingest-spec doesn't handle `context` field | REQUIREMENTS §7 has no `context` field requirement for claims. extractClaims returns Claim[] per ClaimSchema. Out of scope / unsupported. | None | n/a |
| F8 | REJECTED | independent-coder Q3: no strict mode verification | tsconfig.json has `"strict": true` (verified by orchestrator). | None | n/a |
| F9 | DEFERRED | design O6: decision extraction uses signals not content | Valid observation, but plan §4 step 4 says "only if explicit rationale sections found (headings: why/rationale/decision/alternatives/constraints)". Signal-based extraction is the specified v0.1 approach. Content parsing = v0.2. | None now | n/a |
| F10 | DEFERRED | design O4: reconcile orphan module heuristic may miss some | Valid v0.1 limitation, documented as heuristic. Acceptable per design §13 MVP constraints. | None now | n/a |

## Accepted fix set

Only F1 (duplicate export removal). Single-line cosmetic fix, no behavior change.

## Next gate

RERUN_COUNCIL — after F1 fix, rerun verification (`npm run check`) and optionally a fresh focused review. F1 is cosmetic; no second full council required if `npm run check` passes post-fix. Verdict stands at APPROVE pending F1.