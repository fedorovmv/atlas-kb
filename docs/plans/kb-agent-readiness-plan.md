# KB Agent Readiness Implementation Plan

## Task 1 — Extend frontmatter schema with `agent_summary`

### Outcome

Cards may include an optional short agent-facing summary without breaking existing KBs.

### Likely files

- `src/schemas/frontmatter.ts`
- `src/core/validate.ts` (add `agent_summary` to `KNOWN_FRONTMATTER_KEYS` at line 22)

### Implementation steps

1. Add `agent_summary: z.string().optional()` to `MemoryFrontmatterSchema` (frontmatter.ts:114-161). Insert before `cross_link_attempts` (line 159), before `.passthrough()` (line 161) — zod requires fields before `.passthrough()`.
2. Keep the field optional because the schema uses `.passthrough()` and existing KBs must remain valid.
3. Add an inline comment or nearby schema documentation indicating intended max length: 280 chars.
4. **CRITICAL**: Add `"agent_summary"` to `KNOWN_FRONTMATTER_KEYS` set in `src/core/validate.ts:22-33`. Without this, every card with `agent_summary` triggers a spurious "unknown frontmatter field" warning (validate.ts:138).

### Tests-first / verification

- Add or update schema tests to confirm:
  - cards with `agent_summary` parse successfully;
  - cards without `agent_summary` still parse successfully;
  - a card with `agent_summary` produces no "unknown frontmatter field" warning.

### Completion evidence

- `MemoryFrontmatterSchema` accepts `agent_summary`.
- `KNOWN_FRONTMATTER_KEYS` includes `agent_summary`.
- Existing fixtures/cards without the field still pass validation.
- Relevant tests pass.

---

## Task 2 — Update card section contracts

### Outcome

Card ontology reflects agent-readiness requirements for public APIs, internal implementation, and examples.

### Likely files

- `src/schemas/cardSections.ts`
- `src/scaffold/templates/memory/modules/agent-tool-registry.md` (current fixture used by createTempProject())
- `src/scaffold/templates/memory/modules/mcp-gateway.md` (if exists, same fixture chain)

### Implementation steps

1. For `module` cards:
   - move `## Публичный интерфейс` from recommended to required;
   - add `## Внутренняя реализация` to recommended;
   - add `## Примеры использования` to recommended.
2. For `decision` cards:
   - add a `recommended` array (currently `decision` contract has only `required`, no `recommended` key — must add it) with `## Примеры использования`.
3. Do not add performance/security sections; those are deferred non-goals.
4. **CRITICAL fixture update**: `src/scaffold/templates/memory/modules/agent-tool-registry.md` is `status: current, review_required: false` and is copied into every temp test project by `test/helpers.ts:16-18`. It does NOT contain `## Публичный интерфейс`. Section validation runs on `review_required=false` cards (validate.ts:237). Making `## Публичный интерфейс` required will flip this fixture from passing to failing, breaking ~50+ tests (validate.test.ts, cli.test.ts, update.test.ts, ls.test.ts, dispatch.test.ts, ingest-spec.test.ts, etc.). Update this fixture to include `## Публичный интерфейс` (and for consistency `## Внутренняя реализация`, `## Примеры использования` as recommended placeholders).

### Tests-first / verification

- Update section-contract tests or validator tests to assert:
  - module cards missing `## Публичный интерфейс` now produce an error;
  - module cards missing `## Внутренняя реализация` produce a warning only;
  - module/decision cards missing `## Примеры использования` produce a warning only.
- Add regression test: a `current` module card missing `## Публичный интерфейс` produces a section error.
- Verify `createTempProject()`-based test suite passes after fixture update.

### Completion evidence

- Section validation behavior matches the new required/recommended contract.
- `agent-tool-registry.md` fixture updated and `createTempProject()` tests pass.
- Existing tests updated intentionally where expectations changed.
- `decision` contract now has a `recommended` array.
- **`ls --needs-enrichment` impact**: `ls.ts:113` uses `hasMissingRequiredSections` driven by `CARD_SECTION_CONTRACTS[type].required`. Moving `## Публичный интерфейс` to required changes `MISSING_SECTIONS` flagging for module cards. Update `ls` tests for new `MISSING_SECTIONS` behavior on module cards missing `## Публичный интерфейс`.

---

## Task 3 — Add validation for `agent_summary` and cross-link readiness

### Outcome

Validator catches agent-readiness gaps while preserving backward compatibility.

### Likely files

- `src/core/validate.ts`
- `src/commands/ls.ts` (export `areCrossLinksEmpty` for reuse, or duplicate per-entity logic)

### Implementation steps

1. Add warning for current cards with empty or missing `agent_summary`.
   - Warning only, not error.
2. Add cross-link validation for `current` cards where `entity_type` is `module`, `decision`, or `scenario`.
3. **Use per-entity empty-cross-link rules matching `ls.ts:120-130`** (do NOT use a uniform AND-of-both-fields rule):
   - `module` → cross-link-empty when `related_scenarios` is empty;
   - `decision` → cross-link-empty when `related_modules` AND `affects_modules` are both empty;
   - `scenario` → cross-link-empty when `related_modules` is empty (new rule — `ls.ts` has no scenario case; state this explicitly).
4. Reuse `areCrossLinksEmpty` from `ls.ts:120` (export it) for module/decision; add scenario case there or in validate.ts.
5. Threshold (aligned with brief criterion 8 and existing `ls.ts` behavior):
   - warn when cross-links empty AND `cross_link_attempts < 2`;
   - error when cross-links empty AND `cross_link_attempts >= 2` AND `has_broken_relations` is false.
6. Preserve existing validation behavior:
   - `evidence_level=code_confirmed` still requires `## Свидетельства из кода`;
   - `test_confirmed` still requires `## Свидетельства из тестов`;
   - `heuristic_match + current` remains an error.

### Tests-first / verification

Add validator tests for:

1. Current module with empty `related_scenarios` and `cross_link_attempts: 0` => warning.
2. Current scenario with empty `related_modules` and `cross_link_attempts: 1` => warning.
3. Current decision with empty `related_modules`+`affects_modules` and `cross_link_attempts: 2`, `has_broken_relations: false` => error.
4. Same as #3 with `has_broken_relations: true` => no missing-link error.
5. Current module with populated `related_scenarios` => no cross-link warning even if `related_modules` empty.
6. Non-current cards do not trigger the new cross-link warning/error.
7. Current card without `agent_summary` => warning only.

### Completion evidence

- New validator tests pass.
- Existing validator tests pass.
- Cross-link empty rule matches `ls.ts` per-entity semantics.
- No backward-incompatible schema failures introduced.

---

## Task 4 — Include `agent_summary` in search scoring

### Outcome

Recall/search ranking can use concise agent-facing summaries.

### Likely files

- `src/core/score.ts`

### Implementation steps

1. Update `cardHaystack()` (score.ts:7-30) so `agent_summary` is prepended to searchable text before the body.
2. **Guard against `undefined`**: `agent_summary` is `z.string().optional()`, so `m.agent_summary` is `string | undefined`. Use `...(m.agent_summary ? [m.agent_summary] : [])` or `m.agent_summary ?? ""` with empty filtering. Direct insertion of `undefined` produces the literal string "undefined" in the haystack.
3. Keep existing body slicing behavior, currently `card.body.slice(0,6000)`.
4. Avoid changing scoring algorithm semantics beyond adding the new text source.

### Tests-first / verification

- Add/update tests to confirm a query matching only `agent_summary` can affect card scoring/searchability.
- Add regression test: card without `agent_summary` produces haystack identical to pre-change behavior (no "undefined" string leaking in).

### Completion evidence

- `agent_summary` appears in the haystack before card body when present.
- Cards without `agent_summary` produce identical haystack to pre-change.
- Search/score tests pass.

---

## Task 5 — Include `agent_summary` in context output

### Outcome

Recall/context packs expose the short agent-facing summary before full card content.

### Likely files

- `src/core/context.ts` (actual rendering: `renderCardLine` at line 45-49, `compactExcerpt` at line 40-43, `## Compact excerpts` block around line 167)
- `src/commands/context.ts` (CLI wrapper only — JSON output at lines 6-15 may also need `agent_summary`)

### Implementation steps

1. Rendering lives in `src/core/context.ts`, NOT in `src/commands/context.ts` (which is an 18-line CLI wrapper calling `buildMemoryContext`).
2. When a card has `agent_summary`, prepend it to the emitted card content in the `## Compact excerpts` block (context.ts:167-168) and/or the `renderCardLine` marker (context.ts:45-49).
3. Use a stable label such as `Agent summary:` before the summary text.
4. Guard `undefined`: only emit the label when `agent_summary` is non-empty.
5. Decide whether JSON output (`commands/context.ts:6-15`) should include `agent_summary` in the `selected`/`related` card objects. **Yes — add it.** Brief criterion 13 implies JSON consumers (agents using `--json`) need `agent_summary`. Add `agent_summary` to JSON `selected`/`related` card objects (`commands/context.ts:9-10`) when present; guard `undefined`.
6. Do not remove or reorder existing evidence/policy content except for the summary prepend.

### Tests-first / verification

- Add/update context tests to confirm `agent_summary` appears in markdown output when present.
- Confirm cards without `agent_summary` render without noisy empty labels or "undefined".
- If JSON output updated: confirm `agent_summary` appears in JSON when present.

### Completion evidence

- Context markdown contains summaries for cards that define them.
- Context JSON includes `agent_summary` when present (if decided).
- Existing context behavior remains compatible.

---

## Task 6 — Update reviewer prompt for promotion gates and rationale quality

### Outcome

Reviewer blocks promotion of cards that are not agent-ready.

### Likely files

- `src/scaffold/templates/agents/atlas-reviewer.md`

### Implementation steps

1. Add promotion checklist item:
   - for `module`, `decision`, and `scenario` cards, refuse promotion to `current` when cross-links are empty after cross-linking was attempted.
2. Use the specified rule (threshold aligned with Task 3 and brief criterion 8):
   - if cross-links are empty per-entity (see Task 3 rules: module → `related_scenarios` empty; decision → `related_modules`+`affects_modules` empty; scenario → `related_modules` empty);
   - and `cross_link_attempts >= 2`;
   - then keep `needs_review`;
   - exception: reviewer verified via `atlas ls` that no possible relations exist. In this case reviewer sets `has_broken_relations: true` (semantically: "no relations possible, verified") to suppress the validator error from Task 3. Document this authority split: reviewer is the semantic authority, validator respects `has_broken_relations` flag.
3. Add conflict-detection responsibility:
   - before promoting any card, check for semantic duplicates/contradictions among current cards with overlapping `code_refs` or `related_modules`;
   - scope: check pairs of current cards that share ≥1 `code_refs` path OR ≥1 `related_modules` entry; for each pair decide duplicate/contradiction/independent;
   - write only confirmed conflicts to `conflicts.md`; do not block on speculative overlap;
   - do not promote.
4. Update module quality check:
   - `## Публичный интерфейс` is required;
   - missing section means keep `needs_review`.
5. Add decision quality check:
   - each `## Отклонённые альтернативы` entry must include:
     - technical constraints;
     - trade-offs versus chosen option;
     - why it does not fit this project context;
   - shallow rationale such as only “реализован X” is insufficient.

### Tests-first / verification

- Prompt files are Markdown, so verification is content-based:
  - inspect final prompt text for each required checklist item;
  - run existing scaffold/template snapshot tests if present;
  - update snapshots intentionally if needed.

### Completion evidence

- Reviewer prompt contains explicit promotion blockers for:
  - missing public interface;
  - missing cross-links after attempted linking;
  - unresolved conflicts;
  - shallow rejected-alternative rationale.

---

## Task 7 — Update extractor prompt for public/internal API and examples

### Outcome

Module extraction produces cards that distinguish public usage from internal implementation.

### Likely files

- `src/scaffold/templates/agents/atlas-extractor.md`

### Implementation steps

1. Keep existing instruction to list exported symbols.
2. Direct exported symbols into `## Публичный интерфейс`.
3. Add instruction to fill `## Внутренняя реализация` with non-exported/internal functions and types.
4. Clearly mark internal entries as not for direct use: `не использовать напрямую`.
5. Add instruction to populate `agent_summary`:
   - 1–2 sentences;
   - what the module does;
   - how agents should use it;
   - target max length 280 chars.
6. Add instruction to fill `## Примеры использования` with typical code snippets.
7. Preserve existing rule from `src/scaffold/templates/agents/atlas-extractor.md:121` that extractor must not touch `related_*` fields (line 121: "Do NOT touch `code_refs`, `test_refs`, `entity_type`, `id`, `related_*` fields").

### Tests-first / verification

- Content verification:
  - prompt mentions `agent_summary`;
  - prompt mentions `## Публичный интерфейс`;
  - prompt mentions `## Внутренняя реализация`;
  - prompt says internals are not for direct use;
  - prompt mentions `## Примеры использования`;
  - prompt still says not to touch `related_*`.

### Completion evidence

- Extractor prompt gives clear section-level instructions for module cards.
- No conflict with deterministic cross-link ownership.

---

## Task 8 — Update analyst prompt for decision summaries, examples, and deeper rejected alternatives

### Outcome

Decision cards explain what was decided, why, how it appears in code, and why alternatives were rejected.

### Likely files

- `src/scaffold/templates/agents/atlas-analyst.md`

### Implementation steps

1. Add instruction to fill `agent_summary` for decision cards:
   - 1–2 sentences;
   - what was decided;
   - why;
   - target max length 280 chars.
2. Add instruction to fill `## Примеры использования` for decision cards:
   - code snippets or concrete references showing how the decision manifests.
3. Update `## Отклонённые альтернативы` extraction instructions.
4. Require each rejected alternative to include:
   - technical constraints;
   - trade-offs versus chosen option;
   - why it does not fit this project context.
5. Explicitly reject shallow reasoning such as only saying “реализован X”.
6. Preserve existing mandatory cross-linking instructions at `src/scaffold/templates/agents/atlas-analyst.md:160-180`.

### Tests-first / verification

- Content verification:
  - prompt mentions `agent_summary`;
  - prompt mentions `## Примеры использования`;
  - rejected alternatives require constraints/trade-offs/context fit;
  - existing cross-linking instructions remain.

### Completion evidence

- Analyst prompt enforces structured WHY for decisions.
- Prompt still instructs analyst to set relation fields.

---

## Task 9 — Update bootstrap skeletons for new frontmatter and sections

### Outcome

Forward-generated KB cards start with agent-readiness placeholders.

### Likely files

- `src/core/bootstrapMemory.ts`
- `src/scaffold/templates/memory/modules/*.md` (hand-authored template cards used by init scaffold and createTempProject())
- `src/scaffold/templates/memory/decisions/*.md` (same)

### Implementation steps

1. Add `agent_summary: ""` to generated skeleton frontmatter in `bootstrapMemory.ts`.
2. For module skeleton bodies in `bootstrapMemory.ts`, include placeholder headings:
   - `## Публичный интерфейс`;
   - `## Внутренняя реализация`;
   - `## Примеры использования`.
3. For decision skeleton bodies in `bootstrapMemory.ts`, include placeholder heading:
   - `## Примеры использования`.
4. **Scaffold template fixtures** (separate from bootstrapMemory.ts output): update `src/scaffold/templates/memory/modules/*.md` — the `current` fixture (`agent-tool-registry.md`) must gain `## Публичный интерфейс` (already done in Task 2 if ordered first; if not, do it here). Update `needs_review` module fixtures to include placeholder headings for forward consistency. Update decision fixtures to include `## Примеры использования`.
5. Ensure all generated cards still start as `needs_review`.
6. Keep existing generated `code_refs`, `test_refs`, and `source_refs` behavior unchanged.
7. **Decision cards default to `status: "current"` at `bootstrapMemory.ts:639`**, making them instantly subject to new strict cross-link validation (Task 3). Ensure decision skeleton includes placeholder cross-link fields (`related_modules: []`, `affects_modules: []`) and `## Примеры использования` heading so they pass validation, OR consider defaulting freshly-bootstrapped decisions to `needs_review` for forward consistency (decision: implementer picks, but must not break `npm run check`).

### Tests-first / verification

- Add/update bootstrap tests to confirm:
  - generated frontmatter includes `agent_summary: ""`;
  - module skeletons include the new headings;
  - decision skeletons include examples heading;
  - generated cards still validate as `needs_review`.
- Add test: `initMemory()` output plus copied fixtures validates clean under new contract.

### Completion evidence

- New bootstrap output is aligned with card section contracts.
- Scaffold template fixtures updated and validate clean.
- Existing deterministic card creation behavior remains intact.

---

## Task 10 — Update bootstrap skill workflow with conflict-detection pass

### Outcome

The human/agent bootstrap workflow includes an explicit final conflict pass.

### Likely files

- `src/scaffold/templates/skills/atlas-bootstrap.md`

### Implementation steps

1. Add a final step after all cards are promoted to `current`.
2. Instruct running reviewer conflict-detection pass.
3. Require reviewer to check semantic duplicates/contradictions among current cards with overlapping `code_refs` or `related_modules`.
4. Require conflicts to be written to `conflicts.md`.
5. State that unresolved conflicts block completion.

### Tests-first / verification

- Content verification:
  - bootstrap skill includes “conflict detection pass”;
  - pass occurs after cards are current;
  - references reviewer responsibility and `conflicts.md`.

### Completion evidence

- Bootstrap workflow now explicitly closes with conflict reconciliation.

---

## Task 11 — End-to-end verification

### Outcome

All schema, validation, scoring, context, prompt, and bootstrap changes are integrated.

### Likely files

- Test files under `test/`
- Changed source/template files from prior tasks

### Implementation steps

1. Run targeted tests for:
   - frontmatter schema;
   - card section validation;
   - validator;
   - scoring/search;
   - context command;
   - bootstrap generation.
2. Run full project check:

```bash
npm run check
```

3. Review failures for intentional expectation changes caused by:
   - module public interface becoming required;
   - new recommended sections;
   - new validation warnings.

### Tests-first / verification

- Full check must pass.
- Snapshot updates, if any, should be limited to intentional prompt/skeleton output changes.

### Completion evidence

- `npm run check` passes.
- Changed behavior is covered by tests or explicit prompt/template verification.
- No non-goal work was introduced.

## Brief acceptance criteria → evidence mapping

| # | Criterion | Verified by |
|---|-----------|-------------|
| 1 | `agent_summary` accepted by schema | Task 1 schema test |
| 2 | Existing cards without `agent_summary` remain valid | Task 1 schema test + Task 2 fixture regression |
| 3 | Current cards with empty `agent_summary` warn (not error) | Task 3 validator test #7 |
| 4 | Module contract requires `## Публичный интерфейс` | Task 2 section-contract test |
| 5 | Module contract recommends `## Внутренняя реализация` | Task 2 section-contract test |
| 6 | Module+decision contracts recommend `## Примеры использования` | Task 2 section-contract test |
| 7 | Validation warns on empty cross-links + attempts < 2 | Task 3 validator tests #1-2 |
| 8 | Validation errors on empty cross-links + attempts >= 2 + no broken relations | Task 3 validator test #3 |
| 9 | Reviewer prompt refuses promotion on failed cross-link/conflict checks | Task 6 prompt content inspection |
| 10 | Analyst/extractor prompts instruct agent_summary, examples, rationale depth | Task 7+8 prompt content inspection |
| 11 | Bootstrap skeletons include new placeholders | Task 9 bootstrap test |
| 12 | Search scoring includes `agent_summary` | Task 4 score test |
| 13 | Context output includes `agent_summary` | Task 5 context test |
| 14 | `npm run check` passes | Task 11 full check |