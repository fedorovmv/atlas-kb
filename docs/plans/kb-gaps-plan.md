# KB Gaps Implementation Plan (v2 — post-council)

Revised after balanced-plan Council (REVISE → patches P1-P11 applied). See docs/reviews/kb-gaps-review-feedback.md.

## CLI conventions (applies to Tasks 6-9)

All new CLI commands follow existing commander conventions:
- Global option `--root <path>` (inherited from program, default cwd)
- Common options where applicable: `--json` (JSON output), `--dry-run` (preview, no write), `--force` (overwrite)
- Exit code 0 on success, 1 on error (matches existing commands)
- Memory root derived from `--memory-root <path>` option where relevant (default `.ai/memory`)
- Read-only commands (`discover`, `reconcile`, `context`, `validate`, `ls`, `show`, `related`) never write
- Write commands (`bootstrap`, `ingest-spec`) support `--dry-run` and refuse overwrite without `--force`
- Read-only report commands (`reconcile`) exit 0 even when findings exist — findings are data, not errors. Use `--strict` (future v0.2) to exit 1 on findings.
- Test strategy: command wrappers for Tasks 6-7 are thin (call core function directly, no wrapper-level logic) → CLI test covers them. Tasks 8-9 contain orchestration logic → unit + CLI test.

## Dependency graph

```
Phase 0 — Fixture
  0. synapse-mini-fixture [independent]

Phase A — Foundation (all depend on 0)
  1. discovery-schema-core
  2. context-pack-enhancement [independent of 1, 3]
  3. validate-spec-only-current [independent of 1, 2]

Phase B — Pipelines (depend on Phase A)
  4. bootstrap-core [depends on 1]
  5. spec-classification-claim [depends on 1]
  (4, 5 independent — can parallelize)

Phase C — Commands (depend on Phase B)
  6. discover-command [depends on 1]
  7. bootstrap-command [depends on 4]
  8. ingest-spec-command [depends on 5]
  9. reconcile-command [depends on 1, 5]
  (6-9 parallelize once core deps met)

Phase D — OpenCode + Integration
  10. opencode-bootstrap-artifacts [independent — parallelize with C]
  12. integration-tests [depends on all prior]

Phase E — Final
  13. final-exports-check [depends on all]
```

## Phase 0 — Fixture

### implementation/0-synapse-mini-fixture

**Outcome:** Complete `examples/synapse-mini` fixture by adding missing files (docs/, specs/, examples/demo-agent/) and restructuring test path to match design §12, plus add `loadSynapseMini()` helper.

**Current state (verified):** fixture partially exists with:
- `internal/registry/access_filter.go` ✓
- `internal/mcp/gateway.go` ✓
- `pkg/agentcard/card.go` (extra, keep)
- `tests/agent-registry/access_filter_test.go` (WRONG location per design §12 — should be `internal/registry/access_filter_test.go`)
- `.ai/memory/` + `.opencode/` scaffold already present (from prior init run — leave as bootstrap/validate test data)
- MISSING: `docs/agent-registry.md`, `specs/2027-agent-tool-registry.md`, `specs/legacy/2025-agent-routing.md`, `examples/demo-agent/main.go`

**Likely files:**
- `examples/synapse-mini/internal/registry/access_filter_test.go` (ADD — relocate from tests/agent-registry/)
- `examples/synapse-mini/docs/agent-registry.md` (ADD)
- `examples/synapse-mini/specs/2027-agent-tool-registry.md` (ADD)
- `examples/synapse-mini/specs/legacy/2025-agent-routing.md` (ADD)
- `examples/synapse-mini/examples/demo-agent/main.go` (ADD)
- `examples/synapse-mini/tests/agent-registry/access_filter_test.go` (REMOVE — relocated)
- `test/helpers.ts` (add `loadSynapseMini()` helper)

**Implementation steps:**
1. Relocate `tests/agent-registry/access_filter_test.go` → `internal/registry/access_filter_test.go` (co-locate test with code per design §12). Delete old path.
2. Add `docs/agent-registry.md`: markdown describing the agent registry module (headings: Overview, Responsibilities, Flows).
3. Add `specs/2027-agent-tool-registry.md`: current-style spec with `accepted`/`implemented` markers, claims about filtering by service identity, references to `internal/registry/access_filter.go`.
4. Add `specs/legacy/2025-agent-routing.md`: legacy spec under `specs/legacy/` with `deprecated` marker, old routing ideas.
5. Add `examples/demo-agent/main.go`: minimal demo (NOT production evidence).
6. Add `loadSynapseMini()` to `test/helpers.ts`: returns absolute root path to `examples/synapse-mini`. Does NOT run init (fixture already has scaffold).
7. Keep fixture deterministic, portable (posix paths).

**Tests / verification:**
- All 8 design-§12 files exist at expected paths.
- `loadSynapseMini()` returns valid absolute path.
- Old `tests/agent-registry/` path removed.

**Completion evidence:**
- Fixture directory complete and committed.
- Helper importable from tests.

References: design §12. Compat: relocates one test file (delete old + add new); adds new files; leaves existing .ai/memory scaffold as-is. Rollback: git restore fixture.

---

## Phase A — Foundation

### implementation/1-discovery-schema-core

**Outcome:** Add project discovery primitives: file inventory, heuristic classification, topic extraction, candidate module detection.

**Likely files:**
- `src/schemas/discovery.ts`
- `src/core/discoverProject.ts`
- `src/index.ts`
- `test/discovery.test.ts`

**Implementation steps:**
1. `src/schemas/discovery.ts`: zod schemas for `FileRecord` (path, kind, language, basename, dirname, sizeBytes, mtime?, signals[], topics[]), `CandidateModule` (id, title, confidence, topics, codeFiles[], testFiles[], docFiles[], specFiles[], demoFiles[], signals[]), `DiscoveryReport` (root, files[], candidateModules[]).
2. `src/core/discoverProject.ts`: `discoverProject(options)` using fast-glob with ignore `**/node_modules/**`, `**/dist/**`, `**/.git/**`, `**/.ai/memory/**`.
3. Path normalization via `toPosixPath` (reuse `src/core/paths.ts`).
4. Heuristic classification by:
   - path segments: `test`, `tests`, `spec`, `specs`, `docs`, `demo`, `example`, `examples`, `legacy`, `archive`, `deprecated`, `testdata`, `internal`, `pkg`, `cmd`
   - extensions: `.go`, `.ts`, `.js`, `.py`, `.java`, `.md`, `.yaml`, `.yml`, `.proto`, `.json`, `.openapi.yaml`
   - filename tokens: `test_`, `_test`, `.test`, `spec_`, `_spec`
5. Topic extraction from: path segments (excluding common dirs), markdown headings (H1/H2), package/module names from first-line comments, repeated domain terms. Deterministic only — no LLM.
6. Candidate module grouping by: path prefixes (e.g., `internal/registry`), shared topics, doc/spec/code/test co-location. Confidence: high (multiple code+test files sharing prefix), medium (single code+test), low (only code or only doc).
7. Export `discoverProject` + types from `src/index.ts`.

**Sub-deliverables (concrete):**
- `FileRecord.kind`: `'code' | 'test' | 'doc' | 'spec' | 'config' | 'contract' | 'demo' | 'example' | 'legacy' | 'unknown'`
- `FileRecord.signals[]`: human-readable classification reasons
- `CandidateModule.id`: kebab-case derived from path prefix or topic
- `DiscoveryReport` is zod-validated

**Tests-first / verification (unit, this task):**
- Test on synapse-mini fixture: assert file count (8 files), assert `access_filter.go` kind=code, `access_filter_test.go` kind=test, `docs/agent-registry.md` kind=doc, `specs/legacy/2025-*.md` kind=legacy, `examples/demo-agent/main.go` kind=demo.
- Assert candidate module `agent-tool-registry` or `registry` exists with code+test+doc files.
- Assert demo module is NOT classified as production evidence (kind=demo, not code).
- Negative: empty dir returns empty report, no crash.

**Completion evidence:**
- `test/discovery.test.ts` passes.
- `discoverProject` returns zod-validated `DiscoveryReport`.

References: REQUIREMENTS §8, design §5. Compat: additive, no rollback.

---

### implementation/2-context-pack-enhancement

**Outcome:** Context packs include conflicts/open-questions, per-card `usage_policy`, and config-driven source priority from existing `source-priority.yaml` template.

**Likely files:**
- `src/schemas/sourcePriority.ts` (new — zod schema for existing yaml format)
- `src/core/context.ts`
- `src/index.ts`
- `test/context-related.test.ts`

**Implementation steps:**
1. `src/schemas/sourcePriority.ts`: zod schema matching existing template format at `src/scaffold/templates.ts:544-561`: `{ priority: string[], rules: string[] }`.
2. Add `loadSourcePriority(options)` to load+validate `.ai/memory-tool/config/source-priority.yaml` (note: template path is `.ai/memory-tool/config/`, NOT `.ai/memory/config/` — verify against scaffold). If absent, use default priority order from REQUIREMENTS §4.
3. `buildMemoryContext`:
   - Load source priority config (best-effort; default if missing).
   - Render source priority section from config (data-driven, not hardcoded text).
   - Include per-card `usage_policy` block in compact excerpt rendering (can_answer_current_behavior, can_generate_code_from, can_use_as_rationale, can_use_as_example, requires_code_check_before_change, requires_warning).
   - Load `.ai/memory/reconciliation/conflicts.md` and `.ai/memory/reconciliation/open-questions.md` (explicit paths under memory root); include excerpts when non-empty.
   - Aggregate per-card `conflicts_with` ids and surface in context.
4. Preserve existing behavior when config/reconciliation absent (graceful fallback).

**Tests-first / verification (unit, this task):**
- Existing context tests still pass (regression).
- New test: project with source-priority.yaml → context markdown contains configured priority order.
- New test: project with conflicts.md content → context includes conflicts section.
- New test: context excerpt includes usage_policy fields.
- Negative: malformed source-priority.yaml → falls back to default, no crash.

**Completion evidence:**
- `test/context-related.test.ts` new cases pass.
- Existing cases pass.

References: REQUIREMENTS §4, §6; design §5. Compat: context output format changes — additive sections, existing consumers still get prior sections. Rollback: revert context.ts. Existing memory files unaffected.

---

### implementation/3-validate-spec-only-current-behavior

**Outcome:** Validation rejects `evidence_level: spec_only` + `knowledge_types: [current_behavior]` unconditionally (v0.1). Defer explicit-review override to v0.2.

**Likely files:**
- `src/core/validate.ts`
- `test/validate.test.ts`

**Implementation steps:**
1. Add invariant in `validateMemory`: if `evidence_level === 'spec_only'` AND `knowledge_types.includes('current_behavior')` → error `${relativePath}: spec_only evidence cannot claim current_behavior without code/test/contract evidence`.
2. No override mechanism in v0.1 (per Council F3). v0.2 may add `review_override: true` field.
3. Place check after existing `current` status checks (near line 79-85).

**Tests-first / verification (unit, this task):**
- New test case: fixture card with spec_only + current_behavior → validate returns error containing the file path.
- New test case: card with spec_only + proposed_behavior → no error (valid).
- New test case: card with code_confirmed + current_behavior → no error (valid).
- Existing 3 validate tests pass unchanged (regression).

**Completion evidence:**
- `test/validate.test.ts` new cases pass.
- Invariant documented in error message.

References: REQUIREMENTS §7, §13; design §7. Compat: may reject existing memory files that violate — this is intended (spec says these are invalid). Rollback: remove the check. No data migration needed.

---

## Phase B — Pipelines

### implementation/4-bootstrap-core

**Outcome:** Bootstrap generates memory cards (module/scenario/decision/historical/proposal) from real project discovery. Creates `reconciliation/` directory.

**Likely files:**
- `src/core/bootstrapMemory.ts`
- `src/core/discoverProject.ts` (uses)
- `src/scaffold/templates.ts` (may reuse card templates as base)
- `src/index.ts`
- `test/bootstrap.test.ts`

**Implementation steps:**
1. `bootstrapMemory(options)`: run `discoverProject`, generate cards.
2. For each `CandidateModule` with confidence ≥ medium: generate `.ai/memory/modules/<id>.md` with `entity_type: module`, `code_refs`/`test_refs`/`source_refs` from discovered files, preliminary responsibility from signals/topics, `status: current` only if code+test evidence exists else `needs_review`, `review_required: true` for inferred.
3. Scenario cards: derive from spec/doc headings (H1/H2), test names (`Test*`), use-case terms (discovery, invocation, routing, authorization, registration). Only if deterministic signals present.
4. Decision cards: only if explicit rationale sections found (headings: "why", "rationale", "decision", "alternatives", "constraints"). Otherwise → `open-questions.md`.
5. Historical/proposal: classify spec files via path markers (`legacy/`, `archive/`, `deprecated` → historical; `specs/`, `proposals/`, `cr/` without evidence → proposal; spec with strong code/test evidence → partially current; conflicting → conflict+proposal).
6. Create `.ai/memory/reconciliation/conflicts.md` and `.ai/memory/reconciliation/open-questions.md` if absent (reuse scaffold template content).
7. Idempotency: skip existing card files unless `--force`. Never overwrite hand-written cards silently.
8. Return `{ written: string[], skipped: string[], report: DiscoveryReport }`.
9. Export from `src/index.ts`.

**Tests-first / verification (unit, this task):**
- Bootstrap on synapse-mini: assert `modules/registry.md` (or `agent-tool-registry.md`) generated with code_refs to `internal/registry/access_filter.go`, test_refs to `internal/registry/access_filter_test.go`.
- Assert demo (`examples/demo-agent/main.go`) NOT in any module's code_refs (it's demo evidence, not production).
- Assert legacy spec (`specs/legacy/2025-agent-routing.md`) → historical card or historical classification.
- Assert new spec (`specs/2027-agent-tool-registry.md`) → proposal card.
- Assert `reconciliation/` dir created with conflicts.md + open-questions.md.
- Idempotency: second bootstrap run with no `--force` → skipped list non-empty, no duplicates.
- Generated memory passes `validateMemory`.

**Completion evidence:**
- `test/bootstrap.test.ts` passes.
- Generated cards valid.

References: REQUIREMENTS §8; design §6. Compat: additive — writes to `.ai/memory/` only. Rollback: delete generated files. Never overwrites without `--force`.

---

### implementation/5-spec-classification-claim-extraction

**Outcome:** Pure functions for spec actuality classification + claim extraction. No IO orchestration (that's Task 8).

**Likely files:**
- `src/core/specClassification.ts`
- `src/core/claimExtraction.ts`
- `src/schemas/claim.ts` (uses existing)
- `src/schemas/discovery.ts` (uses from Task 1)
- `src/index.ts`
- `test/ingest-spec.test.ts` (unit tests for classify+extract only; command test in Task 8)

**Implementation steps:**
1. `classifySpecActuality(spec: { path, content, mtime? }, discovery: DiscoveryReport, memory: MemoryCard[], evidence: Evidence[]): SpecActuality`:
   - Return one of: `current_confirmed`, `partially_confirmed`, `proposed_unconfirmed`, `historical_context`, `conflicting`, `unknown_needs_review`.
   - Signals: path markers (`legacy`, `archive`, `deprecated`, `draft`, `accepted`, `implemented`, `obsolete`), date/mtime, topic match with active modules, claims confirmed by code/test (from evidence arg), conflict with current memory, explicit wording scan.
2. `extractClaims(specContent: string, specPath: string): Claim[]`:
   - Parse markdown headings/lists/code-references deterministically.
   - Claims from: H2/H3 headings as `current_behavior` candidates; bullet lists with verbs (must/shall/should) → claims; code-reference blocks → `code_evidence` claims; "rationale:"/"why:" sections → `design_rationale`.
   - Assign `id` (claim-001, claim-002...), `type`, `source_path`, `evidence_required: true`.
3. `checkEvidence(claims: Claim[], discovery: DiscoveryReport): Evidence[]`:
   - Match claim text against discovered code file basenames/signals/topics from the `DiscoveryReport` data structure ONLY. Does NOT read file contents from disk — pure function.
   - Status: `confirmed_by_code` if matching code file basename/topic in discovery; `confirmed_by_test` if test file found; `documented_only` if only doc; `not_found` otherwise.
   - No LLM — deterministic heuristic only.
4. Reuse existing `ClaimSchema`/`EvidenceSchema` from `src/schemas/claim.ts`.
5. Export all three functions from `src/index.ts`.

**Tests-first / verification (unit, this task):**
- `classifySpecActuality`: legacy spec path → `historical_context`; new spec under `specs/` with no code evidence → `proposed_unconfirmed`; spec with matching code+test → `current_confirmed` or `partially_confirmed`; conflicting spec → `conflicting`.
- `extractClaims`: parse spec markdown → claims with ids, types, source_path.
- `checkEvidence`: claim matching `access_filter.go` → `confirmed_by_code`; claim with no match → `not_found`.
- Negative: empty spec → empty claims, no crash.

**Completion evidence:**
- `test/ingest-spec.test.ts` unit cases pass.
- Existing `ClaimSchema`/`EvidenceSchema` now consumed.

References: REQUIREMENTS §7, §9; design §7. Compat: pure functions, additive.

---

## Phase C — Commands

### implementation/6-discover-command

**Outcome:** `discover` CLI command wired to `discoverProject`.

**Likely files:**
- `src/commands/discover.ts`
- `src/cli.ts`
- `test/cli.test.ts`

**Implementation steps:**
1. `src/commands/discover.ts`: thin wrapper calling `discoverProject({ root })`.
2. Output: summary (file count by kind, candidate modules list with confidence) + optional `--json` full `DiscoveryReport`.
3. Wire in `src/cli.ts` after `validate` command: `program.command("discover").description(...).option("--json").action(...)`.
4. Read-only command — no writes.

**Tests-first / verification (unit, this task):**
- CLI test: `discover --root <synapse-mini>` → stdout contains candidate module names + file classification counts.
- `--json` → valid JSON with `files` and `candidateModules`.

**Completion evidence:**
- `test/cli.test.ts` discover case passes.

References: REQUIREMENTS §12; design §5. Compat: read-only.

---

### implementation/7-bootstrap-command

**Outcome:** `bootstrap` CLI command wired to `bootstrapMemory`.

**Likely files:**
- `src/commands/bootstrap.ts`
- `src/cli.ts`
- `test/cli.test.ts`

**Implementation steps:**
1. `src/commands/bootstrap.ts`: wrapper calling `bootstrapMemory({ root, force, dryRun })`.
2. Options: `--force` (overwrite), `--dry-run` (preview, no write), `--json` (machine output).
3. Output: written/skipped lists + summary. Exit 0 on success.
4. Wire in `src/cli.ts`.

**Tests-first / verification (unit, this task):**
- CLI test: `bootstrap --root <synapse-mini>` → stdout lists generated module files; `.ai/memory/modules/` populated.
- `--dry-run` → no files written, preview printed.
- `--force` on existing → overwrites.
- Generated memory validates.

**Completion evidence:**
- `test/cli.test.ts` bootstrap case passes.

References: REQUIREMENTS §8; design §5. Compat: `--dry-run` safe. `--force` opt-in. Rollback: delete generated.

---

### implementation/8-ingest-spec-command

**Outcome:** `ingest-spec` CLI command orchestrating spec classification + claim extraction + card creation.

**Likely files:**
- `src/commands/ingestSpec.ts`
- `src/cli.ts`
- `src/core/specClassification.ts` (uses Task 5)
- `src/core/claimExtraction.ts` (uses Task 5)
- `src/core/discoverProject.ts` (uses Task 1)
- `test/ingest-spec.test.ts` (command-level cases; unit cases from Task 5)
- `test/cli.test.ts`

**Implementation steps:**
1. `src/commands/ingestSpec.ts`: accept `--root`, `--memory-root`, `--dry-run`, `--force`, spec path/glob argument.
2. Orchestration: discover project → for each spec: extract claims → check evidence → classify actuality → create card:
   - `historical_context` → `.ai/memory/historical/<id>.md` (entity_type: historical)
   - `proposed_unconfirmed` → `.ai/memory/proposals/<id>.md` (entity_type: proposal)
   - `current_confirmed`/`partially_confirmed` → update existing module card or create proposal with evidence note
    - `conflicting` → append to `.ai/memory/reconciliation/conflicts.md` + proposal
   - `unknown_needs_review` → append to `.ai/memory/reconciliation/open-questions.md`
3. Never set `can_answer_current_behavior: true` on proposal/historical (validate invariant).
4. Output: created/skipped/unknown summary + claim count.
5. Wire in `src/cli.ts`.

**Tests-first / verification (unit + command, this task):**
- CLI test: `ingest-spec --root <synapse-mini> specs/legacy/2025-agent-routing.md` → historical card created.
- CLI test: `ingest-spec --root <synapse-mini> specs/2027-agent-tool-registry.md` → proposal card created.
- Generated cards pass `validateMemory`.
- `--dry-run` → no writes.
- Unknown claims → open-questions.md updated.

**Completion evidence:**
- `test/ingest-spec.test.ts` command cases pass.
- `test/cli.test.ts` ingest-spec case passes.

References: REQUIREMENTS §7, §9; design §7. Compat: `--dry-run` safe. `--force` for overwrite. Rollback: delete generated cards.

---

### implementation/9-reconcile-command

**Outcome:** `reconcile` CLI command reporting stale/mismatched memory. Read-only.

**Likely files:**
- `src/core/reconcile.ts`
- `src/commands/reconcile.ts`
- `src/cli.ts`
- `test/reconcile.test.ts`
- `test/cli.test.ts`

**Implementation steps:**
1. `src/core/reconcile.ts`: `reconcileMemory(options): ReconcileReport`:
   - Load memory cards.
   - Run `discoverProject`.
   - For each card: check `code_refs`/`test_refs` paths exist in discovery (stale ref detection).
   - Find `current` claims with weak evidence (`spec_only`/`inferred`/`unknown`).
   - Find proposals whose claims now match code (could be promoted — report, don't auto-promote).
   - Find modules in discovery with no memory card.
   - Report: `{ staleRefs: string[], weakCurrentClaims: string[], realizableProposals: string[], orphanModules: string[] }`.
2. `src/commands/reconcile.ts`: wrapper, output report (text + `--json`). Read-only, exit 0 always (report, not failure).
3. Wire in `src/cli.ts`.

**Tests-first / verification (unit + command, this task):**
- Fixture: memory card with code_ref to deleted file → `staleRefs` non-empty.
- Fixture: current card with spec_only → `weakCurrentClaims` non-empty.
- Fixture: proposal matching existing code → `realizableProposals` non-empty.
- Fixture: synapse-mini after bootstrap, delete one source file → reconcile reports stale ref.
- CLI test: `reconcile --root <fixture> --json` → valid JSON report.
- Read-only: no memory files modified.

**Completion evidence:**
- `test/reconcile.test.ts` passes.
- `test/cli.test.ts` reconcile case passes.

References: REQUIREMENTS §12; design §4.5. Compat: read-only. No rollback needed.

---

## Phase D — OpenCode + Integration

### implementation/10-opencode-bootstrap-artifacts

**Outcome:** Scaffold includes `memory-bootstrap` skill, `/memory-bootstrap` command, `discover`+`bootstrap` tools in `memory.ts`.

**Likely files:**
- `src/scaffold/templates.ts`
- `test/cli.test.ts` (init test asserts new files)

**Mini-spec for artifacts:**

1. **`.opencode/skills/memory-bootstrap/SKILL.md`**: frontmatter `description: Automated initial memory bank population from project discovery`. Body: rules — run discover → bootstrap, use model routing (extractor for classification, coder for evidence, reviewer for rationale), never assert current without evidence, mark uncertain as needs_review, show summary + diff.

2. **`.opencode/commands/memory-bootstrap.md`**: frontmatter `description: Bootstrap memory bank from project source`. `agent: memory-coder`. Body: "Use memory-bootstrap skill. Run `npm run memory -- bootstrap --root .`. Show summary of generated cards and open questions."

3. **`.opencode/tools/memory.ts`**: extend existing with `discover` and `bootstrap` tool exports (same pattern as `context`/`validate`/`related` — `tool({ name, description, parameters, execute })` wrapping `npm run memory` calls).

**Implementation steps:**
1. Add 3 new `ScaffoldFile` entries to `scaffoldFiles` array in `src/scaffold/templates.ts`.
2. Extend existing `.opencode/tools/memory.ts` template string with `discover` + `bootstrap` tool definitions.
3. Preserve inline-string convention.

**Tests-first / verification (unit, this task):**
- After `init`, assert `.opencode/skills/memory-bootstrap/SKILL.md` exists.
- Assert `.opencode/commands/memory-bootstrap.md` exists.
- Assert `memory.ts` template contains `discover` and `bootstrap` tool names.

**Completion evidence:**
- `test/cli.test.ts` init case asserts new files.

References: REQUIREMENTS §11; design §9-11. Compat: additive scaffold.

---

### implementation/12-integration-tests

**Outcome:** End-to-end integration tests on synapse-mini covering full pipeline.

**Likely files:**
- `test/integration.test.ts`

**Implementation steps:**
1. E2E test: `init` → `discover` → `bootstrap` → `validate` → `context` → `ingest-spec` (both specs) → `validate` → `reconcile` on synapse-mini.
2. Assert: no validate errors at each gate.
3. Assert: context for "agent registry" returns module + decision/proposal/historical.
4. Assert: validate catches dangerous usage policy (regression — existing test still in validate.test.ts).
5. Assert: demo not production evidence (regression from bootstrap test).

**Tests-first / verification:**
- `test/integration.test.ts` passes.

**Completion evidence:**
- Integration test green.

References: REQUIREMENTS §14; design §12. Compat: test-only.

---

## Phase E — Final

### implementation/13-final-exports-check

**Outcome:** Public exports complete; full project check green.

**Likely files:**
- `src/index.ts`
- `src/cli.ts`
- `package.json` (no change expected)

**Implementation steps:**
1. Ensure `src/index.ts` exports: `discoverProject`, `bootstrapMemory`, `classifySpecActuality`, `extractClaims`, `checkEvidence`, `reconcileMemory`, `SourcePrioritySchema`, `DiscoveryReport` types, `ReconcileReport` type, `SpecActuality` type.
2. Ensure `src/cli.ts` wires: `discover`, `bootstrap`, `ingest-spec`, `reconcile`.
3. Run `npm run check` (build + all tests).
4. Verify CLI `--help` lists all 10 commands.

**Verification:**
- `npm run check` exit 0.
- `npm run memory -- --help` lists: init, ls, show, related, context, validate, discover, bootstrap, ingest-spec, reconcile.

**Completion evidence:**
- Build passes.
- All unit + integration tests pass.
- CLI exposes all commands.

References: REQUIREMENTS §8, §11, §12; design §5, §7, §12.