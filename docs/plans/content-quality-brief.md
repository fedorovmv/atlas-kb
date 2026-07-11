# Brief: content quality enforcement — memory card content rubric

## Goal

Качественный контент memory cards: LLM agents производят конкретный, фактический content с symbol references, не placeholder fluff. Enforcement на двух уровнях: agent instructions (rubric + anti-patterns) + validate (format checks).

## Problem (из discovery)

1. **validate принимает любой bullet** — `- TODO` проходит как `## Code evidence` entry. `hasEvidenceSection` проверяет только `^-` presence.
2. **Reviewer checks structure not content** — ≥1 bullet = passes, даже если bullet garbage.
3. **No quality rubric** — agents не знают "how good" их output должен быть.
4. **Zero anti-patterns** — нет "don't write X" для common LLM fluff.
5. **Bootstrap placeholders** — directives ("Needs review") без quality bar hints.

## Scope

### Part A: validate evidence format enforcement
1. `hasEvidenceSection` → `hasQualityEvidenceSection` — bullets MUST match `at <path>:<line>` pattern (file path + line number), не просто `^-`.
2. validate errors: `## Code evidence` bullets без `at <path>:<line>` pattern → ERROR.
3. Same for `## Test evidence`.

### Part B: agent instructions — quality rubric + anti-patterns
1. memory-extractor: add quality checklist (before updateCard: Responsibility cites ≥1 function name, ≤4 sentences; Non-responsibilities ≥1 entry; Current behavior references specific function/type).
2. memory-extractor: add anti-patterns list ("Don't write: 'This module handles functionality' / 'Provides robust solutions' / 'Leverages best practices'").
3. memory-coder: add minimum evidence count (≥1 per code_refs file, not just ≥1 total).
4. memory-reviewer: add "RE-READ at least one code_refs file to verify evidence entry is accurate" step. Not just check section exists.
5. memory-reviewer: add quality rubric (Responsibility specificity score, evidence entry quality).

### Part C: bootstrap placeholder quality hints
1. Replace "Needs review — read code_refs" with "Needs review — EXAMPLE good output: 'Filters agent cards by caller service identity at internal/registry/access_filter.go (FilterCardsForCaller)'".
2. Give concrete target, not just directive.

## Non-goals

- Semantic content scoring (NLP quality judgment — LLM v0.4+).
- Automated code reading by validate (validate checks format, not content truth).
- Cross-card semantic consistency (LLM judgment).

## Testable acceptance criteria

1. validate: `## Code evidence\n- TODO` → ERROR (no file:line pattern).
2. validate: `## Code evidence\n- Filter at internal/registry/access_filter.go:12 (FilterCardsForCaller)` → passes.
3. validate: `## Test evidence\n- checked` → ERROR.
4. validate: `## Test evidence\n- Test TestFilter at tests/registry/filter_test.go:8 covers filtering` → passes.
5. memory-extractor instruction contains: quality checklist + ≥2 anti-patterns + good/bad examples for each section.
6. memory-reviewer instruction contains: "re-read code_refs file" step + quality rubric.
7. bootstrap placeholders contain: EXAMPLE good output hint.
8. Existing 110 tests green (existing cards with proper evidence sections unaffected; fixture cards already have proper format).
9. LIMITATIONS updated.