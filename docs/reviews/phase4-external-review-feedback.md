# Phase 4 External Review Feedback Ledger

## Metadata

- **Review source**: external `/receive-review balanced` (user-provided)
- **Profile**: balanced
- **Requirements**: `docs/specs/GAP_CLOSURE_SPEC.md` §6
- **Plan**: `docs/plans/phase4-plan.md`
- **Base**: 37d027a (Phase 3 complete)
- **Head**: working tree (uncommitted Phase 4 + corrections)
- **Build**: tsc clean, 546/546 tests pass

## Verification evidence

- B1: empirical test — Commander with `--no-auto-review, false` produces `opts.autoReview=false` in BOTH cases (flag present/absent). `opts.noAutoReview` is `undefined` always. CLI line 449 reads `opts.noAutoReview` → always undefined → `--no-auto-review` silently never works.
- B2: CHANGELOG line 23 says "455→540 (85 new)" but `vitest run` reports 546 tests. Actual: 91 new. Confirmed.
- N1: `migrateSynthesis.ts:31` — `normalized = "card-" + Date.now()` fallback. Non-deterministic across runs. Confirmed.
- N2: `migratePaths.ts` exports `detectSlugCollisions` — never called in pipeline. Confirmed dead code.
- N3: `migrateFromV3.ts:150-152` — `catch {}` swallows all errors in `migrateSourceCoverage`. Test logs show 4× "source-coverage.json migration failed" spam from fixtures without coverage file. Confirmed.
- N4: `migrateDocs.ts:165-173` — id generation duplicates `pathToId` logic. Confirmed duplication.
- N5: `migrateFromV3.ts:375` — `code === "ENOENT"` check is narrow but doesn't distinguish "missing structural files" from "missing file for other reason". Confirmed weak.
- N6: CLI tests cover basic/dry-run/json/force/preserve-manifest/help but NOT --include-docs, --skip-coverage, --no-auto-review. Confirmed.

## Decision Ledger

| ID | Severity | Status | Evidence | Decision | Required change | Verification |
|---|---|---|---|---|---|---|
| B1 | CRITICAL | ACCEPTED | Commander `--no-auto-review` with `default false` creates `opts.autoReview` not `opts.noAutoReview`. CLI line 449 reads `opts.noAutoReview` → always undefined. Flag silently broken. Empirically verified. | Rename flag to `--skip-review` (no `--no-` prefix, avoids Commander negation semantics). Update CLI registration + action handler + all references. | cli.ts:437 → `.option("--skip-review", "Set review_required=false for all", false)`. cli.ts:449 → `noAutoReview: opts.skipReview`. | Test: `--skip-review` flag sets `review_required=false` in migrated cards |
| B2 | MINOR | ACCEPTED | CHANGELOG line 23: "455→540 (85 new)". Actual: 546 tests, 91 new. | Fix CHANGELOG numbers. | CHANGELOG.md:23 → "Tests: 455→546 (91 new)" | visual check |
| N1 | MINOR | DEFERRED | `migrateSynthesis.ts:31` fallback `"card-" + Date.now()` non-deterministic. | Defer — only triggers for slugs that fail ID_REGEX after normalization (rare edge case). Idempotency concern is valid but low probability. | — | — |
| N2 | MINOR | DEFERRED | `detectSlugCollisions` exported, never called. Dead code. | Defer — harmless, plan says dry-run reporting (not yet wired). | — | — |
| N3 | MINOR | ACCEPTED | `migrateFromV3.ts:150-152` catch-all in `migrateSourceCoverage` swallows ALL errors. Test logs spam 4× "source-coverage.json migration failed" for fixtures without coverage. | Narrow catch to ENOENT (file missing = ok, skip) vs other errors (propagate as warning). | migrateFromV3.ts:148-150 → `} catch (err) { if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") { return false; } console.warn("source-coverage.json migration failed:", err); return false; }` | test logs no longer spam for missing coverage files |
| N4 | MINOR | DEFERRED | `migrateDocs.ts:165-173` id generation duplicates `pathToId` logic. | Defer — `pathToId` includes subdir in id (different behavior from filename-only). Not a clean reuse. Duplication is intentional per B1 fix context. | — | — |
| N5 | MINOR | DEFERRED | `migrateFromV3.ts:375` ENOENT check doesn't distinguish "missing structural files" vs "missing for other reason". | Defer — current behavior is acceptable (swallow ENOENT = fresh target, warn on others). Edge case is narrow. | — | — |
| N6 | MINOR | DEFERRED | CLI tests don't cover --include-docs, --skip-coverage, --no-auto-review (now --skip-review). | Defer — unit tests cover the underlying logic. CLI integration tests for these flags are follow-up. | — | — |

## Preserved Disagreement

None. All findings verified against code evidence. B1 is the only CRITICAL (silent flag bug). B2 is trivial doc fix. N3 is noise reduction. N1, N2, N4, N5, N6 are deferred (low risk, optional, or follow-up).

## Follow-up patch scope

- B1 (CRITICAL): Rename `--no-auto-review` → `--skip-review` in cli.ts + action handler. Add CLI test.
- B2 (MINOR): Fix CHANGELOG numbers 540→546, 85→91.
- N3 (MINOR): Narrow `migrateSourceCoverage` catch to ENOENT-only, warn on others.

## Next Gate

RERUN_COUNCIL — re-run balanced-code after B1+B2+N3 patches applied.