# Phase 2 Implementation Plan: Build pipeline, semantic repair, legacy ingestion, enhanced retrieval

> Brief: `docs/plans/phase2-brief.md` | Spec: `docs/specs/GAP_CLOSURE_SPEC.md` §3 Domains D, E, F
> Base: Phase 1 complete (259 tests, v0.5.0) | Target: v0.6.0

## Execution state

Base commit: Phase 1 commit (v0.5.0)
Final commit: `b263de5` (Phase 2 Round 3 corrections, v0.6.0)
Baseline: 259 tests → 385 tests, build clean.

| Lane key | Epic | Status | Session | Dispatch |
|---|---|---|---|---|
| implementation/D1-boilerplate-detection | D1 | ✅ COMPLETE | (multiple) | FRESH |
| implementation/D2-category-extraction | D2 | ✅ COMPLETE | (direct) | FRESH |
| implementation/D3-post-repair-fixes | D3 | ✅ COMPLETE | (direct) | FRESH |
| implementation/E1-legacy-classification | E1 | ✅ COMPLETE | fix-17 | FRESH |
| implementation/E2-reconciliation-staging | E2 | ✅ COMPLETE | (direct) | FRESH |
| implementation/E3-subject-hash-binding | E3 | ✅ COMPLETE | (direct) | FRESH |
| implementation/E4-legacy-cli-workflow | E4 | ✅ COMPLETE | (direct) | FRESH |
| implementation/F1-hash-freshness | F1 | ✅ COMPLETE | (fixer) | FRESH |
| implementation/F2-compaction | F2 | ✅ COMPLETE | (direct) | FRESH |
| implementation/F3-overview-rendering | F3 | ✅ COMPLETE | (direct) | FRESH |
| implementation/F4-artifact-index-search | F4 | ✅ COMPLETE | fix-18 | FRESH |
| implementation/F5-reference-validation | F5 | ✅ COMPLETE | (direct) | FRESH |
| implementation/F6-sqlite-fts5 | F6 | ❌ DROPPED | — | Oracle rec |
| review-correction/phase2-b1-b3 | REVISE | ✅ COMPLETE | (direct) | FRESH |
| review-correction/phase2-r2-r3 | REVISE | ✅ COMPLETE | (fixers) | FRESH |
| final-council | REVIEW | ✅ APPROVE | cou-5/cou-6 | FRESH |

**Phase 2 COMPLETE. v0.6.0. 385 tests. Council APPROVE (Round 3).**

Execution order (respecting file-write conflicts):
1. D1 + E1 + F1 + F4 + F5 (parallel: 5 independent lanes — but `src/index.ts` and `src/cli.ts` edits must be serialized: assign both files to F1 lane only; D1/E1/F4/F5 export via separate files, F1 adds all exports to index.ts)
   - **Note: E2 (wave 2) depends on D1 (wave 1) for BOILERPLATE_PATTERNS — ensure D1 completes before E2 starts**
2. D2 (depends D1) + E2 (depends E1, **and D1 for stub detection**) + F2 (depends F1) + F3 (depends F1, imports hashing.ts from F1)
3. D3 (depends D2, imports discoverProject) + E3 (depends E2)
4. E4 (depends E1-E3, **soft dependency on F4 for artifact rebuild — skip gracefully if F4 not available**)
5. Integration verification (full test suite, version bump 0.5.0 → 0.6.0)
   - **F6 dropped from Phase 2 per Oracle recommendation**

---

## Task 1: D1 — Semantic repair: boilerplate detection + card-scoped extraction

### Outcome
Detect boilerplate placeholder sections in cards, extract card-scoped sentences from source content maps, fill boilerplate sections with relevant content.

### Files
- New: `src/core/semanticRepair.ts`
- New: `src/schemas/semanticRepair.ts` (types for BoilerplateMatch, ExtractedSentence, RepairResult, CardScope)
- New: `test/semanticRepair.test.ts`
- Modify: `src/index.ts` (exports)

### Implementation steps
1. Create `src/schemas/semanticRepair.ts`:
   - `BoilerplateMatchSchema`: `{ sectionName: string, pattern: string, position: { line, column } }`
   - `ExtractedSentenceSchema`: `{ text: string, score: number, sourcePath: string, category?: string }`
   - `RepairResultSchema`: `{ cardId: string, repaired: boolean, filledSections: string[], quarantined: boolean, reason?: string }`
   - `CardScopeSchema`: `{ includes: string[], excludes: string[], allowPairs: [string,string][] }`
   - Export types

2. Create `src/core/semanticRepair.ts`:
   - `BOILERPLATE_PATTERNS`: 15+ regex patterns for placeholder detection (including Russian: "Needs review", "TBD", "TODO", "Needs review —", "Placeholder", "待定", etc.)
   - `detectBoilerplate(body: string): BoilerplateMatch[]` — scan each `## ` section body for boilerplate patterns
   - `CARD_SCOPES`: Pure derived function, NOT a static map. `computeCardScope(card: MemoryCard): CardScope` — derive `includes` from card.meta.knowledge_types + title tokens (split on hyphens/spaces, lowercase). `excludes` = tokens from non-matching entity types. `allowPairs` = adjacent keyword pairs from card title. Called at repair time per-card. No static map, no scaling problem.
   - `extractCardScopedSentences(card: MemoryCard, contentMaps: SourceContentMap[]): ExtractedSentence[]`:
     - For each content map where `targetCards` includes `card.meta.id`:
       - Parse sentences (split by `.!?`)
       - Score: topic overlap (card name tokens ∩ content map topics) ≥ 8 → +score
       - Category keyword hit → +5
       - Card name in text → +4
       - Verb detection (uses, calls, filters, checks, долж, использ, провер) → +3
       - **CARD_SCOPES scoring**: `scopeScore = includes.matches + allowPairs.matches*3 - excludes.matches`. If `scopeScore < 0` → block inclusion (prevents cross-contamination).
       - Min total score threshold: 6 (topic + category + card name + verb + scope)
       - Length bounds: 35-360 chars
       - Dedup by first 140 chars lowercased
   - `semanticRepairCard(card: MemoryCard, contentMaps: SourceContentMap[]): RepairResult`:
     - Detect boilerplate sections
     - Extract sentences from content maps scoped to card
     - Fill boilerplate sections with extracted content
     - If can't fill → quarantine (mark `quarantined: true`)

3. Export from `src/index.ts`

### Tests
- detectBoilerplate: "Needs review" → match
- detectBoilerplate: Russian pattern → match
- detectBoilerplate: real content → no match
- detectBoilerplate: legitimate short content (30 chars, not boilerplate) → no match (false positive prevention)
- extractCardScopedSentences: topic overlap ≥ 8 → included
- extractCardScopedSentences: below threshold → excluded
- extractCardScopedSentences: length > 360 → excluded
- extractCardScopedSentences: dedup by first 140 chars
- **extractCardScopedSentences: sentence matching excludes list → scopeScore < 0 → blocked (cross-contamination prevention)**
- semanticRepairCard: boilerplate section filled → repaired=true
- semanticRepairCard: no content maps for card → quarantined=true
- **semanticRepairCard: >50% sections boilerplate → quarantined (not single section)**

### Completion evidence
- `npm run build` clean
- `npm test` — all tests pass including new semanticRepair tests

---

## Task 2: D2 — Category-aware extraction

### Outcome
Extract content by categories (mechanics, rationale, alternatives, consequences) and write to appropriate card sections.

### Files
- Modify: `src/core/semanticRepair.ts` (add category extraction + card writers)
- Modify: `src/schemas/semanticRepair.ts` (add category types)
- Modify: `test/semanticRepair.test.ts` (extend)

### Implementation steps
1. Define `CATEGORY_KEYWORDS` in `semanticRepair.ts`:
   ```typescript
   export const CATEGORY_KEYWORDS = {
     decision: ['decision', 'решение', 'chosen', 'выбран', 'selected', 'adopted'],
     mechanics: ['mechanism', 'механизм', 'process', 'процесс', 'pipeline', 'конвейер', 'flow', 'поток'],
     rationale: ['rationale', 'обоснование', 'why', 'почему', 'reason', 'причина', 'constraint', 'ограничение'],
     alternative: ['alternative', 'альтернатива', 'option', 'вариант', 'instead', 'вместо'],
     consequence: ['consequence', 'последствие', 'trade-off', 'компромисс', 'impact', 'влияние'],
     flow: ['sequence', 'последовательность', 'step', 'шаг', 'fallback', 'откат'],
   };
   ```

2. `extractByCategory(sentences: ExtractedSentence[], category: string): ExtractedSentence[]`:
   - Score sentences by category keyword hits
   - Return sentences sorted by score descending

3. Card writers:
   - `writeDecisionCard(card: MemoryCard, extracted: ExtractedSentence[]): string` — fills Context/Problem/Decision/Rationale/Alternatives/Consequences
   - `writeFlowCard(card: MemoryCard, extracted: ExtractedSentence[]): string` — fills Goal/Sequence/Fallback/Rationale
   - Each writer maps categories to sections, inserts best sentences

4. Integrate into `semanticRepairCard` — use category-aware extraction when filling sections

### Tests
- extractByCategory: decision keywords → decision category
- extractByCategory: rationale keywords → rationale category
- writeDecisionCard: fills Context with mechanics, Rationale with rationale
- writeFlowCard: fills Sequence with flow, Fallback with flow

### Completion evidence
- `npm run build && npm test` pass

---

## Task 3: D3 — Post-repair fixes + CLI

### Outcome
5 post-repair fixes + `semantic-repair` CLI command.

### Files
- New: `src/commands/semanticRepair.ts`
- Modify: `src/core/semanticRepair.ts` (add post-repair fixes)
- Modify: `src/cli.ts` (add command)
- Modify: `src/index.ts`
- Modify: `test/semanticRepair.test.ts`
- Modify: `test/cli.test.ts`

### Implementation steps
1. Post-repair functions in `semanticRepair.ts`:
   - `repairLinks(cards: MemoryCard[]): { fixed: number, unfixed: string[] }` — find replacement by basename for broken links
   - `repairModuleTiers(cards: MemoryCard[], discovery: FileRecord[]): { updated: number }` — reclassify unknown runtime_tier
   - `repairArchitectureIndex(cards: MemoryCard[]): { updated: boolean }` — add inter-module-deps.md reference in ARCHITECTURE.md
   - `repairCoverage(coverage: SourceCoverage): { fixed: number }` — fix AGENTS.md disposition, clear historical-only targetCards
   - `rebuildIndexes(cards: MemoryCard[]): { decisions: boolean, flows: boolean }` — rebuild DECISIONS.md and FLOWS.md index tables from child cards

2. `semanticRepairCommand` in `src/commands/semanticRepair.ts`:
   ```typescript
   export async function semanticRepairCommand(options: {
     root?: string;
     buildDir?: string;
     runCheck?: boolean;
     json?: boolean;
   }): Promise<void>;
   ```
   - Load cards via `loadMemoryCards`
   - Load content maps via `buildAllContentMaps` (from B2, needs `discoverProject` first)
   - **Run `discoverProject(options)` to obtain `FileRecord[]`** for `repairModuleTiers` (import from `src/core/discoverProject.js`)
   - Run semanticRepairCard on each card with boilerplate
   - Run 5 post-repair fixes (pass `discovery.files` to `repairModuleTiers`)
   - If `--run-check` → run validateMemory after repair
   - Output summary

3. CLI command in `src/cli.ts`:
   ```typescript
   program.command("semantic-repair")
     .option("--build-dir <dir>", "Build directory")
     .option("--run-check", "Run validate after repair")
     .option("--json", "JSON output")
   ```

### Tests
- repairLinks: broken link with matching basename → fixed
- repairModuleTiers: unknown tier → classified
- repairArchitectureIndex: adds inter-module-deps reference
- repairCoverage: clears historical-only targetCards
- rebuildIndexes: DECISIONS.md updated from child cards
- **rebuildIndexes: preserves custom sections (e.g., "## Overview") in DECISIONS.md — appends child table, doesn't overwrite frontmatter or custom content**
- CLI semantic-repair: --json outputs valid JSON
- CLI semantic-repair: --run-check runs validate

### Completion evidence
- `npm run build && npm test` pass

---

## Task 4: E1 — Legacy doc classification pipeline

### Outcome
8-stage pipeline for classifying and migrating historical documents.

### Files
- New: `src/schemas/legacyIngest.ts`
- New: `src/core/legacyIngest.ts`
- New: `test/legacyIngest.test.ts`
- Modify: `src/index.ts`

### Implementation steps
1. `src/schemas/legacyIngest.ts`:
   - `LegacyClassSchema`: enum `["openspec-requirement", "kb-service", "kb-reference", "kb-decision", "kb-runbook", "kb-gotcha", "draft-contradiction", "history-only", "duplicate", "unknown"]`
   - `LegacyStateSchema`: enum `["unclassified", "needs-evidence", "needs-human", "ready", "rejected"]`
   - `LegacyCandidateSchema`: `{ id, path, classification, state, confidence, rationale, targetPath?, stagedPath?, evidence[], subjectHash? }`
   - `LegacyBatchSchema`: `{ batchName, candidates, createdAt, stats }`

2. `src/core/legacyIngest.ts`:
   - `legacyIngest(options: { root, sources: string[], batch?: string }): Promise<LegacyIngestResult>`:
     - Scan sources → inventory files
     - Heuristic pre-classification (confidence ≥ 0.25):
       - OpenSpec patterns → openspec-requirement
       - Service docs (README, service.md) → kb-service
       - Decision docs (ADR, decision, rationale) → kb-decision
       - Legacy/archive paths → history-only
       - Duplicates (content hash match) → duplicate
       - Low confidence → needs-human
     - Generate candidates with state transitions
     - Save batch to `.ai/memory-build/legacy-batches/<batch>/`

3. `LEGACY_CLASSES` and `LEGACY_STATES` constants

### Tests
- legacyIngest: classifies OpenSpec spec → openspec-requirement
- legacyIngest: classifies service doc → kb-service
- legacyIngest: classifies legacy archive → history-only
- legacyIngest: low confidence → needs-human
- legacyIngest: duplicate content → duplicate
- confidence ≥ 0.25 threshold
- **state transition: unclassified → ready (skipping needs-evidence) → ERROR (illegal transition)**
- **state transition: ready → needs-human (backward) → ERROR**
- **state transition: apply requires state=ready + approved=true**

### Completion evidence
- `npm run build && npm test` pass

---

## Task 5: E2 — Reconciliation and staging

### Outcome
Staged docs with evidence validation and stub detection.

### Files
- Modify: `src/core/legacyIngest.ts` (add staging)
- Modify: `test/legacyIngest.test.ts`

### Implementation steps
1. Staging logic:
   - `stageCandidate(candidate: LegacyCandidate, options): Promise<LegacyCandidate>`:
     - Copy to `.ai/memory-build/legacy-batches/<batch>/staged/<targetPath>`
     - Stub detection: if target exists and is NOT a placeholder → skip (don't overwrite)
     - Default target paths by class:
       - `openspec-requirement` → `openspec/specs/<scope>/<slug>.md`
       - `kb-service` → `.ai/docs/services/<scope>/README.md`
       - `kb-decision` → `.ai/docs/decisions/<scope>-<slug>.md`
       - `draft-contradiction` → `.ai/drafts/legacy/<batch>/<scope>/<slug>.md`

2. Evidence validation:
   - `evidenceValid(candidate: LegacyCandidate): { valid: boolean, missingPaths: string[] }`:
     - Each evidence must have path + supports
     - Path must exist on filesystem
   - Canonical ready items require valid current-repo evidence

### Tests
- stageCandidate: staged path created
- stageCandidate: existing non-stub target → skip
- stageCandidate: existing stub → overwrite
- evidenceValid: valid evidence → true
- evidenceValid: missing path → false

### Completion evidence
- `npm run build && npm test` pass

---

## Task 6: E3 — Subject hash binding

### Outcome
SHA-256 subject hash for binding approval to specific candidate payload.

### Files
- Modify: `src/core/legacyIngest.ts` (add hash + approve/apply)
- Modify: `test/legacyIngest.test.ts`

### Implementation steps
1. `computeSubjectHash(candidate: LegacyCandidate): string`:
   - Build canonical JSON object with EXACT key→field mapping:
     ```typescript
     const hashInput = {
       classification: candidate.classification,
       state: candidate.state,
       rationale: candidate.rationale ?? "",
       target: candidate.targetPath ?? "",
       staged: candidate.stagedPath ?? "",
       paths: [candidate.path, ...candidate.evidence.map(e => e.path)].sort(),
       evidenceSHA256s: candidate.evidence.map(e => sha256(readFileSync(e.path))).sort(),
     };
     ```
   - Stable serialization — sort keys then stringify (NOT `JSON.stringify(obj, replacer)` which does NOT sort):
     ```typescript
     const sortedKeys = Object.keys(hashInput).sort();
     const sorted = sortedKeys.reduce((acc, k) => { acc[k] = hashInput[k]; return acc; }, {} as Record<string, unknown>);
     const canonicalJson = JSON.stringify(sorted);
     ```
   - SHA-256 hex of UTF-8 bytes
   - **Deterministic**: two candidates differing only in field insertion order MUST produce the same hash. Test: construct two objects with same fields in different insertion order, verify hashes match.

2. `approveCandidate(candidate: LegacyCandidate, options): Promise<{ approved: boolean, reason?: string }>`:
   - Check subject hash matches current candidate state
   - If hash mismatch → reject with reason

3. `applyCandidate(candidate: LegacyCandidate, options): Promise<{ applied: boolean, reason?: string }>`:
   - Check subject hash before copying staged → target
   - If no approve → reject
   - If hash changed after approve → reject

### Tests
- computeSubjectHash: deterministic for same candidate
- computeSubjectHash: different for changed candidate
- **computeSubjectHash: two objects with same fields in different insertion order → same hash (determinism invariant)**
- **computeSubjectHash: two different candidates with same classification/state but different evidence → different hashes (collision resistance)**
- approveCandidate: valid → approved
- approveCandidate: hash mismatch → rejected
- applyCandidate: without approve → rejected
- applyCandidate: with approve → applied

### Completion evidence
- `npm run build && npm test` pass

---

## Task 7: E4 — Legacy ingest CLI and workflow

### Outcome
9 CLI commands + 3 OpenCode slash-commands + 1 OpenCode tool + review-pack/finalize core logic.

### Files
- New: `src/commands/legacyIngest.ts`
- Modify: `src/cli.ts` (add 8 commands)
- Modify: `src/scaffold/templates/tools/memory.ts` (add legacyIngest tool)
- New: `src/scaffold/templates/commands/memory-legacy-ingest.md`
- New: `src/scaffold/templates/commands/memory-legacy-review.md`
- New: `src/scaffold/templates/commands/memory-legacy-approve.md`
- Modify: `src/scaffold/templates.ts` (add 3 slash-command templates)
- Modify: `test/cli.test.ts`
- Modify: `test/legacyIngest.test.ts`

### Implementation steps
1. CLI commands:
   - `legacy-ingest <sources...>` — run ingest pipeline
   - `legacy-list` — list candidates in batch
   - `legacy-status` — show batch status
   - `legacy-scaffold` — scaffold staged docs
   - `legacy-check` — validate evidence + stubs
   - `legacy-review-pack` — generate review pack
   - `legacy-approve <id>` — approve candidate
   - `legacy-apply` — apply all approved candidates
   - `legacy-finalize` — finalize batch + rebuild indexes

2. OpenCode slash-commands (template files):
   - `/memory-legacy-ingest` — invoke legacy-ingest
   - `/memory-legacy-review` — invoke legacy-list + legacy-status
   - `/memory-legacy-approve` — invoke legacy-approve

3. OpenCode tool `legacyIngest` in tools/memory.ts

4. Core logic (must be implemented in `src/core/legacyIngest.ts`, not just CLI wiring):
   - `buildReviewPack(options: { root, batch }): Promise<ReviewPackResult>` — generate review pack with all candidates, evidence, staging status for human review. Write to `.ai/memory-build/legacy-batches/<batch>/review-pack.md`.
   - `finalizeBatch(options: { root, batch }): Promise<FinalizeResult>` — validate KB integrity (run validateMemory), rebuild DECISIONS.md/FLOWS.md indexes (reuse `rebuildIndexes` from D3). **Artifact index rebuild is optional** — if `buildArtifactIndex` from F4 is available, call it; if not, skip gracefully (soft dependency, no error). Mark batch as finalized.

5. Stub detection in E2: **Import `BOILERPLATE_PATTERNS` from D1** (`src/core/semanticRepair.ts`) for placeholder regex. If target file exists and content matches boilerplate patterns → it's a stub → safe to overwrite. If content does NOT match → skip (don't overwrite without `--force`). **Explicit dependency: E2 depends on D1 being complete.**

### Tests
- CLI legacy-ingest: creates batch with candidates
- CLI legacy-list: --json outputs valid JSON
- CLI legacy-status: shows state transitions
- CLI legacy-approve: valid id → approved
- CLI legacy-apply: applied candidates → files at target
- CLI legacy-finalize: indexes rebuilt

### Completion evidence
- `npm run build && npm test` pass

---

## Task 8: F1 — Hash-based freshness for context packs

### Outcome
SHA-256 hash-based freshness tracking for context packs.

### Files
- New: `src/core/hashing.ts`
- New: `src/commands/contextCheck.ts`
- Modify: `src/core/types.ts` (extend ContextPack)
- Modify: `src/core/context.ts` (add hashes to pack)
- Modify: `src/cli.ts` (add context-check command)
- Modify: `src/index.ts`
- New: `test/hashing.test.ts`
- Modify: `test/cli.test.ts`

### Implementation steps
1. `src/core/hashing.ts`:
   - `fileHash(path: string): Promise<string>` — SHA-256 of file content
   - `treeHash(paths: string[]): Promise<string>` — SHA-256 of sorted paths + contents
   - `shaBytes(data: Buffer): string`

2. Extend `ContextPack` in `types.ts`:
   ```typescript
   export type ContextPack = {
     // existing fields...
     repositoryHead?: string;
     sourceHashes?: Record<string, string>;
     generatedAt?: string;  // ISO-8601, optional with auto-default
   };
   ```

3. Modify `buildMemoryContext` in `context.ts`:
   - Add `repositoryHead` (from git rev-parse HEAD — gracefully skip if not a git repo)
   - Add `sourceHashes` for all files in pack — **off by default, enable with `--track-freshness` flag** for performance on large repos
   - Add `generatedAt` (auto-default to `new Date().toISOString()` if not set — no breaking change to existing callers)
   - Export from `src/index.ts`: `fileHash`, `treeHash`, `shaBytes`, `checkContextFreshness`, `ContextPack` (extended type)

4. `checkContextFreshness(pack: ContextPack, root: string): Promise<FreshnessResult>`:
   - repositoryHead must match current git HEAD
   - All sourceHashes files must exist and hash must match
   - Return `{ fresh: boolean, staleFiles: string[], reason?: string }`

5. `context-check` CLI command

### Tests
- fileHash: deterministic for same content
- treeHash: deterministic for same set
- checkContextFreshness: matching hashes → fresh
- checkContextFreshness: changed file → stale
- checkContextFreshness: missing file → stale
- **checkContextFreshness: file moved/renamed but content unchanged → fresh (content hash trumps path)**
- **checkContextFreshness: non-git repo (no .git) → graceful skip, no error**
- CLI context-check: --json outputs valid JSON

### Completion evidence
- `npm run build && npm test` pass

---

## Task 9: F2 — Compaction

### Outcome
Bounded compaction.md (12KB max) for compact context.

### Files
- New: `src/core/compaction.ts`
- New: `src/commands/compact.ts`
- Modify: `src/cli.ts`
- Modify: `src/scaffold/templates/tools/memory.ts` (add compact tool)
- Modify: `src/index.ts`
- New: `test/compaction.test.ts`

### Implementation steps
1. `src/core/compaction.ts`:
   - `buildCompaction(options: { root: string, maxChars?: number }): Promise<CompactionResult>`:
     - Default maxChars = 12000, **configurable via `--max-chars` flag**
     - Content: mode, topic, HEAD, route reasons, active lane, approvals, unresolved items, relevant files (top 20), canonical KB (top 8)
     - Truncation priority: relevant files first (bottom), then canonical KB, then unresolved items. Never truncate mode/topic/HEAD.
     - **`--no-truncate` mode**: error instead of truncating (fail-safe for critical contexts)
     - Truncate if exceeds maxChars with marker

2. `compact` CLI command + OpenCode tool

### Tests
- buildCompaction: output ≤ maxChars
- buildCompaction: includes all required sections
- buildCompaction: truncation marker when exceeding
- **buildCompaction: --no-truncate → throws Error when exceeding maxChars**
- **buildCompaction: custom maxChars=5000 → output ≤ 5000**
- CLI compact: --json outputs valid JSON

### Completion evidence
- `npm run build && npm test` pass

---

## Task 10: F3 — Overview rendering

### Outcome
OVERVIEW.md with route reasons, scenario matrix, test obligations, reviews table, session lanes, knowledge impact.

### Files
- New: `src/core/overview.ts`
- New: `src/commands/render.ts`
- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- Import: `src/core/hashing.ts` (from F1 — for source hashes in overview-sources.json)
- New: `test/overview.test.ts`

### Implementation steps
1. `src/core/overview.ts`:
   - `renderOverview(options: { root: string }): Promise<OverviewResult>`:
     - Route reasons (from G3 if available — skip if not)
     - OpenSpec proposals/specs/design (if any)
     - Scenario matrix
     - Test obligations
     - Tasks
     - Verification evidence
     - Reviews table
     - Session lanes (from G2 if available — skip if not)
     - Knowledge impact
   - Write `OVERVIEW.md` + `overview-sources.json` (with source hashes)
   - Empty sections marked "N/A"

2. `render` CLI command

### Tests
- renderOverview: OVERVIEW.md created with all sections
- renderOverview: empty section → "N/A"
- renderOverview: overview-sources.json contains hashes
- CLI render: --json outputs valid JSON

### Completion evidence
- `npm run build && npm test` pass

---

## Task 11: F4 — Artifact index and search

### Outcome
Artifact index + search with scoring (4 points title, 1 point haystack).

### Files
- New: `src/schemas/artifactIndex.ts`
- New: `src/core/artifactIndex.ts`
- New: `src/commands/artifactsSearch.ts`
- Modify: `src/cli.ts`
- Modify: `src/scaffold/templates/tools/memory.ts` (add artifactSearch tool)
- Modify: `src/index.ts`
- New: `test/artifactIndex.test.ts`

### Implementation steps
1. `src/schemas/artifactIndex.ts`:
   - `ArtifactEntrySchema`: `{ path, title, kind, signals[], contentHash }`
   - `ArtifactIndexSchema`: `{ entries: ArtifactEntry[], generatedAt: string }`
   - `ArtifactHitSchema`: `{ entry: ArtifactEntry, score: number }`

2. `src/core/artifactIndex.ts`:
   - `buildArtifactIndex(options: { root: string }): Promise<ArtifactIndex>`:
     - **Phase 2 scope: scan `.ai/memory/` ONLY** (skip `.ai/docs/`, `.ai/drafts/` — deferred to Phase 3)
     - **Skip binary files** — reuse `BINARY_EXTENSIONS` from `src/core/sourceCoverage.ts` (Phase 1)
     - **Skip files > 1MB** (large file guard)
     - For each file: path, title (from frontmatter or H1), kind, signals, content hash
   - `artifactSearch(query: string, index: ArtifactIndex, limit?: number): ArtifactHit[]`:
     - Score: 4 points for term in title, 1 point for term in haystack (title+path+kind+signals)
     - Return top 8 by descending score
   - Save to `.ai/memory-build/latest/artifact-index.json`

3. `artifacts-search` CLI command + OpenCode tool

### Tests
- buildArtifactIndex: scans memory (Phase 2 scope — docs/drafts deferred)
- **buildArtifactIndex: binary file in .ai/memory/ → skipped gracefully**
- **buildArtifactIndex: file > 1MB → skipped**
- artifactSearch: title match → 4 points
- artifactSearch: haystack match → 1 point
- artifactSearch: top 8 returned
- artifactSearch: empty query → empty results
- CLI artifacts-search: --json outputs valid JSON

### Completion evidence
- `npm run build && npm test` pass

---

## Task 12: F5 — Reference study validation

### Outcome
6 required sections for reference cards, source path + tree hash validation.

### Files
- Modify: `src/schemas/frontmatter.ts` (extend RefSchema with optional `treeHash?: z.string()`)
- Modify: `src/core/validate.ts` (add reference validation)
- Modify: `test/validate.test.ts`
- New: `test/referenceValidation.test.ts`

### Implementation steps
1. Extend `RefSchema` in `src/schemas/frontmatter.ts` with optional `treeHash?: z.string()` field. This stores the expected tree hash of the source path. Add valid/invalid test for RefSchema with treeHash.

2. `validateReferenceStudy(card: MemoryCard): { errors: string[], warnings: string[] }`:
   - 6 required sections: "## Behaviors carried over", "## Behaviors intentionally not carried over", "## Invariants and state transitions", "## Failure/retry/cancellation/recovery", "## Compatibility/operational constraints", "## Derived scenarios and tests"
   - No placeholders in any section (reuse `BOILERPLATE_PATTERNS` from D1)
   - Source path (from `source_refs[0].path`) must exist
   - If `source_refs[0].treeHash` is set → compute `treeHash([sourcePath])` (from F1 `src/core/hashing.ts`) and verify match

3. Integrate into `validateMemory` for cards with `entity_type === "reference"`:
   - Existing reference cards WITHOUT `treeHash` in source_refs → **WARNING** (not ERROR), suggesting to run `repo-memory migrate` to auto-fill
   - New reference cards WITH `treeHash` set → full validation (ERROR on mismatch)
   - `migrate` command (Phase 3) auto-fills `treeHash` for all reference cards by computing tree hash of source paths

4. Migration strategy: `treeHash` is optional in RefSchema. Existing cards are grandfathered (warning only). No breaking change to Phase 1 cards.

### Tests
- validateReferenceStudy: all 6 sections → ok
- validateReferenceStudy: missing section → error
- validateReferenceStudy: placeholder → error
- validateReferenceStudy: missing source path → error
- validateReferenceStudy: tree hash mismatch → error
- **validateReferenceStudy: existing reference card without treeHash → WARNING (not ERROR, backward compat)**
- validate integration: reference card without sections → errors in validateMemory
- **validate integration: non-reference cards NOT affected by reference validation**

### Completion evidence
- `npm run build && npm test` pass

---

## Task 13: F6 — SQLite FTS5 search index (DROPPED from Phase 2)

> **Oracle recommendation**: Drop F6 from Phase 2. Lexical scoring (existing `scoreCard` from Phase 1) works for small-medium repos. SQLite adds native dependency complexity, platform-specific failures (ARM/M1), and optional dependency management overhead. If needed later, make it Phase 4.

**Status**: DROPPED. Not implemented in Phase 2.

### Outcome
Optional SQLite FTS5 index for BM25-ranked search with fallback to lexical.

### Files
- New: `src/core/searchIndex.ts`
- New: `src/schemas/searchIndex.ts` (SearchResult type)
- New: `src/commands/index.ts`
- New: `src/commands/search.ts`
- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- New: `test/searchIndex.test.ts`
- Modify: `package.json` (add optional `better-sqlite3` to optionalDependencies)

### Implementation steps
1. `src/schemas/searchIndex.ts`:
   - `SearchResultSchema`: `{ path, title, score, snippet? }` — or reuse `ArtifactHitSchema` from F4 if compatible

2. `src/core/searchIndex.ts`:
   - Check if `better-sqlite3` is available (dynamic import)
   - If available: create FTS5 index
   - If not: fallback to lexical scoring (existing `scoreCard`)
   - `buildSearchIndex(options: { root: string }): Promise<void>`
   - `searchIndex(query: string, options): Promise<SearchResult[]>`

2. `index` + `search` CLI commands

3. Fallback: if SQLite unavailable, `search` uses existing lexical scoring

### Tests
- buildSearchIndex: index created (if SQLite available)
- searchIndex: BM25 results (if SQLite available)
- searchIndex: fallback to lexical if SQLite unavailable
- CLI search: --json outputs valid JSON

### Completion evidence
- `npm run build && npm test` pass
- F6 is optional — tests should pass with or without `better-sqlite3`

---

## Task 14: Integration verification

### Outcome
Full test suite green across D/E/F domains, version bump, CHANGELOG.

### Files
- Modify: `package.json` (version 0.5.0 → 0.6.0)
- New: `CHANGELOG.md` (if not exists) or modify existing

### Implementation steps
1. Run `npm run build` — must pass with zero errors
2. Run `npm test` — all tests must pass (~350+ tests expected)
3. Verify all new CLI commands work: `npm run memory -- semantic-repair --help`, `npm run memory -- legacy-ingest --help`, `npm run memory -- context-check --help`, `npm run memory -- compact --help`, `npm run memory -- render --help`, `npm run memory -- artifacts-search --help`, `npm run memory -- index --help` (if F6), `npm run memory -- search --help` (if F6)
4. Bump version in `package.json` from `0.5.0` to `0.6.0`
5. Update CHANGELOG with Phase 2 changes

### Completion evidence
- `npm run build && npm test` pass
- All CLI commands respond to `--help`
- Version is `0.6.0`

---

## Summary

12 tasks (12 required, F6 dropped) + 1 integration task, 3 domains. Parallel execution across D/E/F domains where possible.

### Scope adjustments (Oracle recommendations applied):
- **F6 (SQLite FTS5) dropped** — lexical scoring sufficient, SQLite adds native dependency complexity
- **F4 simplified** — `.ai/memory/` only in Phase 2 (docs/drafts deferred to Phase 3), binary skip, >1MB skip
- **F2 enhanced** — `--max-chars` configurable, `--no-truncate` fail-safe mode, truncation priority documented
- **F1 hashing optional** — `--track-freshness` flag (off by default for performance), graceful non-git skip
- **F5 migration strategy** — existing reference cards without treeHash → WARNING (not ERROR), grandfathered
- **D1 CARD_SCOPES** — pure derived function (not static map), computes per-card at repair time
- **D3 rebuildIndexes** — preserves custom sections, doesn't overwrite frontmatter
- **E1-E4** — state transition invariants tested, rollback via subject hash binding

### New files (estimated)
- 6 new schemas: semanticRepair, legacyIngest, artifactIndex + (existing extended)
- 9 new core modules: semanticRepair, legacyIngest, hashing, compaction, overview, artifactIndex + commands
- 13 new CLI commands: semantic-repair, legacy-ingest, legacy-list, legacy-status, legacy-scaffold, legacy-check, legacy-review-pack, legacy-approve, legacy-apply, legacy-finalize (9 legacy) + context-check, compact, render, artifacts-search (4 non-legacy) = 13 new required
- 3 new OpenCode tools: legacyIngest, compact, artifactSearch

### Modified files
- `src/cli.ts`, `src/index.ts`, `src/core/types.ts`, `src/core/validate.ts`, `src/core/context.ts`, `src/schemas/frontmatter.ts` (RefSchema +treeHash)
- `src/scaffold/templates/tools/memory.ts`
- `test/cli.test.ts`, `test/validate.test.ts`

### CLI commands: 13 → 26 (13 new required)
### OpenCode tools: 7 → 10 (3 new required)
### Tests: 259 → ~330+