# Plan: claim storage в frontmatter + re-check при reconcile

4 задачи, последовательные. Task 2 зависит от схемы Task 1; Task 3 зависит от функции reconcile Task 2; Task 4 — docs post-impl.

## Task 1: StoredClaimSchema + frontmatter extension

**Outcome:** `StoredClaimSchema` определён; `MemoryFrontmatterSchema` имеет optional `claims` поле; backward compat сохранён.

**Files:** `src/schemas/claim.ts`, `src/schemas/frontmatter.ts`

**Steps:**
1. В `src/schemas/claim.ts` добавить `StoredClaimSchema`:
   ```typescript
   export const StoredClaimSchema = ClaimSchema.extend({
     evidence: EvidenceSchema.optional().default({
       claim_id: "", status: "not_checked", confidence: "unknown", files: [], notes: []
     }),
     last_checked: z.string().optional(), // YYYY-MM-DD
   });
   export type StoredClaim = z.infer<typeof StoredClaimSchema>;
   ```
   Примечание: `evidence.claim_id` дублирует claim id — при сохранении заполнять = claim.id.
2. В `src/schemas/frontmatter.ts`:
   - Импортировать `StoredClaimSchema` из `./claim.js`.
   - Добавить поле в `MemoryFrontmatterSchema`: `claims: z.array(StoredClaimSchema).optional().default([])`.
   - Поле ставится ДО `.passthrough()` — но т.к. уже optional+default, существующие cards без `claims` парсятся в `[]`.
3. Убедиться что `MemoryFrontmatter` type (exported inference) включает `claims`.

**Tests-first:**
- `test/frontmatter.test.ts` (новый, если нет — иначе добавить):
  - "parses card without claims field → claims defaults to []" — frontmatter YAML без claims → `meta.claims` === `[]`.
  - "parses card with claims field → structured claims" — YAML с claims массивом → `meta.claims` массив StoredClaim с evidence.
  - "rejects invalid claim (missing id)" — claim без `id` → zod error.

**Completion evidence:** `npx vitest run` — 49 существующих + новые зелёные.

---

## Task 2: ingestSpec сохраняет claims в card frontmatter

**Outcome:** Все 4 ветки ingestSpec пишут `claims[]` (со stored evidence) в frontmatter создаваемых card'ов.

**Files:** `src/commands/ingestSpec.ts`

**Steps:**
1. После `extractClaims` + `checkEvidence` (line ~44) построить `storedClaims: StoredClaim[]`:
   - Для каждого `claim` найти соответствующий `evidence` по `claim_id === claim.id`.
   - Объединить: `{ ...claim, evidence: { ...evidence, claim_id: claim.id }, last_checked: today }`.
2. Добавить `claims: storedClaims` в каждый frontmatter-объект перед `frontmatterYaml()`:
   - historical (line 50)
   - proposal/unconfirmed (line 53)
   - proposal/confirmed (line 56)
   - Для conflict branch (line 59-65) — card не создаётся, только append в conflicts.md — там claims не нужны (в отчёте уже `claims.length`).
3. Убедиться что `yaml.dump` корректно сериализует вложенные объекты (claims → evidence).

**Tests-first:**
- `test/ingest-spec.test.ts` — добавить:
  - "current_confirmed spec creates card with stored claims + evidence" — запустить ingestSpec, прочитать созданный card, распарсить frontmatter, assert `meta.claims.length > 0`, `meta.claims[0].evidence.status === "confirmed_by_code"`, `meta.claims[0].last_checked` — дата.
  - "proposed_unconfirmed spec creates card with claims, evidence not_checked/not_found" — assert `meta.claims[0].evidence.status` in `["not_found", "not_checked", "documented_only"]`.

**Completion evidence:** `npx vitest run` — все зелёные.

---

## Task 3: reconcile claim re-check + --fix updates stored evidence

**Outcome:** `reconcile` детектит changed claim evidence; `--fix` обновляет stored evidence в card frontmatter.

**Files:** `src/core/reconcile.ts`, `src/core/reconcileFix.ts`

**Steps:**
1. В `src/core/reconcile.ts`:
   - Расширить `ReconcileReport`: `changedClaimEvidence?: { cardId: string; claimId: string; oldStatus: string; newStatus: string }[]`.
   - В per-card loop (после line 68): если `card.meta.claims` непустой — re-run `checkEvidence(card.meta.claims, discovery)`.
   - Для каждого claim: сравнить `newEvidence.status` с `storedClaim.evidence.status`. Если изменился → push в `changedClaimEvidence`.
   - Импортировать `checkEvidence` из `./specClassification.js`.
2. В `src/core/reconcileFix.ts`:
   - Добавить `claimsUpdated: string[]` в `AppliedFixes`.
   - Для каждого changed claim: обновить evidence в stored claim (через `updateMemoryCard` с `fields: { claims: updatedClaims }` где updatedClaims — массив с обновлёнными evidence + last_checked).
   - Idempotency: если stored evidence уже совпадает с new evidence → skip (но это уже покрыто тем что changedClaimEvidence только при расхождении).

**Tests-first:**
- `test/reconcile.test.ts`:
  - "reconcile detects changed claim evidence after code deletion" — bootstrap, ingestSpec (card с claims confirmed_by_code), delete code file, reconcile → `report.changedClaimEvidence.length > 0`, oldStatus="confirmed_by_code", newStatus="not_found".
  - "reconcile skips cards without claims" — bootstrap only → `changedClaimEvidence: []`.
- `test/reconcileFix.test.ts`:
  - "reconcile --fix updates stored claim evidence" — setup как выше, applyReconcileFixes, прочитать card → `meta.claims[0].evidence.status === "not_found"`, `last_checked` обновлён.
- `test/cli.test.ts`:
  - "reconcile --fix updates claim evidence via CLI" — E2E через CLI.

**Completion evidence:** `npx vitest run` — все зелёные (49 + новые).

---

## Task 4: Документация — LIMITATIONS.md §4.2 + §6

**Outcome:** LIMITATIONS.md обновлён.

**Files:** `docs/LIMITATIONS.md`

**Steps:**
1. §4.2 "Claim model — частично реализована": перенести из "Не реализовано" в "Реализовано":
   - хранение claims в memory-файлах
   - claim evidence storage в frontmatter
   - повторная проверка claims при reconcile
2. §6 v0.2 "Не выполнено (перенесено в v0.2+)": отметить ✅ для:
   - claim storage в memory-файлах
   - claim re-check при reconcile
3. Оставить в "Не реализовано": дедупликация, нормализация, semantic extraction.

**Completion evidence:** diff показывает обновление, тесты зелёные.

---

## Risk / rollback

- **Risk:** frontmatter schema change ломает существующие cards → митигировано optional+default, `.passthrough()` сохраняет unknown fields.
- **Risk:** yaml.dump некорректно сериализует nested claims → митигировано тестом round-trip (write → read → compare).
- **Rollback:** `git revert` — изменения изолированы: schema + ingestSpec + reconcile + docs.