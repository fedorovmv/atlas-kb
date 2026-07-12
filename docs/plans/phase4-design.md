# Phase 4 Design Decisions: migrate-from-v3

> Source: @oracle design discovery (fresh session)
> Evidence: v3/CONTRACT_FIRST_MEMORY.md, v3/template/scripts/memoryctl.py, ts-kb-flow/src/schemas/frontmatter.ts, sourceCoverage.ts, legacyIngest.ts, cli.ts
> Status: ✅ APPROVED — 4 open questions resolved by user, implementation complete

## 1. Frontmatter field mapping (v3 → ts-kb-flow)

| v3 Field | Target Field | Transform Rule | Risk |
|----------|--------------|----------------|------|
| `memory_card_type` | `entity_type` | Direct mapping (see §3) | Index types collapse into `readme` |
| `runtime_tier` | `runtime_tier` | Preserve as-is (enum identical) | None — passthrough() preserves |
| `source_status` | `source_status` | Preserve as-is (enum identical) | None — passthrough() preserves |
| `evidence_level` | `evidence_level` | **Different enums — requires mapping** (see §2.4) | Enum remap |
| `scope` (optional) | `product_areas` | Array wrap: `scope` → `[scope]` if string | Type coercion |
| `owned_paths` (optional) | `code_refs` | Transform: path string → `{path, kind: "owned"}` | Path semantics unclear |
| `related_cards` (optional) | `related_*` (by type) | Path → id conversion (see §7) | Path→id resolution fragile |
| `language` (optional) | DROP | Not in ts-kb-flow schema | Loss of localization metadata |

## 2. Required field synthesis (CRITICAL PROBLEM)

v3 has 4 required fields. ts-kb-flow has 11+. Synthesis rules for each missing field:

### 2.1 `id`
Derive from filename slug: strip `knowledge/memory/` prefix, replace `/` with `-`, remove `.md`, lowercase.
Regex: `/^[a-z0-9][a-z0-9\-_.]*$/`
Risk: slug collisions → append `-1`, `-2` suffix.

### 2.2 `status` — derive from v3 `source_status`

| v3 `source_status` | ts-kb-flow `status` |
|--------------------|---------------------|
| `current` | `current` |
| `active-rationale` | `current` |
| `partially-active` | `needs_review` |
| `superseded` | `deprecated` |
| `historical-only` | `historical` |
| `unknown` | `needs_review` |

### 2.3 `authority` — derive from v3 `evidence_level`

| v3 `evidence_level` | ts-kb-flow `authority` |
|---------------------|------------------------|
| `code` | `source_of_truth` |
| `test` | `source_of_truth` |
| `config` | `reviewed_memory` |
| `manifest` | `reviewed_memory` |
| `current-doc` | `reviewed_memory` |
| `rationale-only` | `historical_context` |
| `mixed` | `reviewed_memory` |
| `unknown` | `reference` |

### 2.4 `evidence_level` — v3 enum → ts-kb-flow enum (DIFFERENT)

| v3 `evidence_level` | ts-kb-flow `evidence_level` |
|---------------------|------------------------------|
| `code` | `code_confirmed` |
| `test` | `test_confirmed` |
| `config` | `contract_confirmed` |
| `manifest` | `contract_confirmed` |
| `current-doc` | `reviewed_doc` |
| `rationale-only` | `spec_only` |
| `mixed` | `inferred` |
| `unknown` | `unknown` |

### 2.5 `stability` — derive from `source_status`

| v3 `source_status` | ts-kb-flow `stability` |
|--------------------|------------------------|
| `current` | `stable` |
| `active-rationale` | `stable` |
| `partially-active` | `evolving` |
| `superseded` | `deprecated` |
| `historical-only` | `deprecated` |
| `unknown` | `unknown` |

### 2.6 `source_confidence` — derive from `evidence_level`

| v3 `evidence_level` | `source_confidence` |
|---------------------|----------------------|
| `code`, `test` | `high` |
| `config`, `manifest`, `current-doc` | `medium` |
| `rationale-only`, `mixed` | `low` |
| `unknown` | `unknown` |

### 2.7 `last_reviewed`
Use migration date (today, YYYY-MM-DD). All cards same date.
Alternative: parse git log per-file (expensive).

### 2.8 `review_required`
Default `true` (migrated content needs review).
Exception: `source_status` = `superseded` or `historical-only` → `false`.
Override: `--no-auto-review` → all `false`.

### 2.9 `knowledge_types` — derive from `memory_card_type`

| v3 `memory_card_type` | `knowledge_types` |
|-----------------------|-------------------|
| `module` | `["current_behavior", "code_evidence"]` |
| `flow` | `["current_behavior"]` |
| `decision` | `["design_rationale", "current_behavior"]` |
| `reference` | `["current_behavior"]` |
| `architecture` | `["current_behavior", "design_rationale"]` |
| `project` | `["current_behavior"]` |
| `routing`, `testing`, `ops`, `gotchas` | `["current_behavior"]` |
| `index`, `module-index`, `flow-index`, `decision-index` | `["current_behavior"]` |

Override by `source_status`:
- `historical-only` → prepend `"historical_context"`
- `superseded` → replace with `["historical_context"]`

### 2.10 `usage_policy` — defaults per entity_type

```typescript
{
  can_answer_current_behavior: true,
  can_generate_code_from: false,
  can_use_as_rationale: true,
  can_use_as_example: false,
  requires_code_check_before_change: true,
  requires_warning: false,
}
```

Override: `historical`/`deprecated` status → `can_answer_current_behavior: false`, `requires_warning: true`.

## 3. entity_type mapping

| v3 `memory_card_type` | ts-kb-flow `entity_type` | Collision |
|-----------------------|--------------------------|-----------|
| `module` | `module` | None |
| `flow` | `flow` | None |
| `decision` | `decision` | None |
| `reference` | `reference` | None |
| `architecture` | `architecture` | None |
| `project` | `project` | None |
| `routing` | `task_routing` | None |
| `testing` | `testing` | None |
| `ops` | `ops` | None |
| `gotchas` | `gotchas` | None |
| `index` | `readme` | **COLLISION** (4→1) |
| `module-index` | `readme` | **COLLISION** |
| `flow-index` | `readme` | **COLLISION** |
| `decision-index` | `readme` | **COLLISION** |

Collision handling: disambiguate by path + preserve v3 type in body comment.

## 4. Path mapping

`knowledge/memory/**/*.md` → `.ai/memory/**/*.md`

Subdirs: modules/, flows/, decisions/, architecture/, reference/ (NEW — not in scaffold).

- `source-manifest.json` → PRESERVE as `.ai/memory/source-manifest.json` (flag: `--preserve-manifest`)
- `source-coverage.json` → MIGRATE to `.ai/memory/source-coverage.json` (direct copy, schemas identical)
- `index.json`, `memory-contract.json` → DROP

## 5. source-coverage.json migration

v3 dispositions (7) IDENTICAL to ts-kb-flow DispositionSchema. Direct copy.
Transform: `targetCards` paths → ids (same slug logic as §2.1).

## 6. knowledge/docs/ and knowledge/drafts/ handling

Default: SKIP both (memory migration only).
Optional: `--include-docs` flag for cross-system migration (service→module, runbook→ops, gotcha→gotchas, guide→reference).

## 7. Structural transforms

### 7.1 `related_cards` → `related_*`
Path → id conversion. Map subdir → relation field:
- `modules/` → `related_modules`
- `flows/` → `related_scenarios`
- `decisions/` → `related_decisions`
- `reference/` → `related_specs`
- Other → DROP with warning

### 7.2 `owned_paths` → `code_refs`
`{path, kind: "owned"}`

### 7.3 `scope` → `product_areas`
Array wrap.

### 7.4 body `evidence` → `claims`
NO automatic transform. Leave in body with `<!-- TODO: Extract claims -->` comment.

## 8. Migration safety

- Idempotency: skip existing by default, `--force` to overwrite
- Atomic writes: temp + rename
- Staging: `.ai/memory-build/v3-migration/` (migration-plan.json, migrated/, skipped/, errors/, log.jsonl, backup-{timestamp}/)
- Validation: run `validateMemory()` post-migration
- Rollback: no automatic — source preserved

## 9. CLI design

```bash
repo-memory migrate-from-v3 <v3-dir>
  --root <path>          # target repo root
  --force                # overwrite existing
  --dry-run              # preview only
  --json                 # JSON output
  --include-docs         # migrate knowledge/docs/
  --skip-coverage        # skip source-coverage.json
  --preserve-manifest    # copy source-manifest.json
  --no-auto-review       # review_required=false for all
```

Output: discovered/migrated/skipped/errors/warnings counts + post-migration validation.

## 10. Edge cases and risks

- Missing required v3 frontmatter → ERROR (memory_card_type) / WARN + defaults (others)
- Unknown memory_card_type → WARN, default to `reference`
- Filename slug collisions → detect, append `-1`, `-2`
- `reference/` subdir not in scaffold → create automatically
- `index.json`, `memory-contract.json` → DROP
- `architecture/inter-module-deps.md` → regular architecture card
- Large banks → stream processing, progress bar
- Malformed frontmatter → ERROR, skip card, log

## Resolved decisions (user-approved)

1. **`language` field:** Preserve in body comment `<!-- v3: language=ru -->`.
2. **`last_reviewed` strategy:** Migration date (today, YYYY-MM-DD). All cards same date. Simple, consistent, marks them as needing review.
3. **`related_cards` unmapped paths:** Preserve as broken reference (id kept, validation warns). User fixes manually.
4. **`owned_paths` mapping:** `code_refs` with `kind: "owned"`. Preserves ownership semantic.