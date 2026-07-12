# Phase 4 Code Review Feedback Ledger

## Metadata

- **Requirements**: `docs/specs/GAP_CLOSURE_SPEC.md` §6
- **Design**: `docs/plans/phase4-design.md` (user-approved)
- **Plan**: `docs/plans/phase4-plan.md` (Council R2 APPROVE)
- **Base**: 37d027a (Phase 3 complete, v0.7.0)
- **Head**: working tree (uncommitted Phase 4)
- **Council preset**: balanced-code
- **Verdict**: REVISE (2 blocking, 6 non-blocking, 5 test gaps)

## Decision Ledger

| ID | Severity | Status | Evidence | Decision | Required change | Verification |
|---|---|---|---|---|---|---|
| B1 | CRITICAL | ACCEPTED | `migrateFromV3.ts:142` uses `pathToId(p)` → `modules-test-module` (includes subdir). `synthesizeFrontmatter` line 86: `slug = filename.replace(/\.md$/, "")` → id `test-module` (filename-only). targetCards ids will NEVER match card ids. Test at `migrateFromV3.test.ts:268` asserts wrong expected value `modules-test-module`. | Fix `migrateSourceCoverage` to derive ids the same way as `synthesizeFrontmatter`: filename-based, not full-path-based. Fix test assertion. | Change line 142: `entry.targetCards = entry.targetCards.map((p) => { const filename = path.basename(p, ".md"); return filename.toLowerCase().replace(/[^a-z0-9\-_.]/g, "-").replace(/^[-_.]+/, ""); });` Fix test: assert `"test-module"` not `"modules-test-module"`. | Add cross-reference test: read migrated card id, verify source-coverage targetCards contains that id |
| B2 | CRITICAL | ACCEPTED | `migrateFromV3.ts:326-331` uses `path.relative(v3Dir/knowledge/docs, doc.relativePath)` but `doc.relativePath` is relative to v3Dir. Result is nonsensical. Doesn't use `mapDocsPath` for subdir remapping. A `service` doc would go to `.ai/memory/services/` not `.ai/memory/modules/`. No test coverage. | Replace broken path computation with `mapDocsPath` from `migrateDocs.ts`. Add integration test. | Replace lines 326-331 with: `const docTargetRelative = mapDocsPath(doc.relativePath, doc.frontmatter.node_type ?? ""); const docTargetPath = path.join(targetDir, docTargetRelative.replace(/^\.ai\/memory\//, ""));` | Add test: --include-docs with service doc → file at modules/ subdir |
| N1 | MINOR | DEFERRED | `migrateDoc` in migrateDocs.ts:165 doesn't thread `usedIds`. Two docs with same filename get same id. | Defer — `--include-docs` is optional, off by default. Address if docs migration becomes primary path. | — | — |
| N2 | MINOR | ACCEPTED | `migrateDoc` frontmatter not validated against `MemoryFrontmatterSchema` in tests. | Add `MemoryFrontmatterSchema.parse()` assertion to migrateDocs test. | Add to `test/migrateDocs.test.ts` | test validates full schema |
| N3 | MINOR | DEFERRED | `detectSlugCollisions` is dead code (exported, never called). Plan says dry-run only. | Defer — harmless, plan says it's for dry-run reporting which isn't wired yet. | — | — |
| N4 | MINOR | ACCEPTED | `runMigration` line 266: `migratedIds` set populated but never read. Dead code. | Remove the unused `migratedIds` set. | Remove lines declaring and populating `migratedIds` | tsc clean, tests pass |
| N5 | MINOR | ACCEPTED | `runMigration` lines 380-382: `catch {}` swallows ALL errors, not just missing structural files. | Narrow the catch to only swallow missing-file errors. | Check error message for "ENOENT" or structural-file-related, rethrow others | tsc clean, tests pass |
| N6 | MINOR | ACCEPTED | GAP_CLOSURE_SPEC says "540" tests but actual is 546. | Fix spec doc to say 546. | Update `GAP_CLOSURE_SPEC.md` metrics: 540→546 | — |
| TG1 | MINOR | ACCEPTED | No `--include-docs` integration test. B2 would have been caught. | Add integration test for `--include-docs` with real doc fixture. | Add to `test/migrateFromV3.test.ts` or `test/cli.test.ts` | test passes |
| TG2 | MINOR | ACCEPTED | No cross-reference test: migrated card id vs source-coverage targetCards. B1 would have been caught. | Add test: read migrated card id, verify source-coverage targetCards contains that id. | Add to `test/migrateFromV3.test.ts` | test passes |
| TG3 | MINOR | DEFERRED | Idempotency test incomplete — checks skip count but not card content unchanged. | Defer — low risk, skip-existing works. | — | — |
| TG4 | MINOR | DEFERRED | `--no-auto-review` not tested at CLI level. | Defer — unit test covers synthesizeFrontmatter logic. | — | — |
| TG5 | MINOR | DEFERRED | Concurrent migration not tested. | Defer — CLI tool, low priority. | — | — |

## Preserved Disagreement

None. All 2 blockers confirmed by direct code evidence. Non-blocking findings are improvements, not conflicts.

## Follow-up patch scope

- B1 (CRITICAL): Fix targetCards id derivation + fix test assertion + add cross-reference test
- B2 (CRITICAL): Fix --include-docs path computation + add integration test
- N2 (MINOR): Add schema validation to migrateDocs test
- N4 (MINOR): Remove dead migratedIds set
- N5 (MINOR): Narrow catch block in runMigration
- N6 (MINOR): Fix spec doc test count
- TG1 (MINOR): --include-docs integration test (same fix as B2)
- TG2 (MINOR): Cross-reference test (same fix as B1)

## Next Gate

RERUN_COUNCIL — re-run balanced-code after patches applied.