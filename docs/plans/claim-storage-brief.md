# Brief: claim storage в frontmatter + re-check при reconcile

## Goal

Сохранять claims и их evidence в frontmatter memory-card'ов (сейчас claims runtime-only, discarded после `ingestSpec`). Добавить re-check claims при `reconcile`: повторный `checkEvidence` + отчёт о рассинхроне evidence status.

## Scope (LIMITATIONS §4.2 "Не реализовано" — 3 из 6 пунктов)

1. **хранение claims в memory-файлах** — `claims[]` YAML-массив в frontmatter card'а, каждый claim со своим evidence.
2. **claim evidence storage в frontmatter** — evidence status сохраняется рядом с claim, не только runtime.
3. **повторная проверка claims при reconcile** — `reconcile` читает stored claims, re-runs `checkEvidence`, сообщает changed evidence. При `--fix` обновляет stored evidence.

## Non-goals

- дедупликация похожих claims (§4.2, отдельная задача, требует canonical form).
- нормализация claims / canonical form (§4.2).
- semantic claim extraction (§4.1, v0.4+).
- claim → module/scenario/decision linking (ClaimSchema уже имеет optional `module`/`scenario`/`decision` поля — заполняются только при наличии сигнала, отдельная задача).
- изменение `extractClaims` или `checkEvidence` — переиспользуются as-is.

## Constraints (из discovery)

- `ClaimSchema` и `EvidenceSchema` уже в `src/schemas/claim.ts` — переиспользовать, не дублировать.
- Нужен `StoredClaimSchema` = Claim + embedded evidence + `last_checked` дата.
- `MemoryFrontmatterSchema` имеет `.passthrough()` — добавление `claims` optional с `default([])` backward-compat со всеми существующими card'ами.
- `ingestSpec.ts` — единственное место где claims извлекаются; card'ы создаются через `frontmatterYaml(data)` — просто добавить `claims` в data объект.
- `reconcile.ts` уже загружает cards через `loadMemoryCards` и discovery через `discoverProject` — всё для re-check есть.
- `updateMemoryCard(id, { fields })` — безопасный способ обновить `claims` field при `--fix`.
- `checkEvidence(claims, discovery)` принимает `Claim[]` — stored claims (без evidence) можно передать напрямую, т.к. `ClaimSchema` поля subset of `StoredClaimSchema`.

## Testable acceptance criteria

1. `ingestSpec` для actual current/partially confirmed — создаёт card с `claims[]` в frontmatter, каждый claim имеет `evidence.status`, `evidence.confidence`, `evidence.files`, `last_checked`.
2. `ingestSpec` для proposed_unconfirmed/unknown — создаёт card с `claims[]` (evidence status `not_checked` или `not_found`).
3. `ingestSpec` для historical — card имеет `claims[]` (evidence может быть `documented_only`).
4. Существующие 49 тестов зелёные (backward compat: cards без `claims` поля → `meta.claims === []`).
5. `reconcile` читает `card.meta.claims`, re-runs `checkEvidence`, сравнивает stored evidence.status с новым → `changedClaimEvidence[]` в ReconcileReport.
6. `reconcile --fix` обновляет stored evidence в card frontmatter (через `updateMemoryCard` с `fields: { claims: updatedClaims }`).
7. `reconcile` без findings по claims → `changedClaimEvidence: []`.
8. Cards без `claims` поля → пропускаются при claim re-check (не ошибка).
9. Новые тесты: claim storage round-trip (ingest → card имеет claims), claim re-check detect change (bootstrap → ingest → delete code file → reconcile → changed evidence), --fix updates stored evidence.
10. LIMITATIONS.md §4.2 обновлён — 3 пункта перенесены в "Реализовано".