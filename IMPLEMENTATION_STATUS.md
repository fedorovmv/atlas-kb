# Implementation Status

**Last updated:** 2026-07-11
**Branch:** v/kb-openspec
**Tests:** 115/115 green
**Base:** 40 tests → 115 tests (+75)

## Session summary

12 коммитов за сессию. Закрыты все v0.2+v0.3+v0.4 roadmap items (кроме external integrations и OpenCode TUI).

### Commits (chronological)

| # | Commit | Feature | Tests |
|---|--------|---------|-------|
| 1 | 407251a | reconcile --fix mode — safe memory patches, stale proposal detection | 49 |
| 2 | 493826b | claim storage in card frontmatter + re-check при reconcile | 59 |
| 3 | 917deda | cross-document comparison — spec relations, supersedes, conflicts | 73 |
| 4 | 51f9d2c | evidence-gated code_confirmed — validate + updateCard enforcement | 83 |
| 5 | 13b60bc | claim deduplication + canonical form | 95 |
| 6 | 7820137 | deep design rationale extraction (§4.6) | 102 |
| 7 | fd6fab6 | OpenCode memory-guard plugin — lifecycle hooks, auto-context injection | 102 |
| 8 | c0143e7 | claim → module/scenario/decision auto-linking (§4.2) | 110 |
| 9 | 4f1ad1d | content quality enforcement — evidence format + rubric + anti-patterns | 115 |
| 10 | 737975e | memory-analyst agent (deepseek-v4-flash) for spec analysis | 115 |
| 11 | 1508045 | README rewrite — full project description | 115 |
| 12 | dfcb6fa | semantic code evidence — LLM verifies code implements spec intent | 115 |

## LIMITATIONS status

### §4.1 Глубокий LLM-assisted ingest-spec — ✅ 7/9 реализовано
- ✅ classifySpecActuality
- ✅ extractClaims (headings + bullets + paragraphs + code refs + rejected alternatives)
- ✅ rationale extraction (CLI: headings; LLM: memory-analyst deep)
- ✅ claims → memory (CLI: keyword + canonical dedup; LLM: semantic matching)
- ✅ checkEvidence (CLI: keyword; LLM: memory-coder symbol + semantic verification)
- ✅ proposal/historical/conflict/decision card creation
- ✅ validate rejects spec_only + current_behavior
- ❌ PR/Jira/commit links (v0.5+ external integration)
- ❌ semantic "does code implement spec intent" — ✅ LLM (memory-coder semantic verification)

### §4.2 Claim model — ✅ полностью (кроме semantic dedup = LLM)
- ✅ ClaimSchema / EvidenceSchema / StoredClaimSchema
- ✅ extractClaims, checkEvidence, classifySpecActuality
- ✅ claims[] in frontmatter (StoredClaim + embedded evidence + last_checked)
- ✅ reconcile re-check claims, --fix updates stored evidence
- ✅ deduplication (canonical form: lowercase, strip punctuation, stopwords)
- ✅ claim → module/scenario/decision auto-linking
- ✅ cross-card duplicate detection
- ❌ semantic dedup ("MUST filter" = "shall filter") — LLM memory-analyst (advisory)

### §4.3 Code evidence check — ✅ CLI keyword + LLM semantic
- ✅ checkEvidence keyword match (CLI)
- ✅ LLM semantic verification (memory-coder: reads function body, behavior vs claim intent)
- ✅ conflicts_with_code (LLM: symbol exists but behavior contradicts → ## Conflicts)
- ✅ partial implementation (LLM: function implements subset)
- ❌ CLI-side AST symbol analysis (by design — LLM does semantic)

### §4.4 Spec actuality — ✅ partial (CLI + LLM)
- ✅ classifySpecActuality 6 статусов
- ✅ path markers, content signals, evidence count, conflict detection
- ✅ LLM semantic conflict detection
- ✅ LLM partial implementation detection
- ❌ PR/Jira/commit links (v0.5+)

### §4.5 Cross-document comparison — ✅ partially implemented
- ✅ Jaccard topic overlap (≥0.3 threshold)
- ✅ supersedes/superseded_by (deprecated → proposal + "replaces" keyword)
- ✅ conflicts_with (both current/accepted same topic)
- ✅ related_specs (topic overlap)
- ✅ ingestSpec populates relation fields + conflicts.md append
- ✅ reconcile broken relations detection
- ❌ semantic conflict detection (LLM v0.4+ memory-analyst advisory)
- ❌ topic graph export (optional, not planned)

### §4.6 Design rationale extraction — ✅ partially implemented
- ✅ extractClaims: Problem/Constraints/Consequences/Trade-offs/Non-goals → design_rationale
- ✅ paragraph extraction for rationale sections
- ✅ rejected alternatives (### subheading + Status: rejected + Reason:)
- ✅ bootstrap extractDecisions fixed (topics, not signals)
- ✅ ingestSpec creates decision cards (## Problem + ## Decision + ## Rationale)
- ✅ LLM memory-analyst: deep rationale extraction, decision card enrichment
- ❌ explicit vs inferred distinction (LLM judgment — memory-analyst marks inferred)
- ❌ decision card update on new spec (v0.4+)

### §4.7 Reconcile — ✅ выполнен
- ✅ stale refs, weak current claims, realizable proposals, orphan modules
- ✅ stale proposal detection (90 days, configurable)
- ✅ changed claim evidence re-check
- ✅ broken relations, broken claim links, duplicate claims
- ✅ --fix mode (idempotent patches)

### §4.8 Model routing — ✅ config + 4 agents
- ✅ model-routing.yaml: extractor/analyst/coder/reviewer
- ✅ 4 OpenCode agent definitions
- ❌ CLI не LLM orchestrator (by design — OpenCode dispatches)

### §4.9 OpenCode plugin integration — ✅ partially implemented
- ✅ thin tools (context, validate, related, discover, bootstrap, updateCard)
- ✅ memory-guard plugin: lifecycle hooks (chat.message auto-context, tool.execute.before/after)
- ✅ evidence-gated enforcement (validate ERROR + updateCard THROW)
- ✅ AGENTS.md advisory instructions
- ✅ content quality rubric (agent instructions: checklist + anti-patterns + examples)
- ❌ interactive memory diff review (OpenCode TUI)
- ❌ UI navigation (OpenCode TUI)

### §4.10 PDF/DOCX — excluded (всё в markdown)
### §4.11 Graph/RAG — not planned (source of truth = Markdown)

## 4 агента + модели

| Агент | Модель | Назначение |
|-------|-------|-----------|
| memory-extractor | qwen-3.6-27b | Читает код, заполняет module/scenario cards |
| memory-analyst | deepseek-v4-flash | Читает спеки, rationale extraction, semantic claim matching, decision cards |
| memory-coder | qwen-coder-next | Верифицирует evidence: symbol + semantic verification (behavior vs claim intent) |
| memory-reviewer | qwen-thinking-large | Quality gate: rubric scoring, re-read verification, promotes to current |

## Roadmap status

### v0.2 — ✅ выполнен
- ✅ claim schema + extraction + storage
- ✅ spec actuality classification
- ✅ evidence status model
- ✅ proposal/historical/conflict/decision generation
- ✅ ingest-spec CLI command
- ✅ LLM-assisted rationale extraction (memory-analyst)
- ✅ semantic claim matching (memory-analyst)
- ✅ claim storage + re-check
- ✅ cross-document comparison

### v0.3 — ✅ выполнен
- ✅ stale proposal detection
- ✅ automatic conflict/open-question update
- ✅ safe memory patch generation
- ✅ --fix mode

### v0.4 — ✅ partially выполнен
- ✅ plugin lifecycle (memory-guard plugin)
- ✅ automatic pre-task memory context injection (chat.message hook)
- ✅ enforcement (evidence-gated validate + updateCard + plugin advisory)
- ✅ semantic code evidence (LLM memory-coder)
- ❌ interactive review memory diff (OpenCode TUI)
- ❌ optional graph export (not planned)

### v0.5 — not started
- ❌ Jira/Confluence export ingestion
- ❌ richer contract/proto/OpenAPI analysis
- ❌ PDF/DOCX — excluded (всё в markdown)

## What remains (future work)

| # | What | Type | Effort | Depends on |
|---|------|------|--------|-----------|
| 1 | PR/Jira/commit integration | external integration | medium | Jira API / git log parsing |
| 2 | Interactive memory diff review | OpenCode TUI | large | OpenCode UI API |
| 3 | UI navigation по memory bank | OpenCode TUI | large | OpenCode UI API |
| 4 | Optional graph export | CLI | small | пожеланию |
| 5 | Decision card update on new spec | CLI+LLM | medium | reconcile extension |

Items 2-3 — OpenCode platform work, не ts-kb-flow. Item 1 — external API integration. Item 4 — optional. Item 5 — possible future enhancement.

## Key files created this session

```
src/core/reconcileFix.ts          — applyReconcileFixes (idempotent patches)
src/core/specRelations.ts         — detectSpecRelations (Jaccard, supersedes, conflicts)
src/core/claimDedup.ts            — canonicalClaimText, dedupClaims, findCrossCardDuplicates
src/core/claimLinking.ts          — linkClaimsToCards (auto-link claims to cards)
src/core/evidenceSection.ts       — hasEvidenceSection, hasQualityEvidenceSection
test/reconcileFix.test.ts         — 5 tests
test/specRelations.test.ts        — 8 tests
test/claimDedup.test.ts           — 9 tests
test/claimLinking.test.ts         — 6 tests
test/frontmatter.test.ts          — 3 tests
test/update.test.ts               — 6 tests
docs/plans/                       — 12 brief + plan files
docs/reviews/                     — 2 review feedback ledgers
```

## Key files modified this session

```
src/core/reconcile.ts             — ReconcileReport extended (staleProposals, changedClaimEvidence, brokenRelations, brokenClaimLinks, duplicateClaims)
src/core/validate.ts              — evidence format enforcement (hasQualityEvidenceSection)
src/core/updateMemory.ts          — write-time guard (code_confirmed without evidence → throw)
src/core/bootstrapMemory.ts       — extractDecisions fix, placeholder quality hints, evidence sections
src/core/specClassification.ts    — expanded rationale detection, paragraph extraction, rejected alternatives
src/commands/ingestSpec.ts        — claims storage, dedup, linking, cross-spec relations, decision cards
src/commands/reconcile.ts         — --fix flag, output sections
src/schemas/claim.ts              — StoredClaimSchema
src/schemas/frontmatter.ts        — claims[] field
src/scaffold/templates.ts         — 4 agents (extractor/analyst/coder/reviewer), memory-guard plugin, AGENTS.md, quality rubrics
src/cli.ts                        — --fix flag
README.md                         — full rewrite
docs/LIMITATIONS.md               — all sections updated
```