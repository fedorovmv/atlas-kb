---
name: atlas-bootstrap
description: Full LLM-assisted memory bank population — deterministic scaffold + agent-driven content enrichment.
---

# Memory Bootstrap Skill

Populate `.ai/memory` from project source, tests, docs, and specs in one workflow. Deterministic CLI creates the skeleton; LLM agents enrich cards with real content from code analysis.

**⚠️ CRITICAL: This skill has TWO phases. You MUST complete BOTH:**
1. **Phase 1**: Run CLI scaffold (creates skeleton cards)
2. **Phase 2**: Dispatch subagents to enrich ALL needs-enrichment cards (fill content, verify evidence, promote to current)

**If you stop after Phase 1 without dispatching subagents — the bootstrap is INCOMPLETE.** Cards will have placeholder content "Требует ревью — ...". You MUST dispatch atlas-extractor, atlas-analyst, atlas-coder, and atlas-reviewer subagents as described in Phase 2 below.

**Do NOT ask the user "Would you like me to proceed?" — just proceed.** The user invoked `/atlas-bootstrap` which means they want the FULL pipeline. Asking is a waste of their time. Dispatch subagents immediately after Phase 1.

## Progress-based stop (LOOP safety)

**THIS IS A LOOP, NOT A LINE.** If `ls --needs-enrichment` returns cards after an iteration, dispatch the next batch. Repeat until empty OR stop condition triggers.

**Stop conditions (ANY triggers STOP + report):**
1. `ls --needs-enrichment` returns `[]` AND `ls --status needs_review` returns `[]` → DONE, report "bootstrap complete".
2. Content hash unchanged for 2 consecutive iterations → STOP, report "bootstrap incomplete — N cards stuck, see reconciliation/open-questions.md".
3. Hard cap: 5 iterations reached → STOP, report remaining as stuck.

**Content hash (per card):** `hash(body + evidence_level + status + claims[].text)`. EXCLUDE `last_reviewed`, `review_required`, `cross_link_attempts` (churn without content progress). Sort `claims` by `id` before hashing (deterministic).

Note: `computeSubjectHash` in `src/core/legacyIngest.ts` exists but is specific to `LegacyCandidate` objects (legacy ingest pipeline) — NOT reusable for memory card content hashing. Use the formula above directly, implemented as a deterministic string hash (e.g., `crypto.createHash('sha256').update(str).digest('hex')`).

After each STEP 2→3→4 iteration, compare hash set against the previous iteration. If 2 iterations with no hash change → STOP.

**Completion gate (MANDATORY before reporting "done"):**
```bash
.ai/atlas/bin/atlas ls --needs-enrichment --json   # must be []
.ai/atlas/bin/atlas ls --status needs_review --json  # must be []
```
If BOTH empty → validate → report "done".
If EITHER non-empty → go back to STEP 2. Do NOT report "done". Do NOT ask the user. Loop.

**Split enrichment flags (after Phase 3):**
- `ls --needs-enrichment-content --json` — placeholders, weak evidence, missing sections
- `ls --needs-enrichment-links --json` — empty cross-links (accept-empty after 2 attempts if ENABLE_CROSS_LINK_TRACKING)
- `ls --needs-enrichment-review --json` — status=needs_review

`ls --needs-enrichment` = union of all 3 (backward compat).

## Workflow

### Phase 1 — Deterministic scaffold (CLI)

Run from project root:

```bash
.ai/atlas/bin/atlas bootstrap --root .
```

This creates skeleton cards: module cards with code_refs/test_refs/source_refs but placeholder content ("Needs review", "Preliminary responsibility"). It also creates `reconciliation/conflicts.md` and `reconciliation/open-questions.md`.

**MANDATORY after scaffold:** Run this command and SAVE the output:

```bash
.ai/atlas/bin/atlas ls --needs-enrichment --json
```

This returns cards that have weak evidence (`inferred`, `spec_only`, `unknown`), `needs_review` status, `review_required: true`, OR placeholder content ("Требует ревью", "Не задокументировано"). The CLI scans card bodies for placeholder patterns.

**If this command returns ANY cards — you MUST proceed to Phase 2** to dispatch subagents. Do NOT ask the user. Do NOT offer options. Do NOT report "bootstrap complete" until this returns `[]`.

**If this command returns `[]` (empty array) — bootstrap is complete, skip Phase 2.**

**⚠️ Do NOT rationalize skipping Phase 2.** Common false excuses:
- "spec_only is expected for proposals" — PARTIALLY TRUE. Proposals with spec_only AND complete sections are terminal (done). But spec_only proposals with placeholder content or missing sections STILL need analyst. Trust `ls --needs-enrichment` — if it returns a card, enrich it; if not, it's done.
- "review_required=true means awaiting human decision" — FALSE. review_required means analyst hasn't filled rationale/alternatives yet. Analyst MUST infer WHY and fill sections before reviewer can promote.
- "inferred evidence is acceptable" — FALSE for decision cards. Decision cards with inferred evidence need analyst to extract real rationale from specs, not leave "Не задокументировано".
- "cards are already enriched" — FALSE if `--needs-enrichment` returns them. The CLI found placeholder text or weak evidence. Trust the CLI, not your assumption.

### Phase 2 — LLM enrichment (agents)

For each `needs_review` card from Phase 1, you (the orchestrating agent) MUST dispatch subagent work using model routing.

**CRITICAL — one card per subagent dispatch.** Never bundle multiple cards into a single subagent task. Each subagent gets exactly one card, reads its source_refs/code_refs, fills content, returns. This keeps context bounded and quality high.

**Concurrency limit — max 5 parallel subagents.** Dispatch in batches of 5. Wait for each batch to complete before starting the next. Subagents are lightweight (one card, bounded context), so 5 parallel is safe.

**Progress tracking — MANDATORY.** After each batch completes, run:
```bash
.ai/atlas/bin/atlas ls --status needs_review --json
```
Count remaining needs_review cards. If >0 cards remain in the current stage, continue dispatching. Do NOT advance to the next stage until the current stage has 0 needs_review cards of that entity_type.

**Completion gate — MANDATORY.** Before reporting "done", run:
```bash
.ai/atlas/bin/atlas ls --status needs_review --json
```
If the result contains ANY cards, the bootstrap is INCOMPLETE. You MUST continue dispatching subagents for remaining cards. Do NOT report "done" until `needs_review` count is 0 (or all remaining cards are explicitly marked as deferred in `reconciliation/open-questions.md` with a reason).

**MUST COMPLETE ALL PHASES.** Do NOT stop after module enrichment. The pipeline has 6 mandatory subagent dispatch stages. Complete ALL before reporting "done":

```
Stage A: module cards      → extractor → coder → reviewer
Stage B: scenario cards    → extractor → coder → reviewer
Stage C: decision/proposal/historical cards → analyst → coder (proposals only, if code_refs present) → reviewer
Stage D: architecture cards → analyst (synthesis) → **auto: reviewer**
Stage E: reference cards → analyst (synthesis from guide docs) → **auto: reviewer**
Stage F: validate + summary
```

**⚠️ MANDATORY: STEP 3 (reviewer) after STEP 2 (enrichment).** Strong-evidence cards (code_confirmed / contract_confirmed / test_confirmed) with complete sections and `status: needs_review` MUST be promoted by atlas-reviewer. Do NOT skip STEP 3 even if `ls --needs-enrichment` returns `[]` — if `ls --status needs_review` returns cards, dispatch reviewer. The orchestrator must run STEP 3 after STEP 2 completes, every iteration.

**Auto-reviewer dispatch (Stages D & E):**
After analyst completes enrichment for a stage, **automatically dispatch atlas-reviewer** for all cards in that stage. Do NOT wait for manual trigger. Reviewer promotes cards from `needs_review` to `current` (if evidence is sufficient) or adds to `open-questions.md` (if content is incomplete).

**Per-stage checkpoint (run after each stage):**
```bash
.ai/atlas/bin/atlas ls --status needs_review --json | jq '[.[] | select(.entity_type=="module")] | length'   # after Stage A
.ai/atlas/bin/atlas ls --status needs_review --json | jq '[.[] | select(.entity_type=="scenario")] | length' # after Stage B
.ai/atlas/bin/atlas ls --status needs_review --json | jq '[.[] | select(.entity_type=="decision" or .entity_type=="proposal" or .entity_type=="historical")] | length' # after Stage C
.ai/atlas/bin/atlas ls --status needs_review --json | jq '[.[] | select(.entity_type=="architecture")] | length' # after Stage D
.ai/atlas/bin/atlas ls --status needs_review --json | jq '[.[] | select(.entity_type=="reference")] | length' # after Stage E
```
If count >0 for the stage's entity types — continue dispatching. Do NOT proceed to next stage until count is 0.

If you stop after Stage A or B without completing Stage C (analyst for decision/proposal/historical), the bootstrap is INCOMPLETE. Decision cards will have placeholder rationale "Требует ревью — какие альтернативы были рассмотрены?" — this is unacceptable.

**Card type routing:**

| entity_type | Agent pipeline | What they do |
|-------------|----------------|--------------|
| module | extractor → coder → reviewer | Read code, fill Responsibility/Behavior, verify symbols |
| scenario | extractor → coder → reviewer | Read source_refs, fill Goal/Flow/Actors, verify against code |
| decision | **analyst** → reviewer | Read spec, extract Rationale/Alternatives/Consequences |
| proposal (with code_refs) | **analyst** → coder → reviewer | Read spec, extract proposed behavior, check partial implementation |
| proposal (no code_refs) | **analyst** → reviewer | Read spec, extract proposed behavior — no code to verify |
| historical | **analyst** → reviewer | Read spec, extract survived decisions, prior approach |

**Coder for proposals ONLY if `code_refs` present in frontmatter.** If a proposal has no `code_refs` (pure spec/ADR), skip coder — go analyst → reviewer directly.

**Note on `heuristic_match` evidence for decision/historical cards:** These card types are spec-based (no code_refs). `evidence_level=heuristic_match` is a CLI keyword-match artifact, not a signal that coder verification is needed. Decision/historical cards with `heuristic_match` are EXCLUDED from `--needs-enrichment-content` gate — they don't need enrichment, they need reviewer promotion (if sections complete).

#### 2a. Module cards — atlas-extractor

For each module card:

- Read the code_refs and source_refs files listed in the card frontmatter.
- Read the card body.
- Fill in `## Ответственность` with a 2-4 sentence description of what this module does, inferred from code structure (exports, package names, function signatures, main types).
- Fill in `## Не входит в ответственность` with what this module deliberately does NOT handle (inferred from what's imported/exported and what's in sibling modules).
- Fill in `## Текущее поведение` with a concise summary of the module's actual behavior from reading the code.
- Add `## Известные риски` if the code has obvious risk patterns (TODO/FIXME, deprecated markers, unsafe operations, missing error handling).
- Set `source_confidence: medium` if code was readable and consistent, `low` if sparse or ambiguous.
- Do NOT set `evidence_level: code_confirmed` unless you actually read and understood the code.

#### 2b. Scenario cards — atlas-extractor

For each scenario card:

- Read the source_refs files listed in the card frontmatter (docs describing the scenario).
- Read the card body.
- Fill in `## Цель` — 2-3 sentences: what user/system goal this scenario achieves.
- Fill in `## Участники` — list components/services/agents involved with roles.
- Fill in `## Поток выполнения` — numbered step-by-step sequence from docs and code.
- Fill in `## Ограничения` — preconditions, limits, constraints.
- Fill in `## Сценарии ошибок` — known failure paths.
- Fill in `## Связанные модули` — list module card ids that participate. Cross-reference with `.ai/memory/modules/`.
- Fill in `## Связанные тесты` — list test file paths that verify this scenario.
- Leave `## Свидетельства из кода` and `## Свидетельства из тестов` for atlas-coder.
- Fill in `## Обоснование` — WHY this scenario exists.

#### 2b. Decision/Proposal/Historical cards — atlas-analyst

For each decision, proposal, or historical card:

- Read the source_refs file (the spec/doc the card was created from).
- Read the card body — CLI extracted sections deterministically, but semantic rationale extraction requires LLM.
- **Decision cards**: fill `## Контекст`, `## Проблема`, `## Решение`, `## Обоснование` (WHY not WHAT), `## Рассмотренные альтернативы` (with status + reason), `## Отклонённые альтернативы`, `## Последствия`.
- **Proposal cards**: fill `## Предлагаемое поведение`, `## Обоснование из спецификации`, `## Затронутые модули`, `## Затронутые сценарии`, `## Затронутые решения`, `## Утверждения`. Re-extract claims CLI missed (numbered requirements, prose without modal verbs, non-goals, acceptance criteria).
- **Historical cards**: fill `## Какая проблема решалась`, `## Актуальное обоснование` (what rationale survives), `## Устаревшие идеи`, `## Выжившие решения`, `## Ссылки на текущие решения`.
- **Spec comparison**: compare new spec against existing proposal/historical cards by meaning. Detect supersede/conflict relations. Report to reviewer.
- **Partial implementation detection**: for proposal claims with `heuristic_code_match` evidence — determine if spec is partially implemented, report which claims have code match vs not found vs conflicting.
- If rationale is explicitly stated in spec → mark `evidence_level: reviewed_doc`. If inferred → `evidence_level: inferred`.
- Do NOT set `status: current` — only atlas-reviewer can promote.

#### 2c. Code evidence verification — atlas-coder

For each enriched module/scenario card (after extractor or analyst):

- Read the test_refs files.
- Verify that code_refs paths exist and the functions/types mentioned in the card are actually present in the referenced code files.
- Fill `## Свидетельства из кода` with specific function/type names found and their file:line if determinable. Use Russian heading (validator checks it).
- If tests cover the module's behavior, note which test functions confirm which behavior in `## Свидетельства из тестов`. Use Russian heading.
- If code_refs point to files that don't contain what the card claims, mark `status: conflict` and add to `reconciliation/conflicts.md`.
- Set `evidence_level: code_confirmed` ONLY if you verified specific symbols in the code.
- Set `evidence_level: test_confirmed` ONLY if you verified tests cover the behavior.
- For scenario cards: verify that the flow described in `## Поток выполнения` matches actual code behavior. If flow doesn't match — flag as conflict.
- For proposal cards: check if proposed behavior is partially implemented in code. Report findings.

#### 2d. Architecture cards — atlas-analyst (synthesis)

**System architecture card** (`architecture/system.md`):

- Read all module cards (`.ai/memory/modules/*.md`).
- Fill in `## Обзор архитектуры` — high-level system overview, component boundaries, deployment topology.
- **Group by runtime_tier**: read `runtime_tier` field from each module card's frontmatter. Describe production components separately from demo/experimental components. If module card has `runtime_tier: demo` — mark it as demo. If `runtime_tier: production` — production. If missing — infer from code paths (demo/example/testdata → demo, else production).
- Fill in `## Компоненты` — list of components with responsibilities (from module cards), grouped by runtime tier.
- Fill in `## Зависимости` — external dependencies (DBs, APIs, message queues) + internal coupling.
- Fill in `## Поток данных` — data flow through system (ingress → processing → egress).
- This is **system-level synthesis**, not per-package documentation.

**Per-module architecture cards** (`architecture/arch-<id>.md`):

- Read the corresponding module card (`.ai/memory/modules/<id>.md`).
- Read the `source_refs` docs listed in the architecture card frontmatter.
- **Determine `runtime_tier`**: read module code_refs paths. If paths contain `demo`, `example`, `examples`, `testdata` — set `runtime_tier: demo`. If paths are production code (no demo/test patterns) — set `runtime_tier: production`. If both — `mixed`. Also consider: is this module part of a demo/experimental submodule? Is it deployed to production? Use code context to decide.
- Fill in `## Обзор архитектуры` — high-level structure, boundaries, design rationale for this component.
- Fill in `## Компоненты` — main components with their responsibilities.
- Fill in `## Зависимости` — external dependencies and internal coupling points.
- Fill in `## Поток данных` — how data flows through this component.
- Fill in `## Связанные модули` — list module card ids that interact with this one.
- Architecture is **synthesis**, not extraction — you are creating architectural documentation by combining module behavior, code structure, and design docs.
- Do NOT set `status: current` — only atlas-reviewer can promote.

**AUTO-DISPATCH REVIEWER:**
After analyst completes ALL architecture cards, **automatically dispatch atlas-reviewer** for the entire batch. Reviewer will:
- Check each card for required sections
- Promote to `current` if evidence is sufficient
- Add incomplete cards to `open-questions.md`
- Set `review_required: false` for completed cards

#### 2e. Reference cards — atlas-analyst (synthesis from guide docs)

For each reference card:

- Read the guide/reference docs listed in `source_refs` (e.g., `AI_AGENT_REGISTRY_GUIDE.md`).
- Read the corresponding module card for context.
- Fill in `## Перенесённое поведение` — what behavior was migrated from legacy/external systems.
- Fill in `## Намеренно не перенесённое поведение` — what was consciously NOT migrated and why.
- Fill in `## Инварианты и переходы состояний` — what invariants are preserved, what states are possible.
- Fill in `## Отказ/повтор/отмена/восстановление` — how the system handles failures, retries, cancellation, recovery.
- Fill in `## Совместимость/операционные ограничения` — known compatibility limits, version constraints, environment requirements.
- Fill in `## Производные сценарии и тесты` — use cases and tests derived from this behavior.
- Reference is **synthesis** — combine guide docs, module behavior, and operational knowledge.
- Do NOT set `status: current` — only atlas-reviewer can promote.

**AUTO-DISPATCH REVIEWER:**
After analyst completes ALL reference cards, **automatically dispatch atlas-reviewer** for the entire batch. Reviewer will:
- Check each card for required sections (Перенесённое поведение, Инварианты, Отказ/повтор, etc.)
- Promote to `current` if evidence is sufficient
- Add incomplete cards to `open-questions.md`
- Set `review_required: false` for completed cards

#### 2f. Quality gate — atlas-reviewer

For the full memory bank after enrichment:

- Read all enriched cards.
- Check that no `current` card has `evidence_level: spec_only` or `inferred` without code evidence.
- Check that `proposal`/`historical` cards have `can_answer_current_behavior: false`.
- Check that `decision` cards have `can_generate_code_from: false`.
- Check that `## Ответственность` (module) / `## Цель` (scenario) / `## Обзор архитектуры` (architecture) / `## Перенесённое поведение` (reference) / `## Обоснование` (decision) / `## Предлагаемое поведение` (proposal) is not still a placeholder.
- For scenario cards: verify `## Поток выполнения` has numbered steps, `## Участники` has ≥1 participant, `## Связанные модули` has module ids or "Не выявлены".
- For architecture cards: verify `## Компоненты` has ≥1 component, `## Зависимости` lists dependencies, `## Связанные модули` has module ids.
- For reference cards: verify `## Инварианты` has content, `## Отказ/повтор/отмена` describes error handling, `## Совместимость` lists constraints.
- For decision cards: verify `## Обоснование` explains WHY, not WHAT. Verify `## Рассмотренные альтернативы` has ≥1 entry or "Not documented in spec".
- Flag any card where content was not enriched — add to `reconciliation/open-questions.md`.
- Resolve cross-card conflicts reported by analyst. Add to `reconciliation/conflicts.md` if unresolved.
- Set `review_required: false` only for cards where content + evidence are filled and verified.
- Set `last_reviewed` to today's date for all reviewed cards.

### Phase 3 — Validation

```bash
.ai/atlas/bin/atlas validate
```

If validate reports errors, fix them (broken relations, dangerous usage policies, spec_only+current_behavior). Re-run validate until clean.

### Phase 4 — Summary

**Run completion gate first:**
```bash
.ai/atlas/bin/atlas ls --status needs_review --json
```
If ANY cards remain — bootstrap is INCOMPLETE. Either continue dispatching or list deferred cards with reasons in `reconciliation/open-questions.md`.

Show the user:
- How many cards were created (from Phase 1).
- How many were enriched by agents (from Phase 2).
- How many still need manual review (review_required: true).
- `git diff .ai/memory/` summary.

## Model routing

- **atlas-extractor** (qwen-3.6-27b): document classification, responsibility/behavior extraction from code reading. Cheap, high-volume.
- **atlas-analyst** (deepseek-v4-flash): spec analysis, rationale extraction, semantic claim matching, decision card enrichment. Strong text understanding.
- **atlas-coder** (qwen-coder-next): code evidence verification, test coverage check, symbol-level analysis. Precise code understanding.
- **atlas-reviewer** (qwen-thinking-large): rationale, conflict resolution, final quality gate. Deep reasoning.

## Rules

- NEVER assert current behavior without reading the actual code.
- NEVER set `evidence_level: code_confirmed` without verifying specific symbols in referenced files.
- NEVER set `review_required: false` for a card with placeholder content.
- ALWAYS read the code_refs files before writing responsibility/behavior.
- ALWAYS preserve frontmatter fields set by deterministic bootstrap (code_refs, test_refs, entity_type, id, related_*).
- ALWAYS use the `atlas_updateCard` tool to update cards. NEVER use Write tool directly on memory .md files — it corrupts YAML frontmatter. `atlas_updateCard` preserves frontmatter and only replaces body or sets specific fields.
- Evidence format: `## Code evidence` entries MUST include file path + line number. CLI rejects code_confirmed without properly formatted section.
- Mark uncertain inferences as `evidence_level: inferred`.
- If code is unreadable, minified, or generated — set `source_confidence: low` and add to open-questions.
