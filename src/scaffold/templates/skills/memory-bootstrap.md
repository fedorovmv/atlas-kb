---
name: memory-bootstrap
description: Full LLM-assisted memory bank population — deterministic scaffold + agent-driven content enrichment.
---

# Memory Bootstrap Skill

Populate `.ai/memory` from project source, tests, docs, and specs in one workflow. Deterministic CLI creates the skeleton; LLM agents enrich cards with real content from code analysis.

**⚠️ CRITICAL: This skill has TWO phases. You MUST complete BOTH:**
1. **Phase 1**: Run CLI scaffold (creates skeleton cards)
2. **Phase 2**: Dispatch subagents to enrich ALL needs_review cards (fill content, verify evidence, promote to current)

**If you stop after Phase 1 without dispatching subagents — the bootstrap is INCOMPLETE.** Cards will have placeholder content "Требует ревью — ...". You MUST dispatch memory-extractor, memory-analyst, memory-coder, and memory-reviewer subagents as described in Phase 2 below.

## Workflow

### Phase 1 — Deterministic scaffold (CLI)

Run from project root:

```bash
.ai/memory-tool/bin/memory bootstrap --root .
```

This creates skeleton cards: module cards with code_refs/test_refs/source_refs but placeholder content ("Needs review", "Preliminary responsibility"). It also creates `reconciliation/conflicts.md` and `reconciliation/open-questions.md`.

**MANDATORY after scaffold:** Run this command and SAVE the output:

```bash
.ai/memory-tool/bin/memory ls --json | jq '[.[] | select(
  .status == "needs_review" or
  .evidence_level == "inferred" or
  .evidence_level == "spec_only" or
  .evidence_level == "unknown" or
  .review_required == true
)] | length'
```

This returns a NUMBER. If the number is **0** — bootstrap is complete, skip Phase 2. If the number is **>0** — there are cards with weak content, placeholder rationale, or missing enrichment. You **MUST proceed to Phase 2** to dispatch subagents. Do NOT ask the user. Do NOT offer options. Do NOT report "bootstrap complete" until this number is 0.

**⚠️ Do NOT rationalize skipping Phase 2.** Common false excuses:
- "spec_only is expected for proposals" — FALSE. Proposals with spec_only still need analyst to extract `## Предлагаемое поведение`, `## Обоснование из спецификации`, `## Утверждения` from the spec. spec_only means "no code verification yet", NOT "content is complete".
- "review_required=true means awaiting human decision" — FALSE. review_required means analyst hasn't filled rationale/alternatives yet. Analyst MUST infer WHY and fill sections before reviewer can promote.
- "inferred evidence is acceptable" — FALSE for decision cards. Decision cards with inferred evidence need analyst to extract real rationale from specs, not leave "Не задокументировано".
- "cards are already enriched" — verify by reading 2-3 cards. If ANY section says "Требует ревью" or "Не задокументировано" — enrichment is INCOMPLETE.

To see which cards need work, run:
```bash
.ai/memory-tool/bin/memory ls --json | jq '[.[] | select(
  .status == "needs_review" or
  .evidence_level == "inferred" or
  .evidence_level == "spec_only" or
  .evidence_level == "unknown" or
  .review_required == true
)] | .[] | {id, entity_type, status, evidence_level}'
```

Phase 2 below describes how to dispatch subagents for enrichment.

### Phase 2 — LLM enrichment (agents)

For each `needs_review` card from Phase 1, you (the orchestrating agent) MUST dispatch subagent work using model routing.

**CRITICAL — one card per subagent dispatch.** Never bundle multiple cards into a single subagent task. Each subagent gets exactly one card, reads its source_refs/code_refs, fills content, returns. This keeps context bounded and quality high.

**Concurrency limit — max 5 parallel subagents.** Dispatch in batches of 5. Wait for each batch to complete before starting the next. Subagents are lightweight (one card, bounded context), so 5 parallel is safe.

**Progress tracking — MANDATORY.** After each batch completes, run:
```bash
.ai/memory-tool/bin/memory ls --status needs_review --json
```
Count remaining needs_review cards. If >0 cards remain in the current stage, continue dispatching. Do NOT advance to the next stage until the current stage has 0 needs_review cards of that entity_type.

**Completion gate — MANDATORY.** Before reporting "done", run:
```bash
.ai/memory-tool/bin/memory ls --status needs_review --json
```
If the result contains ANY cards, the bootstrap is INCOMPLETE. You MUST continue dispatching subagents for remaining cards. Do NOT report "done" until `needs_review` count is 0 (or all remaining cards are explicitly marked as deferred in `reconciliation/open-questions.md` with a reason).

**MUST COMPLETE ALL PHASES.** Do NOT stop after module enrichment. The pipeline has 6 mandatory subagent dispatch stages. Complete ALL before reporting "done":

```
Stage A: module cards      → extractor → coder → reviewer
Stage B: scenario cards    → extractor → coder → reviewer
Stage C: decision/proposal/historical cards → analyst → coder (proposals only) → reviewer
Stage D: architecture cards → analyst (synthesis) → **auto: reviewer**
Stage E: reference cards → analyst (synthesis from guide docs) → **auto: reviewer**
Stage F: validate + summary
```

**Auto-reviewer dispatch (Stages D & E):**
After analyst completes enrichment for a stage, **automatically dispatch memory-reviewer** for all cards in that stage. Do NOT wait for manual trigger. Reviewer promotes cards from `needs_review` to `current` (if evidence is sufficient) or adds to `open-questions.md` (if content is incomplete).

**Per-stage checkpoint (run after each stage):**
```bash
.ai/memory-tool/bin/memory ls --status needs_review --json | jq '[.[] | select(.entity_type=="module")] | length'   # after Stage A
.ai/memory-tool/bin/memory ls --status needs_review --json | jq '[.[] | select(.entity_type=="scenario")] | length' # after Stage B
.ai/memory-tool/bin/memory ls --status needs_review --json | jq '[.[] | select(.entity_type=="decision" or .entity_type=="proposal" or .entity_type=="historical")] | length' # after Stage C
.ai/memory-tool/bin/memory ls --status needs_review --json | jq '[.[] | select(.entity_type=="architecture")] | length' # after Stage D
.ai/memory-tool/bin/memory ls --status needs_review --json | jq '[.[] | select(.entity_type=="reference")] | length' # after Stage E
```
If count >0 for the stage's entity types — continue dispatching. Do NOT proceed to next stage until count is 0.

If you stop after Stage A or B without completing Stage C (analyst for decision/proposal/historical), the bootstrap is INCOMPLETE. Decision cards will have placeholder rationale "Требует ревью — какие альтернативы были рассмотрены?" — this is unacceptable.

**Card type routing:**

| entity_type | Agent pipeline | What they do |
|-------------|----------------|--------------|
| module | extractor → coder → reviewer | Read code, fill Responsibility/Behavior, verify symbols |
| scenario | extractor → coder → reviewer | Read source_refs, fill Goal/Flow/Actors, verify against code |
| decision | **analyst** → reviewer | Read spec, extract Rationale/Alternatives/Consequences |
| proposal | **analyst** → coder → reviewer | Read spec, extract proposed behavior, check partial implementation |
| historical | **analyst** → reviewer | Read spec, extract survived decisions, prior approach |

#### 2a. Module cards — memory-extractor

For each module card:

- Read the code_refs and source_refs files listed in the card frontmatter.
- Read the card body.
- Fill in `## Ответственность` with a 2-4 sentence description of what this module does, inferred from code structure (exports, package names, function signatures, main types).
- Fill in `## Не входит в ответственность` with what this module deliberately does NOT handle (inferred from what's imported/exported and what's in sibling modules).
- Fill in `## Текущее поведение` with a concise summary of the module's actual behavior from reading the code.
- Add `## Известные риски` if the code has obvious risk patterns (TODO/FIXME, deprecated markers, unsafe operations, missing error handling).
- Set `source_confidence: medium` if code was readable and consistent, `low` if sparse or ambiguous.
- Do NOT set `evidence_level: code_confirmed` unless you actually read and understood the code.

#### 2b. Scenario cards — memory-extractor

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
- Leave `## Свидетельства из кода` and `## Свидетельства из тестов` for memory-coder.
- Fill in `## Обоснование` — WHY this scenario exists.

#### 2b. Decision/Proposal/Historical cards — memory-analyst

For each decision, proposal, or historical card:

- Read the source_refs file (the spec/doc the card was created from).
- Read the card body — CLI extracted sections deterministically, but semantic rationale extraction requires LLM.
- **Decision cards**: fill `## Контекст`, `## Проблема`, `## Решение`, `## Обоснование` (WHY not WHAT), `## Рассмотренные альтернативы` (with status + reason), `## Отклонённые альтернативы`, `## Последствия`.
- **Proposal cards**: fill `## Предлагаемое поведение`, `## Обоснование из спецификации`, `## Затронутые модули`, `## Затронутые сценарии`, `## Затронутые решения`, `## Утверждения`. Re-extract claims CLI missed (numbered requirements, prose without modal verbs, non-goals, acceptance criteria).
- **Historical cards**: fill `## Какая проблема решалась`, `## Актуальное обоснование` (what rationale survives), `## Устаревшие идеи`, `## Выжившие решения`, `## Ссылки на текущие решения`.
- **Spec comparison**: compare new spec against existing proposal/historical cards by meaning. Detect supersede/conflict relations. Report to reviewer.
- **Partial implementation detection**: for proposal claims with `heuristic_code_match` evidence — determine if spec is partially implemented, report which claims have code match vs not found vs conflicting.
- If rationale is explicitly stated in spec → mark `evidence_level: reviewed_doc`. If inferred → `evidence_level: inferred`.
- Do NOT set `status: current` — only memory-reviewer can promote.

#### 2c. Code evidence verification — memory-coder

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

#### 2d. Architecture cards — memory-analyst (synthesis)

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
- Do NOT set `status: current` — only memory-reviewer can promote.

**AUTO-DISPATCH REVIEWER:**
After analyst completes ALL architecture cards, **automatically dispatch memory-reviewer** for the entire batch. Reviewer will:
- Check each card for required sections
- Promote to `current` if evidence is sufficient
- Add incomplete cards to `open-questions.md`
- Set `review_required: false` for completed cards

#### 2e. Reference cards — memory-analyst (synthesis from guide docs)

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
- Do NOT set `status: current` — only memory-reviewer can promote.

**AUTO-DISPATCH REVIEWER:**
After analyst completes ALL reference cards, **automatically dispatch memory-reviewer** for the entire batch. Reviewer will:
- Check each card for required sections (Перенесённое поведение, Инварианты, Отказ/повтор, etc.)
- Promote to `current` if evidence is sufficient
- Add incomplete cards to `open-questions.md`
- Set `review_required: false` for completed cards

#### 2f. Quality gate — memory-reviewer

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
.ai/memory-tool/bin/memory validate
```

If validate reports errors, fix them (broken relations, dangerous usage policies, spec_only+current_behavior). Re-run validate until clean.

### Phase 4 — Summary

**Run completion gate first:**
```bash
.ai/memory-tool/bin/memory ls --status needs_review --json
```
If ANY cards remain — bootstrap is INCOMPLETE. Either continue dispatching or list deferred cards with reasons in `reconciliation/open-questions.md`.

Show the user:
- How many cards were created (from Phase 1).
- How many were enriched by agents (from Phase 2).
- How many still need manual review (review_required: true).
- `git diff .ai/memory/` summary.

## Model routing

- **memory-extractor** (qwen-3.6-27b): document classification, responsibility/behavior extraction from code reading. Cheap, high-volume.
- **memory-analyst** (deepseek-v4-flash): spec analysis, rationale extraction, semantic claim matching, decision card enrichment. Strong text understanding.
- **memory-coder** (qwen-coder-next): code evidence verification, test coverage check, symbol-level analysis. Precise code understanding.
- **memory-reviewer** (qwen-thinking-large): rationale, conflict resolution, final quality gate. Deep reasoning.

## Rules

- NEVER assert current behavior without reading the actual code.
- NEVER set `evidence_level: code_confirmed` without verifying specific symbols in referenced files.
- NEVER set `review_required: false` for a card with placeholder content.
- ALWAYS read the code_refs files before writing responsibility/behavior.
- ALWAYS preserve frontmatter fields set by deterministic bootstrap (code_refs, test_refs, entity_type, id, related_*).
- ALWAYS use the `updateCard` tool to update cards. NEVER use Write tool directly on memory .md files — it corrupts YAML frontmatter. `updateCard` preserves frontmatter and only replaces body or sets specific fields.
- Evidence format: `## Code evidence` entries MUST include file path + line number. CLI rejects code_confirmed without properly formatted section.
- Mark uncertain inferences as `evidence_level: inferred`.
- If code is unreadable, minified, or generated — set `source_confidence: low` and add to open-questions.
