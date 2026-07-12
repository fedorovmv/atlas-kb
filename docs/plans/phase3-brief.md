# Phase 3 Brief: Workflow orchestration, git hooks, CI, OpenSpec

> Profile: balanced | Spec: GAP_CLOSURE_SPEC.md §3 Domains G, H | Phase 2: COMPLETE (385 tests, v0.6.0)
> Target: v0.7.0 | Stack: TypeScript 5.9.2 (strict), Node ≥20 ESM, Zod 3.25, Vitest 3.2

## Goal

Add adaptive workflow routing (DIRECT/PLAN/FULL), session isolation tracking, model routing profiles, git hooks, CI integration, and optional OpenSpec integration. Plus integration debt from Phase 2 (OpenCode tools template).

## Scope

7 epics across 2 domains:
- **G (Workflow orchestration)**: G1 adaptive workflow modes (DIRECT/PLAN/FULL), G2 session isolation, G3 route command, G4 model routing profiles
- **H (Integration & automation)**: H1 git hooks, H2 CI integration, H3 OpenSpec (optional)

Plus integration debt:
- OpenCode tools template update (legacyIngest, compact, artifactSearch — 3 tools not yet in `tools/memory.ts`)

## Non-goals

- C2 (specialist findings JSONL) — permanently deferred
- C3 (builder input pack) — permanently deferred
- F6 (SQLite FTS5) — permanently dropped
- Vector embeddings / RAG, external DB, HTTP API, MCP server — out of scope
- `migrate-from-v3` command — Phase 3 final task
- OPS/GOTCHAS/TESTING/TASK_ROUTING scaffold cards — only if G/H epics need them

## Constraints

- TypeScript strict mode, ESM (`.js` extensions in imports)
- CLI never calls LLM directly
- Atomic writes (temp + rename)
- Existing commands must not break (additive changes only)
- Zod for all new schemas
- H3 (OpenSpec) is optional — graceful degradation if `@fission-ai/openspec` not installed
- Git hooks (H1) must be non-blocking (post-checkout/post-merge) or configurable (pre-commit/pre-push)

## Acceptance criteria

- G1: DIRECT (1 component, ≤8 files), PLAN (≤2 components), FULL (trigger risks). Route reasons explain choice.
- G2: Session tracking with lane keys, duplicate detection, continuation validation
- G3: `route` CLI command, route manifest in `.ai/memory-build/latest/route-manifest.json`
- G4: 3 profiles (quality/balanced/economy), active profile switching, CLI `profile` command
- H1: pre-commit (validate), pre-push (validate --strict-warnings), post-checkout/post-merge (rebuild index)
- H2: `.github/workflows/memory-bank.yml` template, `init --install-ci`
- H3: 4 openspec commands (new/status/check/archive) if openspec installed, graceful message if not
- Integration: OpenCode tools template updated with legacyIngest, compact, artifactSearch (7→10 tools)

## Dependencies (within Phase 3)

```
G1 ──→ G3
G2 (independent)
G4 (independent)
H1 ──→ (needs C4, complete)
H2 ──→ (needs C4, complete)
H3 (independent, optional)
Integration debt (independent)
```

G1, G2, G4, H1, H2, H3, and integration debt can all start in parallel (wave 1). G3 depends on G1.