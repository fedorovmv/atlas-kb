# Plan: claim deduplication + canonical form

3 tasks, sequential.

## Task 1: canonicalClaimText + dedupClaims

**Files:** `src/core/claimDedup.ts` (NEW), `test/claimDedup.test.ts` (NEW)

**Steps:**
1. `canonicalClaimText(text: string): string`:
   - lowercase
   - replace punctuation with spaces
   - remove stopwords (the, a, an, must, shall, should, will, is, are, be, of, to, in, for, on, by, this, that, with, from, as, at, it)
   - collapse whitespace
   - trim
2. `dedupClaims(claims: StoredClaim[]): StoredClaim[]`:
   - Group by canonical form of `text`.
   - First-wins: keep first claim in group, merge evidence (if later claim has evidence and first doesn't, copy).
   - Return deduplicated array.
3. `findCrossCardDuplicates(cards: MemoryCard[]): { cardIdA: string; claimIdA: string; cardIdB: string; claimIdB: string; canonicalText: string }[]`:
   - For each pair of cards that have claims, find claims with same canonical form.
   - Return report entries.

**Tests:**
- canonical: same text different case/punctuation → equal
- canonical: different text → not equal
- dedupClaims: 3 claims, 2 identical → 2 result, evidence merged
- dedupClaims: 3 unique claims → 3 result
- findCrossCardDuplicates: 2 cards with same claim → 1 duplicate entry
- findCrossCardDuplicates: 2 cards different claims → empty

**Completion:** `npx vitest run test/claimDedup.test.ts` green.

---

## Task 2: ingestSpec within-spec dedup + reconcile cross-card detection

**Files:** `src/commands/ingestSpec.ts`, `src/core/reconcile.ts`, `test/ingest-spec.test.ts`, `test/reconcile.test.ts`

**Steps:**
1. `ingestSpec.ts` — after `extractClaims` + `checkEvidence`, before building `storedClaims`:
   - Call `dedupClaims` on the claims array (but it needs evidence — so build storedClaims first, then dedup).
   - Actually: build storedClaims (claim + evidence), then `dedupClaims(storedClaims)`, then write to card.
   - Adjust claim IDs if needed (renumber after dedup).
2. `reconcile.ts`:
   - Add `duplicateClaims?: { cardIdA: string; claimIdA: string; cardIdB: string; claimIdB: string; canonicalText: string }[]` to ReconcileReport.
   - Call `findCrossCardDuplicates(cards)` → populate field.

**Tests:**
- ingestSpec: spec with duplicate headings → card has deduped claims (no duplicate canonical text)
- reconcile: two cards with same claim text → `report.duplicateClaims.length > 0`

**Completion:** `npx vitest run` all green.

---

## Task 3: Документация — LIMITATIONS §4.2

**Files:** `docs/LIMITATIONS.md`

**Steps:**
1. §4.2 — move last 2 items from "Не реализовано" to "Реализовано":
   - дедупликация похожих claims (within-spec + cross-card detection)
   - нормализация claims (canonical form — deterministic, не semantic)
2. Note: semantic dedup remains v0.4+ (LLM).

**Completion:** diff, tests green.