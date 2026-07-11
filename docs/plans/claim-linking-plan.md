# Plan: claim → module/scenario/decision auto-linking

3 tasks, sequential.

## Task 1: linkClaimsToCards function

**Files:** `src/core/claimLinking.ts` (NEW), `test/claimLinking.test.ts` (NEW)

**Steps:**
1. Create `src/core/claimLinking.ts`:
```typescript
import type { StoredClaim } from "../schemas/claim.js";
import type { MemoryCard } from "./types.js";
import { canonicalClaimText } from "./claimDedup.js";

export function linkClaimsToCards(
  claims: StoredClaim[],
  cards: MemoryCard[]
): StoredClaim[]
```
2. For each claim, find matching cards:
   - **Module match**: claim canonical text contains module card title (canonical) OR module card aliases OR module card id. Also: claim source_path matches a card's source_refs path.
   - **Scenario match**: same logic, entity_type === "scenario".
   - **Decision match**: same logic, entity_type === "decision".
3. Matching algorithm (for each entity_type):
   - Get candidate cards: `cards.filter(c => c.meta.entity_type === type)`.
   - For each candidate: compute match score:
     - +3 if claim.source_path === candidate source_refs[].path
     - +2 if canonicalClaimText(claim.text) contains canonicalClaimText(candidate.meta.title)
     - +1 if candidate.meta.aliases contains canonical claim text token
     - +1 if claim.text contains candidate.meta.id
   - If best score ≥ 2 → set claim.module/scenario/decision = candidate.meta.id.
4. Return claims with module/scenario/decision filled where matched.

**Tests — `test/claimLinking.test.ts`:**
- "links claim to module by title match" — claim text "Registry filters cards", module card title "Agent & Tool Registry" → claim.module = module id.
- "links claim to module by source_path match" — claim source_path = "specs/2027.md", card source_refs = [{path: "specs/2027.md"}] → linked.
- "links claim to decision by title" — claim text mentions "discovery not orchestration", decision card title matches → claim.decision = decision id.
- "no link when no match" — claim about "quantum computing", no matching cards → module/scenario/decision undefined.
- "links multiple types" — claim matches both module and scenario → both fields set.

**Completion:** `npx vitest run test/claimLinking.test.ts` green.

---

## Task 2: ingestSpec integration + reconcile broken link detection

**Files:** `src/commands/ingestSpec.ts`, `src/core/reconcile.ts`, `test/ingest-spec.test.ts`, `test/reconcile.test.ts`

**Steps:**
1. `ingestSpec.ts` — after `dedupClaims(storedClaims)`, before writing card:
   ```typescript
   import { linkClaimsToCards } from "../core/claimLinking.js";
   const linkedClaims = linkClaimsToCards(dedupedClaims, memory);
   ```
   Use `linkedClaims` instead of `dedupedClaims` in card frontmatter.
   Note: `memory` already loaded at line 48 — existing cards available for matching.

2. `reconcile.ts` — add to ReconcileReport:
   ```typescript
   brokenClaimLinks?: { cardId: string; claimId: string; field: string; targetId: string }[];
   ```
   In per-card loop: for each claim with module/scenario/decision set, check if target card exists. If not → push to brokenClaimLinks.

3. `commands/reconcile.ts` — add output section for brokenClaimLinks.

**Tests:**
- `test/ingest-spec.test.ts`: "ingestSpec links claims to existing modules" — create temp project with module card, ingest spec with claim matching module title → claim.module set in created card.
- `test/reconcile.test.ts`: "reconcile detects broken claim link" — card with claim.module = "nonexistent" → brokenClaimLinks in report.

**Completion:** `npx vitest run` all green.

---

## Task 3: Документация — LIMITATIONS §4.2

Move last "Не реализовано" item to Реализовано:
- "связь claim → module/scenario/decision (auto-linking при ingestSpec по title/source_path match; reconcile проверяет broken links)"

§4.2 becomes fully implemented (except semantic dedup which is LLM v0.4+).

**Completion:** diff, tests green.