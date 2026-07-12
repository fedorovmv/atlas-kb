# Phase 4 Brief: migrate-from-v3 CLI command

> Profile: balanced | Spec: GAP_CLOSURE_SPEC §6 | Phase 3: COMPLETE (455 tests, v0.7.0)
> Target: v0.8.0 | Stack: TypeScript 5.9.2 (strict), Node ≥20 ESM, Zod 3.25, Vitest 3.2
> Status: ✅ COMPLETE | Tests: 455→547 (92 new) | Council: APPROVE (balanced-plan R2, balanced-code R3)

## Goal

Add `repo-memory migrate-from-v3 <v3-dir>` command that migrates a v3 `knowledge/memory/` memory bank into ts-kb-flow `.ai/memory/` format, synthesizing all required frontmatter fields and applying structural transforms.

## Scope

1 epic: **migrate-from-v3**

- CLI command `repo-memory migrate-from-v3 <v3-dir>` with 8 options
- v3 card ingestion with frontmatter synthesis (4 required → 11+ required fields)
- entity_type mapping (14 v3 types → 20 ts-kb-flow types, index variants collapse to `readme`)
- Structural transforms: `related_cards`→`related_*`, `owned_paths`→`code_refs`, `scope`→`product_areas`
- `source-coverage.json` direct copy (schemas identical)
- Optional: `--preserve-manifest`, `--include-docs`
- Safety: skip-existing default, `--force`, `--dry-run`, staging dir, atomic writes, post-migration `validateMemory()`

## Non-goals

- `knowledge/docs/` migration by default (only with `--include-docs`)
- `knowledge/drafts/` migration (not included, ever)
- Automatic rollback (source preserved, but no tooling)
- Claims extraction from v3 evidence sections (`<!-- TODO: Extract claims -->` comment only)
- Interactive mode (CLI flags only)
- GUI or web tooling

## Constraints

- TypeScript strict mode, ESM (`.js` extensions in imports)
- Zod for all new schemas
- Atomic writes (temp + rename) for all file operations
- Existing commands must not break (additive changes only)
- Staging under `.ai/memory-build/v3-migration/`
- Every new function gets unit tests
- Every new schema validated with Zod
- CLI integration test required in `test/cli.test.ts`

## Acceptance criteria

- [ ] CLI command `migrate-from-v3 <v3-dir>` registered and discoverable via `--help`
- [ ] v3 cards migrated to ts-kb-flow cards with ALL 11+ required frontmatter fields synthesized
- [ ] entity_type mapping: 14 v3 types → 20 ts-kb-flow types (4 index variants collapse to `readme`)
- [ ] Structural transforms: `related_cards`→`related_*`, `owned_paths`→`code_refs`, `scope`→`product_areas`
- [ ] `source-coverage.json` migrated with identical schema
- [ ] Safety flags: `--force`, `--dry-run`, `--json`; skip-existing is default
- [ ] Staging directory `.ai/memory-build/v3-migration/` with plan, migrated, skipped, errors, log
- [ ] Post-migration `validateMemory()` runs automatically; migration fails if validation errors
- [ ] Tests: CLI integration + core unit tests + edge cases (missing frontmatter, unknown type, slug collision, malformed YAML)

## Dependencies (within Phase 4)

```
Task 1 (schemas + synthesis) ──→ Task 3 (pipeline)
Task 2 (path mapping + transforms) ──→ Task 3 (pipeline)
Task 2b (docs migration, optional) ──→ Task 3 (pipeline)
Task 3 (pipeline) ──→ Task 4 (CLI) ──→ Task 5 (CHANGELOG + spec)
```

Tasks 1, 2, and 2b can run in parallel. Task 5 is trivial documentation.

## Dependencies (external)

None — Phase 3 is complete.
