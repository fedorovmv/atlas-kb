# Plan: deep design rationale extraction

3 tasks, sequential.

## Task 1: extractClaims rationale detection + extractDecisions fix

**Files:** `src/core/specClassification.ts`, `src/core/bootstrapMemory.ts`, `test/ingest-spec.test.ts`, `test/bootstrap.test.ts`

**Steps:**

### Part A: specClassification.ts — expand rationale heading detection

1. In `inferClaimTypeFromSection` (line 99-105), add patterns:
   - `problem|context|constraint|consequence|trade.?off|non.?goal|value` → `design_rationale`
   - Keep existing: `rationale|why|decision|alternatives` → `design_rationale`
   - Change `background` → also produce `design_rationale` (currently → `historical_context`; but background often contains rationale). Decision: make `background` → `historical_context` AND also produce a `design_rationale` claim? No — simpler: change `background` to `design_rationale` if it contains rationale keywords (problem, why, replaced, because). But this requires content inspection at heading level. Simplest: add `background` to the rationale pattern, and let historical_context come from `prior|legacy|archive` headings instead.
   
   Actually: keep `background|prior` → `historical_context` (correct for historical specs). Add `problem|context|constraint|consequence|trade.?off|non.?goal|value|background` where background is borderline. Let's be conservative: add `problem|context|constraint|consequence|trade.?off|non.?goal` → `design_rationale`. Leave `background` → `historical_context`.

2. In `extractClaims` bullet section (line 79), expand section check for design_rationale bullets:
   - Current: `currentSection.includes("rationale") || currentSection.includes("why") || currentSection.includes("decision")`
   - Add: `|| currentSection.includes("problem") || currentSection.includes("constraint") || currentSection.includes("consequence") || currentSection.includes("trade-off") || currentSection.includes("non-goal") || currentSection.includes("alternatives")`

3. Add paragraph extraction for rationale sections: if currentSection matches rationale pattern, extract first sentence of paragraphs (not just bullets). This captures prose rationale.
   - Pattern: line that's not a heading, not a bullet, not empty, not code ref → if in rationale section, extract as claim text.
   - Limit: only extract paragraphs in rationale sections (Problem, Rationale, Why, Decision, Constraints, Consequences) — not in Requirements (which is for current_behavior).

4. Add rejected alternatives extraction: under `## Alternatives` heading, detect `### <name>` subheadings → create claim with text `"<name> (rejected: <reason>)"` where reason is extracted from following `Reason:` or `Status: rejected` lines.

### Part B: bootstrapMemory.ts — fix extractDecisions dead code

1. In `extractDecisions` (line 297-308), change condition:
   - OLD: `file.signals.some((s) => /rationale|decision|why|alternative|constraint/i.test(s))`
   - NEW: `file.topics.some((t) => /rationale|decision|why|alternative|constraint|problem/i.test(t))`
   This checks `file.topics` (populated from markdown headings) instead of `file.signals` (path segments only).

2. Optionally: read doc file content and check for `## Rationale`/`## Decision`/`## Problem` headings. But `extractDecisions` receives `DiscoveryReport` which doesn't store file content. Simplest fix: use `file.topics`.

**Tests:**
- `test/ingest-spec.test.ts`: "extractClaims detects design_rationale from ## Problem heading" — spec with `## Problem\nThe registry must not be an orchestrator` → claim type design_rationale.
- `test/ingest-spec.test.ts`: "extractClaims detects rationale from ## Constraints" — `## Constraints\n- Must not cache results` → design_rationale claim.
- `test/ingest-spec.test.ts`: "extractClaims extracts rejected alternatives" — `## Alternatives\n### Option A\nStatus: rejected\nReason: too complex` → claim text contains "Option A" and "rejected".
- `test/bootstrap.test.ts`: "bootstrap creates decision card from doc with rationale topic" — doc file with `## Rationale` heading → decision card created (check `.ai/memory/decisions/` non-empty).

**Completion:** `npx vitest run` all green.

---

## Task 2: ingestSpec creates decision cards

**Files:** `src/commands/ingestSpec.ts`, `test/ingest-spec.test.ts`

**Steps:**
1. After extracting claims, check if spec has rationale content: `const hasRationale = claims.some(c => c.type === "design_rationale")` AND claims include Problem/Decision/Rationale type content.
   - Better: check if spec content has headings matching `## Problem|## Decision|## Rationale` (regex).
2. If `hasRationale` AND actuality is NOT `historical_context` (historical specs with rationale → historical card, not decision) → create decision card in addition to (or instead of) proposal card.
   - Decision: create decision card INSTEAD of proposal when spec has `## Problem` + `## Decision` + `## Rationale` headings. The decision card captures WHY, the proposal captures WHAT (if any proposed behavior).
   - If spec has BOTH rationale AND proposed behavior → create BOTH decision card and proposal card.
   - If spec has ONLY rationale (no requirements/claims) → create only decision card.
3. Decision card frontmatter: `entity_type: decision`, `knowledge_types: ["design_rationale"]`, `can_generate_code_from: false`, `source_refs: [{ path: specRel, role: "rationale" }]`.
4. Decision card body: fill ## Problem, ## Decision, ## Rationale from spec content sections (extract text under matching headings). ## Alternatives from spec if present.

**Tests:**
- "ingestSpec creates decision card from spec with rationale" — spec with `## Problem`, `## Decision`, `## Rationale` sections → decision card in `decisions/`.
- "ingestSpec creates both decision and proposal when spec has rationale + requirements" — spec with rationale + requirements → both cards created.
- "ingestSpec does not create decision card for historical spec" — historical spec with rationale → historical card only (not decision).

**Completion:** `npx vitest run` all green.

---

## Task 3: Документация — LIMITATIONS §4.6

**Files:** `docs/LIMITATIONS.md`

Move to Реализовано:
- извлечение problem/value/constraints из content спек
- извлечение rejected alternatives
- bootstrap decision card creation (fix dead code)
- ingestSpec creates decision cards

Keep in Не реализовано:
- различение explicit vs inferred rationale (LLM v0.4+)
- связывание rationale с current decisions (semantic v0.4+)
- обновление decision card при новой спеке (v0.4+)

**Completion:** diff, tests green.