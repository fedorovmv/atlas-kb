---
name: memory-bootstrap
description: Full LLM-assisted memory bank population — deterministic scaffold + agent-driven content enrichment.
---

# Memory Bootstrap Skill

Populate `.ai/memory` from project source, tests, docs, and specs in one workflow. Deterministic CLI creates the skeleton; LLM agents enrich cards with real content from code analysis.

## Workflow

### Phase 1 — Deterministic scaffold (CLI)

Run from project root:

```bash
npm run memory -- bootstrap --root .
```

This creates skeleton cards: module cards with code_refs/test_refs/source_refs but placeholder content ("Needs review", "Preliminary responsibility"). It also creates `reconciliation/conflicts.md` and `reconciliation/open-questions.md`.

Then get the list of cards that need enrichment:

```bash
npm run memory -- ls --status needs_review --json
```

### Phase 2 — LLM enrichment (agents)

For each `needs_review` card from Phase 1, you (the orchestrating agent) MUST dispatch subagent work using model routing:

1. **memory-extractor** — for each module card:
   - Read the code_refs and source_refs files listed in the card frontmatter.
   - Read the card body.
   - Fill in `## Responsibility` with a 2-4 sentence description of what this module does, inferred from code structure (exports, package names, function signatures, main types).
   - Fill in `## Non-responsibilities` with what this module deliberately does NOT handle (inferred from what's imported/exported and what's in sibling modules).
   - Fill in `## Current behavior` with a concise summary of the module's actual behavior from reading the code.
   - Add `## Known risks` if the code has obvious risk patterns (TODO/FIXME, deprecated markers, unsafe operations, missing error handling).
   - Set `source_confidence: medium` if code was readable and consistent, `low` if sparse or ambiguous.
   - Do NOT set `evidence_level: code_confirmed` unless you actually read and understood the code.

2. **memory-coder** — for each module card:
   - Read the test_refs files.
   - Verify that code_refs paths exist and the functions/types mentioned in the card are actually present in the referenced code files.
   - Add `## Code evidence` section with specific function/type names found and their file:line if determinable.
   - If tests cover the module's behavior, note which test functions confirm which behavior in `## Test evidence`.
   - If code_refs point to files that don't contain what the card claims, mark `status: conflict` and add to `reconciliation/conflicts.md`.
   - Set `evidence_level: code_confirmed` ONLY if you verified specific symbols in the code.
   - Set `evidence_level: test_confirmed` ONLY if you verified tests cover the behavior.

3. **memory-reviewer** — for the full memory bank after enrichment:
   - Read all enriched cards.
   - Check that no `current` card has `evidence_level: spec_only` or `inferred` without code evidence.
   - Check that `proposal`/`historical` cards have `can_answer_current_behavior: false`.
   - Check that `decision` cards have `can_generate_code_from: false`.
   - Check that `## Responsibility` is not still a placeholder ("Preliminary responsibility", "Needs review").
   - Flag any card where content was not enriched — add to `reconciliation/open-questions.md`.
   - Set `review_required: false` only for cards where responsibility + evidence are filled and verified.
   - Set `last_reviewed` to today's date for all reviewed cards.

### Phase 3 — Validation

```bash
npm run memory -- validate
```

If validate reports errors, fix them (broken relations, dangerous usage policies, spec_only+current_behavior). Re-run validate until clean.

### Phase 4 — Summary

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
