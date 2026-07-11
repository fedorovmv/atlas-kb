# Plan: semantic code evidence

2 tasks. Task 1: agent instructions upgrade. Task 2: docs.

## Task 1: memory-coder + memory-analyst semantic verification instructions

**Files:** `src/scaffold/templates.ts` only.

### memory-coder — add semantic verification step:

After existing "## Quality checklist" section, add:

```
## Semantic verification (beyond symbol existence)

After finding a symbol at file:line, you MUST verify the symbol's BEHAVIOR matches the claim's INTENT:

1. Read the function/method body — understand what it actually does.
2. Compare to the claim text:
   - Claim: "Registry MUST filter cards by caller service identity"
   - Code: func FilterCardsForCaller(caller string) — does it filter BY CALLER IDENTITY, or by something else (role, timestamp, etc.)?
3. If behavior matches claim intent:
   - Evidence entry: `- <claim_text> — verified: <function> at <file>:<line> implements this by <brief description of how>`
   - Example: `- "Registry filters by caller identity" — verified: FilterCardsForCaller at internal/registry/access_filter.go:12 implements this by checking caller service ID against access policy map`
   - Set evidence_level: code_confirmed
4. If symbol exists but behavior does NOT match claim intent:
   - Add `## Conflicts` section: `- <claim_text> — CONFLICTS: <function> at <file>:<line> does <actual behavior>, not <claimed behavior>`
   - Example: `- "Registry filters by caller identity" — CONFLICTS: FilterCardsForCaller at access_filter.go:12 filters by role, not by caller identity`
   - Set evidence status: conflicts_with_code (in claim.evidence.status)
   - Set evidence_level: inferred (not code_confirmed)
   - Add to reconciliation/conflicts.md
5. If symbol exists but only partially implements claim:
   - Evidence entry: `- <claim_text> — partial: <function> at <file>:<line> implements <subset>, but does not handle <missing part>`
   - Set evidence_level: inferred
   - Note missing part in ## Known risks or open-questions.md

DON'T just verify "function exists at line N" — verify "function at line N does what the claim says it does".
```

### memory-analyst — add partial implementation + conflict detection:

After existing "6. For partial implementation detection" section, expand:

```
### Partial implementation — semantic analysis:
For each claim with evidence:
- confirmed_by_code: claim is fully implemented — verify via memory-coder's semantic check
- not_found: claim is not implemented at all
- partial: claim is PARTIALLY implemented — some aspects in code, some missing
  - Example: spec says "MUST filter by identity AND log all access" — code filters by identity but doesn't log
  - Mark as partial in evidence report, note what's missing
- conflicts_with_code: code does something different from what spec claims
  - Example: spec says "MUST NOT cache" but code has `cache = true`
  - Flag as conflict, add to conflicts.md

Report format for reviewer:
- claim_id | status | evidence_summary | what's missing (if partial)
```

**Verify:** `npx vitest run` — 115 green (template text only).

## Task 2: LIMITATIONS §4.3 + §4.4 update

**Files:** `docs/LIMITATIONS.md`

§4.3 — move to Реализовано:
- semantic check (LLM: memory-coder reads function body, compares behavior to claim intent)
- conflicts_with_code (LLM: symbol exists but does opposite → conflicts_with_code + ## Conflicts section)
- evidence report по каждому claim (LLM: semantic verification format with reason)

§4.4 — move to Реализовано:
- выявление спеки, которая конфликтует с текущим кодом (LLM: memory-coder semantic check → conflicts_with_code)
- выявление частично реализованной спеки (LLM: memory-analyst partial implementation detection)

Keep in Не реализовано:
- CLI-side AST symbol analysis (by design — LLM does semantic, not CLI)
- automated без LLM (LLM required for semantic understanding)

**Completion:** diff, tests green.