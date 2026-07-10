# Brief: deep design rationale extraction (§4.6)

## Goal

Извлекать design rationale из content спек (не signal-based). Создавать decision cards при ingest-spec. Заполнять structured sections (Problem, Decision, Rationale, Alternatives, Consequences) deterministically из markdown headings/paragraphs.

## Scope (LIMITATIONS §4.6 — 4 из 6 пунктов)

1. **извлечение problem/value/constraints из content спек** — `extractClaims` detects rationale from Problem/Context/Constraints/Consequences/Trade-offs/Non-goals headings (сейчас только Rationale/Why/Decision/Alternatives).
2. **извлечение rejected alternatives** — parse `### Alternative ...` / `Status: rejected` / `Reason:` patterns under `## Alternatives` headings → structured entries.
3. **ingestSpec creates decision cards** — spec с rationale sections (Problem + Decision + Rationale) → creates `entity_type: decision` card, not just proposal/historical.
4. **bootstrap extractDecisions fix** — dead code: checks `file.signals` (never matches). Fix to check `file.topics` for rationale/decision keywords + read doc content for rationale headings.

## Non-goals

- различение explicit vs inferred rationale (schema имеет `evidence_level: inferred`, но это LLM judgment — v0.4+ agent task).
- связывание rationale с current decisions (requires semantic matching — v0.4+).
- проверка semantic usage of rationale (validate catches `can_generate_code_from`, semantic usage = LLM task).
- обновление decision card при появлении новой спеки (requires reconciling existing decision cards with new spec content — v0.4+).

## Constraints

- `extractClaims` в `specClassification.ts:58-97` — heading patterns + bullet keyword gates. Only headings: Rationale/Why/Decision/Alternatives → design_rationale. Need to add: Problem/Context/Constraints/Consequences/Trade-offs/Non-goals.
- `inferClaimTypeFromSection` lines 99-105 — returns null for Problem/Context/Constraints. Fix pattern matching.
- `extractDecisions` в `bootstrapMemory.ts:297-308` — checks `file.signals` (never matches). Fix: check `file.topics` for keywords + optionally read doc content for `## Rationale`/`## Decision` headings.
- `ingestSpec.ts` — 4 branches (historical, proposal/unconfirmed, proposal/confirmed, conflict). Need 5th: decision card when spec has rationale content.
- Decision card template (bootstrap `renderDecisionCard`) — has ## Problem, ## Decision, ## Rationale, ## Alternatives, ## Consequences sections but only ## Rationale filled. Fix: fill from extracted content.
- `ClaimSchema` has `decision?: string` field — never populated. Can use to link claim → decision card id.

## Testable acceptance criteria

1. `extractClaims` on spec with `## Problem` heading → produces `design_rationale` claim (not null).
2. `extractClaims` on spec with `## Constraints` / `## Consequences` / `## Trade-offs` / `## Non-goals` → `design_rationale` claims.
3. `extractClaims` on spec with `## Background` containing rationale prose → `design_rationale` (not `historical_context` — or at least also produces rationale claim).
4. `extractClaims` on `## Alternatives` with `### Alternative X\nStatus: rejected\nReason: ...` → claims with text capturing alternative + rejection reason.
5. `ingestSpec` on spec with `## Problem` + `## Decision` + `## Rationale` → creates decision card in `decisions/` (not proposal).
6. `bootstrapMemory` on project with doc containing `## Rationale` heading → creates decision card (not dead code).
7. Decision card from ingestSpec has ## Problem, ## Decision, ## Rationale filled from spec content (not "Needs review" placeholder).
8. Существующие 95 тестов зелёные.
9. LIMITATIONS §4.6 updated.