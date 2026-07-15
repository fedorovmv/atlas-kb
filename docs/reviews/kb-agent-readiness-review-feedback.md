# Review Feedback Ledger — kb-agent-readiness

- **Base:** 95ca2ad
- **Head:** 862799c
- **Reviewer:** Council (fresh session ses_09863a2aeffezSvfqqBc1m1Kt5), preset: multi-model code review
- **Plan:** docs/plans/kb-agent-readiness-brief.md, docs/plans/kb-agent-readiness-plan.md
- **Prior review (context only):** docs/reviews/kb-agent-readiness-code-review-feedback.md

| ID | Status | Evidence | Decision | Required change | Verification |
|----|--------|----------|----------|-----------------|--------------|
| C1 | ACCEPTED | `src/core/bootstrapMemory.ts:653,659,668-670` — `renderDecisionCard` hardcodes `status:"current"`, `review_required:false`, `agent_summary:""`, empty `related_modules`/`affects_modules`. Module renderer (`:391`) correctly uses `review_required: status !== "current"`. Violates reviewed/current invariant; will hard-fail cross-link validation after 2 attempts (`validate.ts:211-219`). Bootstrap test (`test/bootstrap.test.ts:76-99`) does not assert decision card status. | Set `status:"needs_review"`, `review_required:true` in `renderDecisionCard`. Add regression test asserting bootstrapped decision cards are `needs_review`/`review_required:true`. | Run `test/bootstrap.test.ts` + full suite |
| C2 | ACCEPTED | `src/scaffold/templates/memory/decisions/registry-is-discovery-not-orchestration.md:5,11,12,64,86` — shipped fixture `current`/`review_required:false` but empty `agent_summary`, placeholder `## Примеры использования`, rejected-alt rationale is single sentence without constraints/trade-offs/context-fit. Contradicts T3 (agent_summary) + T5 (rationale depth). | Populate real `agent_summary`, concrete examples, and three-part rejected-alternative (constraints/trade-offs/context-fit). | Run `test/validate.test.ts` + fixture-loaded tests |
| I1 | ACCEPTED | `src/scaffold/templates/agents/atlas-reviewer.md:45-46` references `## Rationale`/`## Alternatives`; `src/schemas/cardSections.ts:60-61` uses `## Обоснование`/`## Рассмотренные альтернативы`. | Replace English headings with Russian exact strings. | Grep atlas-reviewer.md for English heading names |
| I2 | ACCEPTED | `src/scaffold/templates/agents/atlas-reviewer.md:20` module required list omits `## Публичный интерфейс`; `cardSections.ts:33` requires it; reviewer.md:30,70 say required. Internal inconsistency. | Add `## Публичный интерфейс` to module required list at `:20`. | Diff atlas-reviewer.md |
| I3 | ACCEPTED | `src/core/validate.ts:20` imports `areCrossLinksEmpty` from `src/commands/ls.ts:120` — core imports from command layer. `src/core/relations.ts` already exports `RELATION_FIELDS` and is the proper home. | Move `areCrossLinksEmpty` to `src/core/relations.ts`; update imports in `validate.ts` and `ls.ts`. | Run full test suite |
| M1 | DEFERRED | `cross_link_attempts` never resets. Minor, not a blocker for this feature. | — | — |
| M2 | DEFERRED | `renderCardLine` omits `agent_summary`. UX polish, not correctness. | — | — |
| M3 | DEFERRED | No length cap on `agent_summary`. Schema comment notes intent; enforcement optional. | — | — |

## Accepted fix set (dispatched)

- C1, C2, I1, I2, I3 — bounded mechanical corrections, non-overlapping files.

## Deferred

- M1, M2, M3 — valid but outside acceptance criteria; safe to defer.