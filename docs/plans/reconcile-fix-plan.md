# Plan: reconcile --fix mode

Tasks выстроены последовательно — каждая следующая зависит от типов/функций предыдущей. Параллелизм невозможен без конфликтов write ownership.

## Task 1: Расширить ReconcileReport + stale proposal detection

**Outcome:** `ReconcileReport` содержит структурированные findings с card references; добавлена категория `staleProposals`.

**Files:** `src/core/reconcile.ts`

**Steps:**
1. Расширить `ReconcileReport`:
   - Добавить необязательные структурированные поля: `staleRefsDetailed: { cardId: string; refPath: string }[]`, `weakCurrentClaimsDetailed: { cardId: string; evidenceLevel: string }[]`, `realizableProposalsDetailed: { cardId: string }[]`, `staleProposals: { cardId: string; lastReviewed: string; daysSinceReview: number }[]`.
   - Сохранить существующие `staleRefs: string[]` и т.д. для обратной совместимости — заполнять оба.
2. Добавить stale proposal detection: proposal card с `evidence_level: spec_only`/`inferred`/`unknown` И `last_reviewed` старше 90 дней (configurable через `options.staleProposalDays`, default 90).
3. Возвратить расширенный report. Существующий JSON output (`reconcile --json`) должен включать старые поля — проверить, что новые поля optional и не ломают парсинг.

**Tests-first:**
- `test/reconcile.test.ts`: добавить тест "reports stale proposals older than 90 days" — bootstrap, вручную установить `last_reviewed` на 100 дней назад, проверить `report.staleProposals.length > 0`.
- Тест "does not flag recent proposals as stale" — `last_reviewed` сегодня → `staleProposals.length === 0`.

**Completion evidence:** `npx vitest run test/reconcile.test.ts` зелёный, существующие 3 теста не сломаны.

---

## Task 2: applyReconcileFixes — генератор safe memory patch

**Outcome:** Функция `applyReconcileFixes(report, options)` применяет фиксы к memory и возвращает `AppliedFixes`.

**Files:** `src/core/reconcileFix.ts` (новый), `src/core/reconcile.ts` (re-export типа)

**Steps:**
1. Создать `src/core/reconcileFix.ts` с:
   ```typescript
   export type AppliedFixes = {
     conflictsAppended: string[];
     openQuestionsAppended: string[];
     proposalCardsUpdated: string[];
   };
   export async function applyReconcileFixes(
     report: ReconcileReport,
     options: RepoMemoryOptions
   ): Promise<AppliedFixes>
   ```
2. **open-questions.md append** — для `staleRefsDetailed` и `orphanModules`:
   - Формат: `\n- [reconcile {date}] Stale ref: card=<id>, path=<refPath>\n`
   - Использовать `appendFile` (паттерн из `ingestSpec.ts:59-66`).
   - Idempotency: перед append прочитать файл, проверить что строки с тем же `[reconcile {date}]` + `card=<id>` + `path=<refPath>` уже есть → skip.
3. **conflicts.md append** — для `weakCurrentClaimsDetailed`:
   - Формат: `\n- [reconcile {date}] Weak current evidence: card=<id>, evidence_level=<level>\n`
   - Тот же idempotency check.
4. **proposal card update** — для `staleProposals`:
   - Вызвать `updateMemoryCard(cardId, { fields: { status: "needs_review", last_reviewed: today }, body: existingBody + "\n\nStale proposal — flagged by reconcile on {date}. Evidence insufficient; review required." })`.
   - Прочитать существующий body через `loadMemoryCards` + `findCardById` (как делает `updateMemoryCard`).
5. Возвратить `AppliedFixes` с списками применённых фиксов.

**Tests-first:**
- `test/reconcileFix.test.ts` (новый):
  - "appends stale refs to open-questions.md" — bootstrap, delete file, applyReconcileFixes, прочитать `open-questions.md`, assert содержит "Stale ref: card=".
  - "appends weak current claims to conflicts.md" — создать current card с `evidence_level: spec_only`, applyReconcileFixes, assert `conflicts.md` содержит "Weak current evidence".
  - "marks stale proposals as needs_review" — создать proposal с `last_reviewed` 100 дней назад, applyReconcileFixes, прочитать card, assert `status: needs_review`, body содержит "Stale proposal".
  - "is idempotent — second run does not duplicate entries" — дважды вызвать applyReconcileFixes, сравнить содержимое файлов — идентично.
  - "does nothing when report is empty" — пустой report → `AppliedFixes` все массивы пустые, файлы не изменены.

**Completion evidence:** `npx vitest run test/reconcileFix.test.ts` зелёный.

---

## Task 3: CLI --fix flag + wiring + JSON output

**Outcome:** `reconcile --fix` применяет фиксы и печатает результат; `reconcile` без --fix не изменилось.

**Files:** `src/cli.ts`, `src/commands/reconcile.ts`

**Steps:**
1. `src/cli.ts` — добавить `.option("--fix", "apply safe fixes to memory", false)` к reconcile command, передать в options.
2. `src/commands/reconcile.ts`:
   - Добавить `fix?: boolean` в options тип.
   - Если `fix` — вызвать `applyReconcileFixes(report, options)` после `reconcileMemory`.
   - Text output: добавить секцию `## Applied fixes (N)` с списком.
   - JSON output: добавить `appliedFixes: AppliedFixes` в JSON.
   - Без `fix` — поведение не изменилось (обратная совместимость).
3. Не добавлять `--dry-run` — read-only режим без `--fix` уже естественный preview.

**Tests-first:**
- `test/cli.test.ts`: добавить тест "reconcile --fix updates open-questions.md" — запустить CLI с `--fix --json`, проверить JSON содержит `appliedFixes`, файл `open-questions.md` обновлён.
- `test/integration.test.ts`: проверить что существующий `reconcile --json` step (без --fix) остаётся зелёным — никаких изменений в E2E не нужно.

**Completion evidence:** `npx vitest run` — все тесты (40 + новые) зелёные.

---

## Task 4: Документация — LIMITATIONS.md + README

**Outcome:** LIMITATIONS.md §4.7 и §6 v0.3 обновлены; README упоминает `--fix`.

**Files:** `docs/LIMITATIONS.md`, `README.md`

**Steps:**
1. `docs/LIMITATIONS.md` §4.7 — перенести из "Не реализовано" в "Реализовано":
   - stale proposal detection;
   - automatic update `conflicts.md` и `open-questions.md`;
   - safe memory patch generation;
   - `--fix` mode.
   Сохранить в "Не реализовано" только то, что реально осталось (semantic evidence, claim storage).
2. `docs/LIMITATIONS.md` §6 v0.3 — отметить выполненные пункты ✅, оставить невыполненные.
3. `README.md` — в секции reconcile добавить упоминание `--fix` флага.

**Completion evidence:** diff показывает обновление; `npx vitest run` остаётся зелёным (доки не влияют на тесты).

---

## Risk / rollback

- **Risk:** `--fix` clobbers reconciliation files → митигировано append-only через `appendFile` + idempotency check.
- **Risk:** stale proposal threshold 90 дней слишком агрессивен → default 90, настраивается через опцию, только помечает `needs_review` (не удаляет).
- **Rollback:** `git revert` одного коммита — --fix изолирован в новой функции + CLI флаге; без флага поведение идентично текущему.