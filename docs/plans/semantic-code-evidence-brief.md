# Brief: semantic code evidence — "does code implement spec intent"

## Goal

LLM-агенты проверяют не только существование symbols, но и semantic intent: "делает ли функция то, что spec утверждает". Не "Function X exists at file:line" — а "Function X implements caller-based filtering by checking service identity against access policy map, which matches spec claim 'registry MUST filter by caller'".

## Problem

memory-coder сейчас:
- ✅ "Function FilterCardsForCaller at internal/registry/access_filter.go:12" — symbol exists
- ❌ Не проверяет: "does this function actually filter BY CALLER, or does it filter by something else?"

Spec claim: "Registry MUST filter cards by caller service identity"
Code: `func FilterCardsForCaller(caller string) []string` — symbol exists, но может фильтровать по role, не по caller identity. memory-coder ставит code_confirmed, но semantic intent не verified.

## Scope

1. **memory-coder instruction upgrade** — добавить semantic verification step:
   - После нахождения symbol → прочитать его implementation
   - Сравнить behavior с claim text по смыслу
   - Evidence entry формат: `- <claim_text> — verified: <function> at <file>:<line> implements this by <how it works>`
   - Если symbol существует, но behavior НЕ соответствует claim → `conflicts_with_code` (не `code_confirmed`)
2. **memory-analyst instruction upgrade** — semantic claim vs code intent matching:
   - Для partial implementation detection: "claim X is PARTIALLY implemented — function exists but only handles subset of cases"
   - Для conflict detection: "claim X CONFLICTS with code — function does opposite of what spec says"
3. **Evidence status expansion** — `conflicts_with_code` уже в enum, но agent instructions не описывают когда его ставить. Добавить explicit guidance.
4. **validate acceptance** — `## Code evidence` entries с `conflicts_with_code` → body должен содержать `## Conflicts` section с объяснением.

## Non-goals

- AST parsing (CLI stays keyword-based, LLM reads code)
- Automated semantic analysis without LLM
- Cross-function call graph verification

## Testable acceptance criteria

1. memory-coder instruction: semantic verification step с format `verified: <function> at <file>:<line> implements this by <how>`.
2. memory-coder instruction: `conflicts_with_code` guidance — "if symbol exists but does OPPOSITE of claim → set conflicts_with_code, add ## Conflicts section".
3. memory-analyst instruction: partial implementation detection format.
4. validate: `evidence_level: conflicts_with_code` (if used) → `## Conflicts` section required. Actually — conflicts_with_code is an Evidence status, not evidence_level. Check schema.
5. Existing 115 tests green.
6. LIMITATIONS §4.3 updated — semantic verification via LLM documented.