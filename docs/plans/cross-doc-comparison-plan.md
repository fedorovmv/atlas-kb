# Plan: cross-document comparison (§4.5)

4 tasks, sequential. Task 2 depends on Task 1's relation detector. Task 3 depends on Task 2's ingestSpec integration. Task 4 — docs post-impl.

## Task 1: detectSpecRelations — cross-spec comparison engine

**Outcome:** New function `detectSpecRelations(cards, options)` returns detected relations between spec-derived cards.

**Files:** `src/core/specRelations.ts` (NEW), `test/specRelations.test.ts` (NEW)

**Steps:**
1. Create `src/core/specRelations.ts`:
```typescript
import type { MemoryCard } from "./types.js";
import { extractSpecTopics } from "./specClassification.js";
import { tokenize } from "./score.js";

export type DetectedRelation = {
  fromId: string;
  toId: string;
  type: "supersedes" | "conflicts_with" | "related_specs";
  reason: string;
  confidence: "high" | "medium" | "low";
};

export function detectSpecRelations(
  cards: MemoryCard[],
  options: { topicThreshold?: number } = {}
): DetectedRelation[]
```

2. Filter to spec-derived cards: `entity_type === "proposal" || entity_type === "historical"`.
3. For each pair (A, B):
   - **Topic overlap (Jaccard):** compute `extractSpecTopics(A.body)` ∩ `extractSpecTopics(B.body)` / union. If Jaccard ≥ threshold (default 0.3) → `related_specs`.
   - **Supersedes detection:** A is historical/deprecated + B is proposal/accepted on same topic (Jaccard ≥ threshold OR explicit "replaces"/"supersedes" keyword in B.body referencing A) → `supersedes` (B → A) + `superseded_by` (A → B).
     - Signals: `A.meta.status === "historical" || A.body.includes("deprecated")`, year in filename (regex `\b(20\d{2})\b`), A year < B year.
   - **Conflict detection:** A and B both `status: current` or both accepted + same topic → `conflicts_with` bidirectional.
4. Return `DetectedRelation[]`. Deduplicate: if (A,B) supersedes already detected, don't also emit related_specs for same pair.

**Tests-first — `test/specRelations.test.ts`:**
- "detects supersedes: deprecated historical → accepted proposal on same topic" — two cards, 2025 historical + 2027 proposal, same topic "agent registry" → `supersedes` from 2027 to 2025.
- "detects conflicts_with: two current specs on same topic" — two cards both `status: current`, same topic → `conflicts_with` bidirectional.
- "detects related_specs via topic overlap" — two proposal cards, Jaccard ≥ 0.3 → `related_specs`.
- "no relations for different topics" — two cards, disjoint topics → empty result.
- "explicit 'replaces' reference overrides topic threshold" — card B body contains "replaces" + card A title/id → `supersedes` even if low Jaccard.

**Completion evidence:** `npx vitest run test/specRelations.test.ts` green.

---

## Task 2: ingestSpec post-comparison pass + conflicts.md append

**Outcome:** After ingesting all specs, ingestSpec runs cross-comparison and updates relation fields + appends conflicts.

**Files:** `src/commands/ingestSpec.ts`, `test/ingest-spec.test.ts`

**Steps:**
1. After the main `for...of specPaths` loop (line ~77), add post-comparison pass:
   - Reload memory cards (`loadMemoryCards(options)`) to include newly created cards.
   - Call `detectSpecRelations(cards, { topicThreshold })`.
   - For each `DetectedRelation`: use `updateMemoryCard(id, { fields: { [type]: [...existing, toId] } })` to add relation. Read existing field first, append (dedup).
   - For `conflicts_with` relations: append to `reconciliation/conflicts.md` (idempotent, pattern from reconcileFix.ts).
2. Add `topicThreshold?: number` to options (default 0.3), pass through.
3. Import `detectSpecRelations` from `../core/specRelations.js`, `loadMemoryCards` + `findCardById` from `./loadMemory.js`, `updateMemoryCard` from `./updateMemory.js`.

**Tests-first — `test/ingest-spec.test.ts`:**
- "ingests two specs on same topic → supersedes/superseded_by populated" — write 2025 deprecated spec + 2027 accepted spec to temp, ingestSpec, read both cards, assert `superseded_by` on 2025, `supersedes` on 2027.
- "ingests two current specs on same topic → conflicts_with + conflicts.md updated" — write two accepted specs, ingest, assert `conflicts_with` on both, `conflicts.md` contains conflict note.
- "ingests specs on different topics → no relations" — two disjoint specs, assert relation fields empty.

**Completion evidence:** `npx vitest run` — 59 + new green.

---

## Task 3: reconcile broken relations detection

**Outcome:** Reconcile detects broken relation links (card references non-existent ID) → `brokenRelations[]` in report.

**Files:** `src/core/reconcile.ts`, `test/reconcile.test.ts`

**Steps:**
1. Extend `ReconcileReport`:
```typescript
brokenRelations?: { cardId: string; field: string; targetId: string }[];
```
2. In reconcileMemory per-card loop: for each relation field (`supersedes`, `superseded_by`, `conflicts_with`, `related_specs`), check if each target ID exists in the full card set. If not → push to `brokenRelations`.
3. Use `RELATION_FIELDS` from `relations.ts` (filter to the 4 we care about: supersedes, superseded_by, conflicts_with, related_specs).

**Tests-first — `test/reconcile.test.ts`:**
- "reconcile detects broken supersedes link" — create card with `supersedes: ["nonexistent-id"]`, reconcile, assert `report.brokenRelations.length > 0`, `brokenRelations[0].targetId === "nonexistent-id"`.
- "reconcile no broken relations when links valid" — two cards with valid `related_specs`, assert `brokenRelations: []`.

**Completion evidence:** `npx vitest run` — all green.

---

## Task 4: Документация — LIMITATIONS.md §4.5 + §6

**Files:** `docs/LIMITATIONS.md`

**Steps:**
1. §4.5 — move to "Реализовано" (create section header change from "не реализована" to "частично реализована"):
   - сравнение нескольких спек по одной теме ✅
   - определение supersedes ✅
   - построение relations (supersedes/superseded_by/conflicts_with/related_specs) ✅
   - автоматическое обновление conflicts.md ✅
   Keep in "Не реализовано":
   - извлечение общей topic graph (v0.4 graph export)
   - semantic conflict detection (NLP, v0.4+)
   - relation types proposes/motivates/implements/tests (требуют semantic)
2. §6 — add cross-document comparison as completed (mark in v0.2+ or new entry).

**Completion evidence:** diff shows updates, tests green.

---

## Risk / rollback

- **Risk:** false positive supersedes (two specs on same topic, different intent) → митигировано threshold 0.3 + explicit signals (deprecated status, year, "replaces" keyword).
- **Risk:** updateMemoryCard overwrites existing relations → митигировано read-before-append dedup.
- **Rollback:** `git revert` — isolated in new specRelations.ts + ingestSpec post-loop + reconcile extension.