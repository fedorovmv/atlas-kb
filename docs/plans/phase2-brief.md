# Phase 2 Brief: Build pipeline, semantic repair, legacy ingestion, enhanced retrieval

> Profile: balanced | Spec: GAP_CLOSURE_SPEC.md §3 Domains D, E, F | Phase 1: COMPLETE (259 tests, v0.5.0)
> Target: v0.6.0 | Stack: TypeScript 5.9.2 (strict), Node ≥20 ESM, Zod 3.25, Vitest 3.2

## Goal

Extend ts-kb-flow with semantic repair (auto-fill boilerplate card sections from source content), legacy ingestion (8-stage pipeline for historical doc migration), and enhanced context retrieval (hash-based freshness, compaction, artifact search, overview rendering, reference validation).

## Scope

12 epics across 3 domains:
- **D (Semantic repair)**: D1 boilerplate detection + card-scoped extraction, D2 category-aware extraction, D3 post-repair fixes + CLI
- **E (Legacy ingestion)**: E1 classification pipeline, E2 staging + evidence validation, E3 subject hash binding, E4 CLI + workflow
- **F (Context & retrieval)**: F1 hash-based freshness, F2 compaction, F3 overview rendering, F4 artifact index + search, F5 reference study validation, F6 SQLite FTS5 (optional)

## Non-goals

- C2 (specialist findings JSONL) — still deferred, revisit only if D1 needs bounded build context (it doesn't — D1 uses content maps from B2)
- C3 (builder input pack) — still deferred
- G/H domains (workflow routing, git hooks, CI, OpenSpec) — Phase 3
- Vector embeddings, RAG, external DB, HTTP API, MCP server — out of scope
- `migrate-from-v3` command — Phase 3 (after all features ported)

## Constraints

- TypeScript strict mode, ESM (`.js` extensions in imports)
- CLI never calls LLM directly
- Atomic writes (temp + rename)
- Existing commands must not break (additive changes only)
- Zod for all new schemas
- Every new CLI command needs a test in `test/cli.test.ts`
- Every new Zod schema needs valid/invalid test cases
- F6 (SQLite) is optional — must fallback to lexical scoring if `better-sqlite3` unavailable

## Acceptance criteria

- D1: boilerplate sections detected (15+ regex patterns), card-scoped sentences extracted from content maps, cross-contamination prevented via card scopes, unrepairable cards quarantined
- D2: 6 category keyword lists, extractByCategory groups sentences, card writers fill sections correctly
- D3: 5 post-repair fixes (links, module tiers, architecture index, coverage, index rebuild), `semantic-repair` CLI command, `--run-check` flag
- E1: legacy doc classification pipeline, heuristic pre-classification (confidence ≥ 0.25), state transitions (unclassified → needs-evidence → needs-human → ready → apply/reject)
- E2: staging in `.ai/memory-build/legacy-batches/<batch>/staged/`, stub detection, evidence path validation
- E3: SHA-256 subject hash binding, approve/apply check hash before mutation
- E4: 8 CLI commands (legacy-ingest, legacy-list, legacy-status, legacy-scaffold, legacy-check, legacy-review-pack, legacy-approve, legacy-apply, legacy-finalize), 3 OpenCode slash-commands, 1 OpenCode tool
- F1: fileHash, treeHash, context pack freshness check, `context-check` CLI command
- F2: compaction ≤ 12KB, `compact` CLI command, OpenCode tool
- F3: OVERVIEW.md with all sections, `render` CLI command
- F4: artifact index from memory/docs/drafts, search with 4-point title boost, `artifacts-search` CLI command, OpenCode tool
- F5: 6 required sections for reference cards, source path + tree hash validation, integrated into validateMemory
- F6: optional SQLite FTS5 with fallback to lexical, `index` + `search` CLI commands

## Dependencies (within Phase 2)

```
D1 ──→ D2 ──→ D3
E1 ──→ E2 ──→ E3 ──→ E4
F1 ──→ F2
F1 ──→ F3
F4 (independent)
F5 (depends on A2, already complete)
F6 (depends on F4, optional)
```

D, E, F are independent domains — can be parallelized across domains.