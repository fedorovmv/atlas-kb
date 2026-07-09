# Brief: reconcile --fix mode

## Goal

Реализовать `reconcile --fix` — режим, в котором reconcile не только отччитывает о проблемах (read-only), но и применяет безопасные фиксы к memory bank: обновляет `conflicts.md`, `open-questions.md` и помечает stale proposal cards.

## Scope (v0.3 reconcile enhancements, LIMITATIONS.md §6)

1. **stale proposal detection** — proposal cards, у которых `last_reviewed` старше N дней (default 90) и ни одного `code_confirmed`/`test_confirmed` evidence → candidate for deprecation.
2. **automatic conflict/open-question update** — append findings из reconcile в `memory/reconciliation/conflicts.md` и `memory/reconciliation/open-questions.md` (append-only, не clobber).
3. **safe memory patch generation** — структурированный patch report, который показывает что будет изменено до записи.
4. **`--fix` mode** — CLI флаг, переключает read-only → apply. Без `--fix` reconcile остаётся read-only (обратно совместимо).

## Non-goals

- semantic code evidence / symbol analysis (§4.3, v0.4+).
- claim storage в memory-файлах (§4.2, отдельный блокер B2).
- `conflicts.md` inter-document comparison (§4.5).
- автоматическое удаление proposal cards — только пометка `status: needs_review` + заметка в body.
- `--dry-run` для --fix (reconcile без --fix уже read-only = естественный preview).

## Constraints (из discovery)

- `ReconcileReport` сейчас возвращает `string[]` для каждой категории (`"<id>: <detail>"`). Для --fix нужны card references — расширить тип, не ломая существующий JSON output.
- `conflicts.md`/`open-questions.md` — append-only через `appendFile` (паттерн из `ingestSpec.ts:59-66`), НЕ через `writeCard` (который clobber'ит).
- `updateMemoryCard(id, { fields, body })` (`src/core/updateMemory.ts`) — единственный безопасный способ мутировать card frontmatter+body.
- `shouldSkipExisting` в bootstrap НЕ применяется к reconciliation files при --fix (они enrich'атся append'ом).
- Commander.js: `.option("--fix", "apply fixes", false)` (паттерн из `init --force`).
- Reconcile без `--fix` — **полная обратная совместимость**: тот же JSON shape, тот же text output.
- Stale proposal detection требует `last_reviewed` дату — поле есть в схеме (`frontmatter.ts:95`), формат `YYYY-MM-DD`.

## Testable acceptance criteria

1. `reconcile` без `--fix` — поведение не изменилось, 40/40 тестов зелёные.
2. `reconcile --fix` при наличии stale refs → `open-questions.md` содержит записи о stale refs (append, frontmatter сохранён).
3. `reconcile --fix` при наличии weak current claims → `conflicts.md` содержит записи о weak evidence (append).
4. `reconcile --fix` при наличии stale proposal (last_reviewed > 90 дней, evidence=spec_only) → card frontmatter `status: needs_review`, body содержит "Stale proposal — flagged by reconcile", `last_reviewed` обновлён до сегодня.
5. `reconcile --fix` без findings → никаких изменений в memory, exit 0.
6. `reconcile --fix --json` → JSON содержит `appliedFixes: string[]` со списком применённых фиксов.
7. Reconcile read-only test (`test/reconcile.test.ts:30-39`) остаётся зелёным (без `--fix` ничего не пишется).
8. Интеграционный E2E (`test/integration.test.ts:73-77`) остаётся зелёным (использует `reconcile --json` без --fix).
9. Новые тесты покрывают: stale proposal detection, conflicts.md append, open-questions.md append, --fix idempotent (повторный запуск не дублирует записи).