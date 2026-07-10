# Brief: claim deduplication + canonical form (§4.2)

## Goal

Дедупликация claims: detect + merge одинаковых/близких claims. Canonical form: нормализация text для сравнения. В рамках deterministic CLI — exact + near-exact matching (не semantic, semantic = LLM v0.4+).

## Scope (LIMITATIONS §4.2 — последние 2 пункта)

1. **нормализация claims (canonical form)** — `canonicalClaimText(text): string` — lowercase, strip punctuation, collapse whitespace, remove stopwords. Deterministic, не semantic.
2. **дедупликация похожих claims** — два уровня:
   - **Within-spec**: `extractClaims` может извлечь дубли (один heading + один bullet с тем же text) → dedup при ingest.
   - **Cross-card**: одинаковые claims в разных card'ах (proposal + historical описывают одно и то же) → detect при reconcile.

## Non-goals

- semantic deduplication (понимание "MUST filter" = "shall filter" = "filters") — LLM v0.4+.
- claim → module/scenario/decision auto-linking (§4.2, optional fields не автозаполняются).
- cross-document topic graph (§4.5, done separately).
- merge strategy complexity (choosing which claim to keep) — простая: first-wins, merge evidence.

## Constraints

- `ClaimSchema` в `claim.ts` — id, text, type, module?, scenario?, decision?, evidence_required, source_path?.
- `StoredClaimSchema` = Claim + evidence? + last_checked?.
- Claims хранятся в frontmatter `claims[]` (B2 done).
- `extractClaims(content, path) → Claim[]` в `specClassification.ts`.
- `ingestSpec` builds `storedClaims` and writes to cards.
- `reconcile` re-checks stored claims, `--fix` updates evidence.
- `updateMemoryCard` — safe way to update claims field.

## Testable acceptance criteria

1. `canonicalClaimText("The Registry MUST filter cards")` === `canonicalClaimText("the registry must filter cards.")` → same canonical form.
2. `dedupClaims` — два claims с одинаковым canonical text → merge в один (first-wins, merge evidence если есть).
3. `ingestSpec` deduplicates claims within each spec before storing → no duplicate claim ids in card.
4. `reconcile` detects cross-card duplicate claims → `duplicateClaims[]` in report (cardIdA, claimIdA, cardIdB, claimIdB, canonicalText).
5. Cards без claims → skip dedup (backward compat).
6. Существующие 83 тестов зелёные.
7. LIMITATIONS §4.2 — последние 2 пункта перенесены в Реализовано.