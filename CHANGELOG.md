# Changelog

## 0.8.0

### Added
- migrate-from-v3 command: full v3→ts-kb-flow memory bank migration with frontmatter synthesis
- V3FrontmatterSchema + migration field synthesis (4 v3 required → 11+ ts-kb-flow required fields)
- entity_type mapping (14 v3 memory_card_type → 20 ts-kb-flow entity_type, index variants collapse to readme)
- Structural transforms: related_cards→related_*, owned_paths→code_refs, scope→product_areas
- source-coverage.json migration with path→id transformation (schemas identical, direct copy + targetCards transform)
- Optional docs migration (--include-docs: service→module, runbook→ops, gotcha→gotchas, guide→reference)
- Safety: --force, --dry-run, --json, skip-existing default, atomic writes, staging dir
- Post-migration validation (per-card MemoryFrontmatterSchema.parse + duplicate-id + relation check)
- 4 new core modules: migrateSynthesis, migratePaths, migrateDocs, migrateFromV3
- 1 new schema: migrateFromV3 (V3FrontmatterSchema + 7 static maps + interfaces)

### Changed
- cli.ts: Added migrate-from-v3 command registration with 7 options
- index.ts: Added migrateFromV3Command + migration schema exports

### Notes
- CLI commands: 36→37 (1 new)
- Tests: 455→546 (91 new)
- v1.0.0 next: all v3 gaps closed

## 0.7.0

### Added
- G1: Adaptive workflow modes (DIRECT/PLAN/FULL) with change surface analysis via git diff
- G2: Session isolation tracking with execution lanes, duplicate detection, continuation validation
- G3: Route manifest integration into OVERVIEW.md (route reasons section)
- G4: Model routing profiles (quality/balanced/economy) with active profile switching
- H1: Git hooks (pre-commit validate, pre-push strict validate, post-checkout/post-merge index rebuild)
- H2: CI integration (GitHub Actions workflow template, `init --install-ci`)
- H3: OpenSpec integration (4 commands: new/status/check/archive, graceful degradation if not installed)
- Integration debt: 3 OpenCode tools (legacyIngest, compact, artifactSearch) — tools count 7→10
- 8 new CLI commands: route, session-open, session-close, profile, openspec-new, openspec-status, openspec-check, openspec-archive
- `init --install-hooks` and `init --install-ci` flags

### Changed
- cli.ts: version 0.6.0→0.7.0, 8 new command registrations, init command extended
- index.ts: 7 new module exports (workflow, session, modelRouting schemas + core modules)
- compaction.ts: Active lane section uses real session data instead of "N/A"
- overview.ts: Session lanes and route reasons sections use real data instead of "N/A"
- model-routing.yaml: Replaced flat models/routing with profiles (quality/balanced/economy), activeProfile, routing
- init.ts: Added installHooks/installCi options with hook and CI template installation

### Notes
- Existing projects that already ran `init` must re-run `repo-memory init --force` to update tools/memory.ts with 3 new tools
- CLI commands: 28→36 (8 new)
- OpenCode tools: 7→10 (3 new)
- Tests: 385→456 (71 new)

## 0.6.0

- Phase 2: Semantic repair, legacy ingestion, enhanced retrieval (12 epics, F6 dropped).

## 0.5.0

- Phase 1: Contract-first memory model with source coverage and dispatch advisory (9 epics).

## 0.1.0

- TypeScript CLI: init, ls, show, related, context, validate.
- Zod frontmatter schema.
- Validation invariants for current/proposed/historical/rationale safety.
- OpenCode skills, commands, agents and custom tools scaffold.
- Vitest coverage for scaffold validation, policy errors, broken relations, context pack and CLI commands.
