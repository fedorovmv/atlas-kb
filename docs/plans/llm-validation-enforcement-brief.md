# Brief: LLM validation enforcement — evidence-gated code_confirmed

## Goal

Добавить technical enforcement: `evidence_level: code_confirmed` (и `test_confirmed`) требует наличия `## Code evidence` (и `## Test evidence`) секции в body card'а с конкретными symbol references. validate ERRORS при нарушении. Agent instructions tightened — memory-coder MUST output structured evidence section, memory-reviewer MUST verify section exists before promoting.

## Problem (из discovery)

Сейчас вся "enforcement" — текст в agent prompts ("ALWAYS read code", "NEVER set code_confirmed without verifying"). Zero technical checks:
- `updateCard` принимает `setEvidenceLevel=code_confirmed` без проверки body.
- `validate` warns на `current + inferred/unknown`, но НЕ проверяет что `code_confirmed` backed by evidence.
- memory-reviewer проверяет frontmatter fields, NOT code.
- Нет required format для `## Code evidence` который validate мог бы парсить.

LLM может hallucinate `code_confirmed` — zero friction.

## Scope

1. **validate enforcement** — `evidence_level: code_confirmed` → body MUST contain `## Code evidence` секцию с ≥1 entry. `test_confirmed` → `## Test evidence`. Если missing → ERROR (не warning).
2. **Evidence format** — required pattern: `## Code evidence` секция содержит lines вида `- <description> at <file>:<line>` или `- Function/Type <name> at <file>:<line>`. validate парсит наличие секции + ≥1 entry.
3. **Agent instructions tightened** — memory-coder: MUST output `## Code evidence` / `## Test evidence` секции со specific entries. memory-reviewer: MUST check секция exists + contains entries before promoting to current.
4. **updateCard guard** — если `setEvidenceLevel=code_confirmed` и body НЕ содержит `## Code evidence` → updateMemoryCard throws error (hard gate at write time).
5. **README/ontology** — document evidence format requirement.
6. **LIMITATIONS** — update §4.9 enforcement gap.
7. **Pre-task context** — add AGENTS.md project instruction: "before coding tasks involving product behavior, run /memory-context". Advisory, cheap.

## Non-goals

- Automatic pre-task context injection hook (v0.4 plugin lifecycle, §4.9).
- UI navigation / interactive diff (v0.4).
- LLM-as-judge verification (external model re-checking code — cost, latency).
- Symbol-level AST verification (B5, deferred — LLM does semantic, not CLI).
- claim deduplication (B7, separate).

## Constraints

- `validate.ts` — existing invariants (§13 REQUIREMENTS), add new check.
- `updateMemoryCard` in `updateMemory.ts` — add pre-write check for evidence_level + body consistency.
- Agent definitions in `templates.ts` lines 888-1016 — modify instruction text.
- Evidence section parsing: simple markdown heading + bullet detection, no AST.
- `## Code evidence` / `## Test evidence` — уже упоминаются в agent instructions, но не enforced.

## Testable acceptance criteria

1. `validate` на card с `evidence_level: code_confirmed` без `## Code evidence` секции → ERROR (not warning).
2. `validate` на card с `code_confirmed` + `## Code evidence` секцией с entries → passes.
3. `validate` на card с `test_confirmed` без `## Test evidence` → ERROR.
4. `validate` на card с `evidence_level: reviewed_doc` / `spec_only` / `inferred` / `unknown` → no evidence section required (backward compat).
5. `updateMemoryCard` с `fields: { evidence_level: "code_confirmed" }` и body без `## Code evidence` → throws error.
6. Существующие 73 тестов зелёные (existing cards without evidence sections but with non-confirmed evidence_level unaffected).
7. memory-coder instruction: MUST output `## Code evidence` with format `- <description> at <path>:<line>`.
8. memory-reviewer instruction: MUST verify `## Code evidence` exists before promoting to current.
9. New tests: validate rejects code_confirmed without evidence section, validate accepts with section, updateCard guard throws.
10. LIMITATIONS §4.9 + README updated.