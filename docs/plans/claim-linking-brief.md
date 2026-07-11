# Brief: claim → module/scenario/decision auto-linking (§4.2)

## Goal

Автозаполнение `module`/`scenario`/`decision` полей в claims при ingestSpec. Matching: claim canonical text ↔ card titles/ids/topics. Закрывает §4.2 полностью.

## Scope (LIMITATIONS §4.2 — последний "Не реализовано" пункт)

1. **linkClaimsToCards** — функция: для каждого claim ищет matching module/scenario/decision card по:
   - claim.source_path ↔ card source_refs
   - claim canonical text ↔ card title/aliases/topics
   - claim text contains card id or title
2. **ingestSpec integration** — после dedupClaims, перед записью: вызывать linkClaimsToCards, заполнять module/scenario/decision поля.
3. **reconcile re-link** — при reconcile проверять что claim.module/scenario/decision указывает на существующий card. Если нет → brokenLinks report.

## Non-goals

- semantic matching (понимание "claim про registry" = "module про agent registry" без keyword overlap — LLM v0.4+).
- auto-linking для claims созданных НЕ через ingestSpec (bootstrap claims — нет, bootstrap не создаёт claims).
- bidirectional: card.frontmatter не получает обратно список claim ids (claims уже в card frontmatter, этого достаточно).

## Constraints

- `ClaimSchema` поля: `module?: string`, `scenario?: string`, `decision?: string` — уже в схеме, optional.
- `StoredClaim` extends Claim — поля наследуются.
- `canonicalClaimText(text)` в `claimDedup.ts` — готовая функция для canonical form.
- Cards имеют `meta.id`, `meta.title`, `meta.aliases` (optional), `meta.product_areas` (optional), `meta.topics` (через discovery, не в frontmatter).
- `ingestSpec` уже загружает `memory` (existing cards) — есть для matching.
- `reconcile` уже загружает cards — есть для re-link verification.

## Testable acceptance criteria

1. Claim с text "Registry filters cards" + existing module card "agent-tool-registry" (title contains "registry") → claim.module = "agent-tool-registry".
2. Claim с source_path "specs/2027-agent-tool-registry.md" + card с source_refs containing same path → claim linked to that card.
3. Claim без matching card → module/scenario/decision остаются undefined.
4. ingestSpec: claims в созданном card имеют module/scenario/decision заполненные если match найден.
5. reconcile: claim.module = "nonexistent-id" → brokenClaimLinks в report.
6. Существующие 102 тестов зелёные.
7. LIMITATIONS §4.2 — последний пункт перенесён в Реализовано.