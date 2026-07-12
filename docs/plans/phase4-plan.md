# Phase 4 Plan: migrate-from-v3

> Brief: phase4-brief.md | Design: phase4-design.md | Phase 3: COMPLETE (455 tests, v0.7.0)
> Target: v0.8.0 | Status: ✅ COMPLETE (547 tests, balanced-plan R2 + balanced-code R3 APPROVE)

---

## Dependency graph

```
Task 1 (schemas + synthesis)    ──┐
                                  ├──→ Task 3 (pipeline) ──→ Task 4 (CLI) ──→ Task 5 (docs)
Task 2 (paths + transforms)     ──┘
Task 2b (docs migration, opt)   ──┘
```

Tasks 1, 2, and 2b are independent — can execute in parallel.
Each task owns a distinct file: Task 1 → `src/core/migrateSynthesis.ts` + `src/schemas/migrateFromV3.ts`;
Task 2 → `src/core/migratePaths.ts`; Task 2b → `src/core/migrateDocs.ts`;
Task 3 → `src/core/migrateFromV3.ts` (pipeline orchestrator, sequential after 1+2+2b).
No task extends a file created by another parallel task.

---

## Task 1: Migration schema + field synthesis

**ID:** `implementation/1-migrate-schema`

**Description:** Define Zod schemas for v3 frontmatter, all enum/type mapping tables, and synthesis functions that produce `MemoryFrontmatter` from v3 frontmatter. This task produces pure functions with no I/O.

**Files:**
- `src/schemas/migrateFromV3.ts` — new (schemas + types + static maps)
- `src/core/migrateSynthesis.ts` — new (synthesis functions, no I/O yet)

**Key types / maps to implement:**

*In `src/schemas/migrateFromV3.ts`:*
- `V3FrontmatterSchema` — Zod schema for v3 frontmatter shape (4 required: `memory_card_type`, `runtime_tier`, `source_status`, `evidence_level`; optional: `scope`, `owned_paths`, `related_cards`, `language`, `title`)
- `ENTITY_TYPE_MAP` — Record mapping v3 `memory_card_type` (14 values) → ts-kb-flow `entity_type` (20 values). Index variants (`index`, `module-index`, `flow-index`, `decision-index`) all map to `"readme"`.
- `STATUS_MAP` — v3 `source_status` → ts-kb-flow `status` (per design §2.2)
- `AUTHORITY_MAP` — v3 `evidence_level` → ts-kb-flow `authority` (per design §2.3)
- `EVIDENCE_LEVEL_MAP` — v3 `evidence_level` → ts-kb-flow `evidence_level` (per design §2.4)
- `STABILITY_MAP` — v3 `source_status` → ts-kb-flow `stability` (per design §2.5)
- `SOURCE_CONFIDENCE_MAP` — v3 `evidence_level` → `source_confidence` (per design §2.6)
- `KNOWLEDGE_TYPES_MAP` — v3 `memory_card_type` → `knowledge_types[]` (per design §2.9)
- `MigrationOptions` interface
- `MigrationResult` interface (per-card result: frontmatter, body, v3Metadata, warnings)
- `MigrationReport` interface (aggregate: migrated, skipped, errors, warnings)

*In `src/core/migrateSynthesis.ts`:*
- `synthesizeId(slug: string, usedIds: Set<string>)` → string — derive stable id from filename slug, handle collisions with `-1`, `-2` suffix
- `synthesizeUsagePolicy(status: Status)` → `UsagePolicy` — defaults per entity_type, override for deprecated/historical
- `synthesizeFrontmatter(v3fm: V3Frontmatter, options: { noAutoReview?: boolean })` → `MemoryFrontmatter` — combine all maps + synthesizeId to produce full ts-kb-flow frontmatter. When `options.noAutoReview` is true, force `review_required: false` for ALL cards (overrides §2.8 exception logic). Output contains ONLY ts-kb-flow schema keys; v3 input keys are consumed by transforms or dropped (metadata preserved in body via `decorateBody`). **Implementation note:** Construct a fresh `MemoryFrontmatter` object field-by-field; do NOT spread `v3fm` (the schema uses `.passthrough()`, so leftover v3 keys would silently survive).
- `synthesizeTitle(v3fm: V3Frontmatter, filename: string)` → string — if v3 `title` present and non-empty, use it; else derive from filename (strip `.md`, replace `-`/`_` with spaces, title-case). Required because `MemoryFrontmatterSchema.title` is `z.string().min(1)`.
- `decorateBody(body: string, v3fm: V3Frontmatter)` → string — preserve `language` as `<!-- v3: language=X -->` comment, preserve v3 `memory_card_type` if collapsed to `readme`

**Tests:** `test/migrateSynthesis.test.ts` (new)
- `V3FrontmatterSchema` validates known v3 frontmatter shapes
- `V3FrontmatterSchema` rejects missing `memory_card_type`
- `ENTITY_TYPE_MAP` covers all 14 v3 types, index variants map to `readme`
- `STATUS_MAP` all 6 source_status values produce valid ts-kb-flow status
- `AUTHORITY_MAP` all 8 evidence_level values produce valid authority
- `EVIDENCE_LEVEL_MAP` all 8 v3 evidence_level → correct ts-kb-flow evidence_level
- `STABILITY_MAP` all 6 source_status → correct stability
- `SOURCE_CONFIDENCE_MAP` all 8 evidence_level → correct confidence
- `KNOWLEDGE_TYPES_MAP` all 14 types → correct knowledge_types arrays
- `synthesizeFrontmatter` produces valid `MemoryFrontmatterSchema` parse
- `synthesizeFrontmatter` with `historical-only` status prepends `historical_context` to knowledge_types
- `synthesizeFrontmatter` with unknown `memory_card_type` defaults to `reference` + warning in comments
- `synthesizeUsagePolicy` with `deprecated` status sets `can_answer_current_behavior: false`, `requires_warning: true`
- `decorateBody` preserves `language` as body comment
- `decorateBody` preserves v3 type for index→readme collapse
- `synthesizeFrontmatter` with `superseded` source_status → `knowledge_types: ["historical_context"]`
- `synthesizeUsagePolicy` with `historical` status → `can_answer_current_behavior: false`, `requires_warning: true`
- `synthesizeFrontmatter` output has no v3 keys (`memory_card_type`, `scope`, `owned_paths`, `related_cards`, `language`)
- `synthesizeTitle` with missing title derives from filename

**Verification:**
```bash
cd ts-kb-flow && npx vitest run test/migrateSynthesis.test.ts
```

---

## Task 2: Path mapping + structural transforms

**ID:** `implementation/2-migrate-paths`

**Description:** Path mapping from v3 layout to ts-kb-flow layout, structural field transforms (`related_cards`, `owned_paths`, `scope`), and slug collision detection. Pure functions, no I/O.

**Files:**
- `src/core/migratePaths.ts` — new (shared path utilities + structural transforms)

**Key functions to implement:**

*In `src/core/migratePaths.ts`:*
- `mapPath(v3RelativePath: string)` → string — `knowledge/memory/X.md` → `.ai/memory/X.md` (strip prefix, prepend `.ai/memory/`)
- `subdirToEntityType(subdir: string)` → `entity_type | undefined` — `modules/` → `module`, `flows/` → `flow`, `decisions/` → `decision`, `architecture/` → `architecture`, `reference/` → `reference`
- `pathToId(relativePath: string)` → string — derive id from `.ai/memory/X.md` path (strip prefix, replace `/` with `-`, remove `.md`, lowercase)
- `idToTargetPath(id: string, entityType: string)` → string — reverse mapping for placing files
- `ENTITY_TYPE_TO_SUBDIR` — full Record<entity_type, string> mapping all 20 ts-kb-flow entity types to target subdirs: `module→modules/`, `flow→flows/`, `decision→decisions/`, `architecture→architecture/`, `reference→reference/`, `task_routing→routing/`, `testing→testing/`, `ops→ops/`, `gotchas→gotchas/`, `project→project/`, `readme→` (top-level), `scenario→scenarios/`, `proposal→proposals/`, `historical→historical/`, `conflict→conflicts/`, `open_question→questions/`, `product_map→maps/`, `ontology→ontology/`, `routing→routing/`, `index→` (top-level). Non-standard subdirs created on demand by `runMigration`.

*In `src/core/migratePaths.ts` (continued):*
- `mapRelatedCards(relatedCards: string[], v3Dir: string)` → `{ related_modules[], related_scenarios[], related_decisions[], related_specs[], unmapped[] }` — path-to-id conversion for related_cards, categorize by subdir, track unmapped
- `mapOwnedPaths(ownedPaths: string[])` → `code_refs[]` — transform path strings → `{path, kind: "owned"}` Ref objects
- `mapScope(scope: string | undefined)` → `product_areas[]` — wrap string into array or return `[]`
- `detectSlugCollisions(slugs: string[])` → `{ collisions: Map<string, string[]> }` — dry-run preview only; reports collisions that `synthesizeId` would resolve. Not used by `runMigration` (which threads a shared `usedIds: Set<string>` through `migrateCard` calls). Used only for `--dry-run` reporting.

**Tests:** `test/migratePaths.test.ts` (new)
- `mapPath` strips `knowledge/memory/` prefix, prepends `.ai/memory/`
- `mapPath` preserves subdirectory structure
- `pathToId` produces valid id regex from paths
- `pathToId` handles nested paths: `.ai/memory/sub/module-card.md` → `sub-module-card`
- `mapRelatedCards` with `modules/X.md` → `related_modules`
- `mapRelatedCards` with `flows/Y.md` → `related_scenarios`
- `mapRelatedCards` with `decisions/Z.md` → `related_decisions`
- `mapRelatedCards` with unknown subdir → `unmapped` array
- `mapOwnedPaths` transforms string paths to `{path, kind: "owned"}`
- `mapScope("backend")` → `["backend"]`
- `mapScope(undefined)` → `[]`
- `detectSlugCollisions` with duplicate slugs proposes `-1`, `-2` suffixes
- `detectSlugCollisions` with unique slugs returns empty collisions

**Verification:**
```bash
cd ts-kb-flow && npx vitest run test/migratePaths.test.ts
```

---

## Task 2b: Docs migration (optional, `--include-docs`)

**ID:** `implementation/2b-migrate-docs`

**Description:** Implement `knowledge/docs/` migration logic per design §6. Only invoked when `--include-docs` flag is set. Default behavior skips docs entirely.

**Files:**
- `src/core/migrateDocs.ts` — new (docs path mapping + type transforms)
- `test/migrateDocs.test.ts` — new

**Key functions:**
- `mapDocsPath(v3DocsPath: string)` → string — map `knowledge/docs/X` → `.ai/memory/X` with type-specific subdir (service→modules/, runbook→ops/, gotcha→gotchas/, guide→reference/)
- `migrateDoc(v3Doc, options)` → MigrationResult — transform docs card frontmatter using same synthesis rules as memory cards
- `discoverV3Docs(v3Dir)` → V3Card[] — walk `knowledge/docs/**/*.md`

**Tests:** `test/migrateDocs.test.ts`
- `mapDocsPath` maps all 4 doc types to correct subdirs
- `migrateDoc` produces valid MemoryFrontmatter
- `runMigration` with `includeDocs: true` migrates docs
- `runMigration` with `includeDocs: false` skips docs entirely

**Verification:**
```bash
cd ts-kb-flow && npx vitest run test/migrateDocs.test.ts
```

---

## Task 3: Migration core pipeline

**ID:** `implementation/3-migrate-pipeline`

**Description:** Full migration pipeline — discovery, per-card migration, source-coverage copy, staging management, atomic writes, and post-migration validation. This is the core orchestration layer.

**Files:**
- `src/core/migrateFromV3.ts` — new (pipeline orchestration: discovery, migrateCard, runMigration; imports from `migrateSynthesis.ts` + `migratePaths.ts`)
- `src/commands/migrateFromV3.ts` — new (command handler, thin wrapper around core)

**Key functions to implement:**

*In `src/core/migrateFromV3.ts`:*
- `discoverV3Cards(v3Dir: string)` → `V3Card[]` — walk `knowledge/memory/**/*.md`, parse YAML frontmatter, return card inventory with file paths and parsed frontmatter
- `migrateCard(v3Card: V3Card, options: MigrationOptions)` → `MigrationResult` — apply full transform (synthesize frontmatter, structural transforms, decorate body)
- `migrateSourceCoverage(v3Dir: string, targetDir: string, stagingDir: string)` → boolean — copy `source-coverage.json`, validate with `SourceCoverageSchema`, transform `targetCards` paths to ids
- `migrateSourceManifest(v3Dir: string, targetDir: string)` → boolean — optional copy of `source-manifest.json`
- `createStagingDir(root: string)` → string — create `.ai/memory-build/v3-migration/` with subdirs (`migrated/`, `skipped/`, `errors/`) and `migration-plan.json`
- `atomicWrite(targetPath: string, content: string, stagingDir: string)` — write to staging, then rename to target
- `logMigrationEntry(stagingDir: string, entry: MigrationLogEntry)` — append to `log.jsonl`
- `runMigration(v3Dir: string, options: MigrationOptions)` → `MigrationReport` — orchestrate full migration:
  1. Create staging dir, write migration-plan.json
  2. Discover v3 cards
  3. Pre-compute id map: thread shared `usedIds: Set<string>` through all cards
  4. `ensureTargetSubdirs(targetDir, entityTypes)` — `mkdir -p` all target subdirs (including `reference/` and any non-standard) before writes
  5. For each card: check if target exists (skip/force), migrate card, atomic write (with `mkdir -p path.dirname`), log
  6. If `options.includeDocs`: discover v3 docs (`discoverV3Docs`), migrate each via `migrateDoc` + atomicWrite
  7. Migrate `source-coverage.json` using `pathToId` from `migratePaths.ts` for `targetCards` transform (unless `--skip-coverage`); use `atomicWrite`
  8. Optional: copy `source-manifest.json` (`--preserve-manifest`)
  9. Drop `index.json`, `memory-contract.json` (log, don't copy)
  10. Post-migration validation: `MemoryFrontmatterSchema.parse()` per migrated card + duplicate-id check + relation-target existence check. Optionally run full `validateMemory()` as WARNING-only (not a gate).
  11. Return `MigrationReport`

*In `src/commands/migrateFromV3.ts`:*
- `migrateFromV3Command(args: { root: string, v3Dir: string, force: boolean, dryRun: boolean, json: boolean, includeDocs: boolean, skipCoverage: boolean, preserveManifest: boolean, noAutoReview: boolean })` — resolve paths, call `runMigration`, format text or JSON output

**Staging directory layout:**
```
.ai/memory-build/v3-migration/
├── migration-plan.json     # v3Dir, targetDir, options, discovered count, timestamp
├── migrated/               # staging copies of transformed cards (before atomic rename)
├── skipped/                # list of skipped cards (existing, not --force)
├── errors/                 # cards that failed (malformed YAML, missing required fields)
└── log.jsonl               # per-card migration log entries
```

**Tests:** `test/migrateFromV3.test.ts` (new — pipeline integration tests)
- `discoverV3Cards` finds all `.md` files in `knowledge/memory/` subdirs
- `discoverV3Cards` skips non-`.md` files (index.json, memory-contract.json)
- `migrateCard` produces valid `MemoryFrontmatter` and decorated body
- `migrateCard` with missing `memory_card_type` → error in result
- `migrateCard` with unknown type → warning, defaults to `reference`
- `runMigration` with fixture v3 bank → migrated count matches discovery
- `runMigration` with `--dry-run` → 0 files written, report shows what would happen
- `runMigration` with existing targets and no `--force` → skips existing, report shows skipped count
- `runMigration` with `--force` → overwrites existing
- `migrateSourceCoverage` copies and validates `source-coverage.json`
- `migrateSourceManifest` copies only when flag enabled
- `atomicWrite` uses temp + rename pattern
- edge case: malformed YAML frontmatter → card added to errors, migration continues

**Fixture setup (FIRST — before any Task 3 test runs):** Create test fixture in `test/fixtures/v3-memory/` with:
- `knowledge/memory/modules/test-module.md` — valid v3 card
- `knowledge/memory/flows/test-flow.md` — valid v3 card
- `knowledge/memory/decisions/test-decision.md` — valid v3 card with `related_cards`
- `knowledge/memory/architecture/test-arch.md` — valid v3 card with `owned_paths`
- `knowledge/memory/reference/test-ref.md` — v3 card with `scope`
- `knowledge/memory/source-coverage.json` — valid source coverage
- `knowledge/memory/source-manifest.json` — valid manifest
- `knowledge/memory/index.json` — should be dropped
- `knowledge/memory/broken.md` — malformed YAML

Tasks 1 and 2 unit tests use inline mock data, NOT this fixture.

**Verification:**
```bash
cd ts-kb-flow && npx vitest run test/migrateFromV3.test.ts
```

---

## Task 4: CLI command + integration

**ID:** `implementation/4-migrate-cli`

**Description:** Register `migrate-from-v3` CLI command in commander.js, wire up all options from design §9, implement text and JSON output formats, export from `index.ts`.

**Files:**
- `src/cli.ts` — modify (add command registration after existing Phase 3 commands)
- `src/commands/migrateFromV3.ts` — modify (ensure command handler matches CLI signature)
- `src/index.ts` — modify (export `migrateFromV3Command`, migrate schemas)
- `test/cli.test.ts` — extend (CLI integration tests)

**CLI registration pattern** (follow existing pattern in `src/cli.ts`):
```typescript
program
  .command("migrate-from-v3 <v3-dir>")
  .description("Migrate v3 knowledge/memory/ to ts-kb-flow .ai/memory/")
  .option("--root <path>", "Target repo root", process.cwd())
  .option("--force", "Overwrite existing files", false)
  .option("--dry-run", "Preview only, no writes", false)
  .option("--json", "JSON output", false)
  .option("--include-docs", "Migrate knowledge/docs/", false)
  .option("--skip-coverage", "Skip source-coverage.json", false)
  .option("--preserve-manifest", "Copy source-manifest.json", false)
  .option("--no-auto-review", "Set review_required=false for all", false)
  .action(async (v3Dir, opts) => {
    await migrateFromV3Command({
      root: opts.root, v3Dir,
      force: opts.force, dryRun: opts.dryRun, json: opts.json,
      includeDocs: opts.includeDocs, skipCoverage: opts.skipCoverage,
      preserveManifest: opts.preserveManifest, noAutoReview: opts.noAutoReview,
    });
  });
```

**Output format (text):**
```
📋 Migrating v3 memory bank: <v3Dir>
   → Target: <root>/.ai/memory/

Discovery:      42 cards found in knowledge/memory/
Migrated:       38 cards
Skipped:        2 cards (existing)
Errors:         1 card (malformed YAML: broken.md)
Warnings:       3 (2 unmapped related_cards, 1 unknown type)

Source coverage: copied and validated
Source manifest: preserved

Post-migration validation: PASSED (0 errors, 3 warnings)
  - Card "module-x": weak evidence_level=spec_only
  - Card "decision-y": missing ## Rationale section
```

**Output format (JSON):**
```json
{
  "command": "migrate-from-v3",
  "v3Dir": "/path/to/v3",
  "target": "/path/to/repo/.ai/memory/",
  "discovered": 42,
  "migrated": 38,
  "skipped": 2,
  "errors": 1,
  "warnings": 3,
  "coverageMigrated": true,
  "manifestPreserved": true,
  "validation": "passed"
}
```

**Exports in `src/index.ts`:**
- `migrateFromV3Command` from `./commands/migrateFromV3.js`
- `V3FrontmatterSchema`, `MigrationResult`, `MigrationReport` from `./schemas/migrateFromV3.js`

**Tests:** `test/cli.test.ts` (extend)
- `CLI migrate-from-v3 <v3-dir>` — basic migration with tmpdir fixture
- `CLI migrate-from-v3 --dry-run` — no files written, text output shows preview
- `CLI migrate-from-v3 --json` — valid JSON output with expected keys
- `CLI migrate-from-v3 --force` — overwrites existing targets
- `CLI migrate-from-v3 --preserve-manifest` — manifest copied
- `CLI migrate-from-v3 help` — command listed with all options

**Verification:**
```bash
cd ts-kb-flow && npx vitest run test/cli.test.ts
```

---

## Task 5: CHANGELOG + spec update

**ID:** `implementation/5-changelog-spec`

**Description:** Update CHANGELOG with v0.8.0 entry and mark Migration as COMPLETE in GAP_CLOSURE_SPEC metrics table.

**Files:**
- `CHANGELOG.md` — modify (add v0.8.0 section)
- `docs/specs/GAP_CLOSURE_SPEC.md` — modify (metrics table: Migration row → Phase 4 ✅ COMPLETE)

**CHANGELOG.md additions:**
```markdown
## 0.8.0

### Added
- migrate-from-v3 command: full v3→ts-kb-flow memory bank migration
- V3FrontmatterSchema + migration field synthesis (4 required → 11+ required fields)
- entity_type mapping (14 v3 types → 20 ts-kb-flow types)
- Structural transforms: related_cards, owned_paths, scope
- source-coverage.json migration with path→id transformation
- Safety: --force, --dry-run, --json, skip-existing default, atomic writes, staging dir
- Post-migration validateMemory() check
```

**GAP_CLOSURE_SPEC.md edits:**
- Line 1414: `| Миграция | migrate-from-v3 | — | — | Phase 4 | Phase 4 → Phase 4 ✅ COMPLETE |`
- Add v0.8.0 to version line: `| Версия | — | v0.5.0 | v0.6.0 | v0.7.0 | v0.8.0 |`

**Verification:**
```bash
cd ts-kb-flow && npx vitest run
cd ts-kb-flow && npx tsc --noEmit
cd ts-kb-flow && git diff --stat
```
Full suite (456 existing + ~57 new tests) must pass. Type-check must pass across the branch.

---

## Test targets (summary)

| File | Task | Test count (est.) | Kind |
|------|------|-------------------|------|
| `test/migrateSynthesis.test.ts` | 1 | ~20 | Unit — schemas, maps, synthesis |
| `test/migratePaths.test.ts` | 2 | ~12 | Unit — path mapping, structural transforms |
| `test/migrateFromV3.test.ts` | 3 | ~15 | Integration — full pipeline, dry-run, force |
| `test/migrateDocs.test.ts` | 2b | ~4 | Unit — docs path mapping, migrateDoc |
| `test/cli.test.ts` | 4 | ~6 | Integration — CLI command with all flags |
| **Total** | | **~57** | |

## Fixture

`test/fixtures/v3-memory/` — minimal v3 memory bank with:
- 5 valid cards across different subdirs and types
- 1 card with `related_cards`, `owned_paths`, `scope`
- 1 card with malformed YAML
- `source-coverage.json`, `source-manifest.json`, `index.json`
