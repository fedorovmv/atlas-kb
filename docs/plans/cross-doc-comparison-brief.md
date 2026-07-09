# Brief: cross-document comparison (§4.5)

## Goal

Сравнивать несколько spec-документов между собой для построения relations: `supersedes`, `superseded_by`, `conflicts_with`, `related_specs`. Сейчас ingestSpec обрабатывает каждый spec независимо; relations поля пустые.

## Scope (LIMITATIONS §4.5 — 4 из 6 пунктов)

1. **сравнение нескольких спек по одной теме** — topic overlap между spec-derived cards (proposal/historical).
2. **определение supersedes** — старая спека (Status: deprecated + year в filename) → новая спека на ту же тему → populate `supersedes`/`superseded_by`.
3. **построение relations** — `supersedes`, `superseded_by`, `conflicts_with`, `related_specs` (card IDs).
4. **автоматическое обновление conflicts.md** — при обнаружении конфликта между спеками append в `reconciliation/conflicts.md`.

## Non-goals

- извлечение общей topic graph (§4.5, отдельная задача — нужен graph export v0.4).
- semantic conflict detection (A says X MUST, B says X MUST NOT — требует NLP, v0.4+).
- relation types `proposes`, `motivates`, `implements`, `tests` — оставляем только `supersedes`/`superseded_by`/`conflicts_with`/`related_specs` (остальные требуют semantic understanding).
- изменение `classifySpecActuality` — переиспользуется as-is.
- claim deduplication (§4.2, отдельная задача).

## Constraints (из discovery)

- Relation fields (`supersedes`, `superseded_by`, `conflicts_with`, `related_specs`) — `string[]` of card IDs (NOT file paths). Уже в schema, optional+default([]).
- `extractSpecTopics(path, content)` в `specClassification.ts:51-56` — готовая функция, возвращает `string[]` topics из path+headings.
- `tokenize(input)` в `score.ts:3-5` — готовая функция для token extraction.
- `updateMemoryCard(id, { fields })` — безопасный способ обновить relation поля.
- `ingestSpec` main loop (lines 42-77) — каждый spec processed независимо. Нужен post-loop pass для cross-comparison.
- `relations.ts` — только read utilities (`getDirectRelatedIds`, `getReverseRelated`, `getRelatedCards`). Нужен новый write/detect function.
- `conflicts.md` append pattern — из `reconcileFix.ts:61-77` (idempotent append).
- Fixture: `2025-agent-routing.md` (deprecated, historical) + `2027-agent-tool-registry.md` (accepted, proposal) — идеальные кандидаты для supersedes detection (2025 explicitely says "replaced by ... 2027").

## Testable acceptance criteria

1. `ingestSpec` с двумя спеками на одну тему (2025 deprecated + 2027 accepted) → post-comparison pass populate `superseded_by` на 2025 card, `supersedes` на 2027 card.
2. `ingestSpec` с двумя спеками на одну тему, обе current → `conflicts_with` на обеих cards + append в `reconciliation/conflicts.md`.
3. `ingestSpec` с двумя спеками на разные темы → no relations, no changes.
4. `ingestSpec` со спекой имеющей explicit "replaces"/"supersedes" reference → populate relation even без topic overlap.
5. Topic overlap detection: Jaccard ≥ 0.3 (configurable) → `related_specs`.
6. Существующие 59 тестов зелёные (backward compat: cards без relations → fields stay []).
7. Reconcile detects broken relations: card has `supersedes: [id]` but target card doesn't exist → report in `brokenRelations[]`.
8. Новые тесты: supersedes detection, conflict detection, related_specs via topic overlap, broken relations in reconcile, multi-spec fixture.
9. LIMITATIONS.md §4.5 обновлён — 4 пункта перенесены в "Реализовано".