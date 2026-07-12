# Phase 4 Plan Review Feedback Ledger

## Metadata

- **Requirements**: `docs/specs/GAP_CLOSURE_SPEC.md` §6
- **Design**: `docs/plans/phase4-design.md` (user-approved)
- **Plan**: `docs/plans/phase4-plan.md`
- **Brief**: `docs/plans/phase4-brief.md`
- **Base**: Phase 3 complete (v0.7.0, 455 tests)
- **Council preset**: balanced-plan
- **Verdict**: REVISE (1 CRITICAL, 7 MAJOR, 5 MINOR)

## Decision Ledger

| ID | Source | Severity | Status | Evidence | Decision | Required change | Verification |
|---|---|---|---|---|---|---|---|
| 1 | C1,C2,C3,C4 | CRITICAL | ACCEPTED | Task 1 creates `src/core/migrateFromV3.ts`, Task 2 "extends" it. Both write same file. Parallel claim false. plan:28,82,99 | Split file ownership: Task 1 → `src/core/migrateSynthesis.ts` + `src/schemas/migrateFromV3.ts`; Task 2 → `src/core/migratePaths.ts`. Task 2 must NOT extend migrateFromV3.ts. Test files: Task 1 → `test/migrateSynthesis.test.ts`, Task 2 → `test/migratePaths.test.ts`. | Apply Patch 1 to plan | dependency graph correct, no write overlap |
| 2 | C1,C2,C3 | MAJOR | ACCEPTED | `--include-docs` flag registered plan:218, passed to handler plan:152, design:166 specifies docs mapping, NO task implements. Dead flag. | Add Task 2b (`implementation/2b-migrate-docs`) with `mapDocsPath`, `migrateDoc`, `discoverV3Docs`. Wire into runMigration conditional on `includeDocs`. | Apply Patch 8 to plan | Task 2b tests pass |
| 3 | C1,C3 | MAJOR | ACCEPTED | `synthesizeFrontmatter(v3fm)` plan:48 has no options param. `--no-auto-review` design:93 requires it. Flag registered plan:221. | Change signature to `synthesizeFrontmatter(v3fm, options: { noAutoReview?: boolean })`. Add test. | Apply Patch 2 to plan | test: noAutoReview=true → review_required=false for all |
| 4 | C1 | MAJOR | ACCEPTED | `MemoryFrontmatterSchema.title: z.string().min(1)` frontmatter.ts:117 REQUIRED. v3 marks title optional plan:33. No synthesis rule in design. Cards without title fail schema parse. | Add `synthesizeTitle(v3fm, filename)` — use v3 title if present, else derive from filename. Add to Task 1. | Apply Patch 2 to plan | test: missing title → derived from filename |
| 5 | C1,C2,C3 | MAJOR | ACCEPTED | `reference/` not in scaffold design:216. plan:89 lists only 5 subdirs. 15 of 20 entity types have no target subdir. atomicWrite will ENOENT. | Add `ENTITY_TYPE_TO_SUBDIR` map (20 entries) to Task 2. Add `ensureTargetSubdirs()` + `mkdir -p` in runMigration. atomicWrite must mkdir -p path.dirname. | Apply Patch 4 + Patch 5 to plan | test: reference/ created if missing |
| 6 | C1,C2 vs C4 | MAJOR | ACCEPTED | `.passthrough()` frontmatter.ts:157 preserves v3 keys. validate.ts warns on unknown keys. synthesizeFrontmatter doesn't strip v3 keys. | Output frontmatter contains ONLY ts-kb-flow keys. v3 keys consumed by transforms or dropped. Metadata in body comments via decorateBody. Add test: output has no memory_card_type, scope, owned_paths, related_cards, language. | Apply Patch 2 to plan | test: no v3 keys in output |
| 7 | C1,C2,C3 | MAJOR | ACCEPTED | `synthesizeId(slug, usedIds)` plan:46 per-card. `detectSlugCollisions(slugs)` plan:97 batch. Redundant. Design has single collision rule. | Designate `synthesizeId` as canonical. runMigration threads shared `usedIds: Set<string>`. `detectSlugCollisions` repurposed as dry-run preview only. | Apply Patch 3 to plan | runMigration uses shared Set |
| 8 | C1 | MAJOR | ACCEPTED | `validateMemory()` validate.ts:58-72 requires structural files (MEMORY.md, MODULES.md, DECISIONS.md, ARCHITECTURE.md) + subdirs. Fresh target fails. plan:148 runs full validateMemory. | Validate ONLY migrated cards: per-card MemoryFrontmatterSchema.parse() + duplicate-id check + relation-target check. Full validateMemory() as WARNING-only, not gate. | Apply Patch 5 to plan | test: fresh target validation passes |
| 9 | C1,C2,C4 | MINOR | ACCEPTED | Fixture creation plan:179 buried after Task 3 test list. No task ID. | Move fixture creation BEFORE Task 3 test list. Note: Tasks 1-2 use inline mock data, NOT fixture. | Apply Patch 5 to plan | fixture exists before tests |
| 10 | C1,C3 | MINOR | ACCEPTED | Each task has per-file vitest. No full suite run. plan:315 Task 5 only git diff. | Add final verification: `npx vitest run` (full suite) + `npx tsc --noEmit`. Both must pass. | Apply Patch 7 to plan | full suite passes |
| 11 | C2,C3 | MINOR | ACCEPTED | `migrateSourceCoverage` plan:136 doesn't specify reuse of `pathToId` from Task 2. Design:161 requires same slug logic. | Task 3 must import `pathToId` from `migratePaths.ts` for targetCards transform. | Apply Patch 5 to plan | consistent path→id |
| 12 | C1 | MINOR | ACCEPTED | Design:110 `superseded → ["historical_context"]`. plan:62 only tests historical-only. Design:125 `historical` override. plan:64 only tests deprecated. | Add Task 1 tests: superseded → knowledge_types=["historical_context"]; historical status → usage_policy override. | Add to Task 1 test list | tests cover superseded + historical |
| 13 | C1 | MINOR | DEFERRED | Design §4 self-contradiction: "direct copy" vs "transform targetCards". Spec hygiene, not plan defect. | Fix design §4 line 155: "copy with targetCards path→id transform". | Note in ledger | — |

## Preserved Disagreement

**F6 (passthrough)**: C4 (independent-coder) argued v3 fields should be preserved via `.passthrough()` to avoid data loss. C1, C2 argued v3 keys must be dropped (validate.ts warns on unknown keys → noise; metadata in body comments). **Resolution**: ACCEPTED majority position (drop v3 keys, metadata in body comments). Cleaner, no validation noise.

## Patch Summary

- **Critical**: Patch 1 (file ownership split)
- **Major**: Patches 2-6 (signature fix, title synthesis, subdir map, validation scope, slug dedup)
- **Minor**: Patches 7, 8 (full-suite verification, Task 2b docs migration)
- **Deferred**: F13 (design doc typo, not plan defect)

All patches modify the plan document only. No code changes — implementation starts after Council re-approval.

## Next Gate

RERUN_COUNCIL — re-run balanced-plan with patched plan.

---

## Round 2 (Council verdict: REVISE → APPROVED after additional patches)

Round 2 Council identified that F1 patch was incompletely applied — header was updated but body Files blocks still referenced `src/core/migrateFromV3.ts` as shared/extended file across Tasks 1-3, and test file `test/migrateFromV3.test.ts` was shared across Tasks 1-3. This reintroduced the parallel-execution conflict. Three councillors (correctness, design, adversarial-tests) flagged it as MAJOR; one (independent-coder) missed it in body but noted related ambiguity.

### Round 2 findings and resolution

| ID | Source | Severity | Status | Evidence | Decision | Applied |
|---|---|---|---|---|---|---|
| N1 | correctness, design, adversarial-tests | MAJOR | ACCEPTED | Body Files blocks (lines 32, 49, 91, 103, 166, 171) still referenced `migrateFromV3.ts` as shared/extended file despite header split. Test file `migrateFromV3.test.ts` shared across Tasks 1-3. | Renamed Task 1 file → `migrateSynthesis.ts`, moved Task 2 structural transforms into `migratePaths.ts`, Task 3 creates `migrateFromV3.ts` as new orchestrator. Split test files: `migrateSynthesis.test.ts`, `migratePaths.test.ts`, `migrateFromV3.test.ts`. Updated test targets table. | ✅ 15 edits applied |
| N2 | correctness | MINOR | ACCEPTED | Task 5 ID `implementation/5-migrate-docs` collided with Task 2b `implementation/2b-migrate-docs`. | Renamed Task 5 ID → `implementation/5-changelog-spec`. | ✅ |
| N3 | correctness, design | MINOR | ACCEPTED | `runMigration` step list omitted `includeDocs` conditional invocation. | Added explicit step 6: "If `options.includeDocs`: discover v3 docs, migrate each via `migrateDoc` + atomicWrite." | ✅ |
| N4 | correctness | MINOR | ACCEPTED | Test count inconsistency: header 456 vs Task 5 verification 455. | Aligned to 456 existing + ~57 new. | ✅ |
| N5 | correctness | MINOR | DEFERRED | 7 EntityTypeSchema values have no v3 source (scaffold-only). Informational, not a defect. | Noted in ledger. | — |
| N6 | correctness | MINOR | DEFERRED | `.passthrough()` schema means v3 keys survive silently if spread. | Added implementation note to `synthesizeFrontmatter`: construct fresh object, do not spread `v3fm`. | ✅ |

### Round 2 verdict: APPROVE

All MAJOR and blocking MINOR findings resolved. N5 deferred (informational). Plan ready for implementation.