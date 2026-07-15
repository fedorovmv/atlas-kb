# KB Agent Readiness Brief

## Goal

Improve Atlas KB generated knowledge bases so AI coding agents can reliably use them for code understanding and change planning.

This feature set addresses gaps found in a generated KB for an external Go project: weak cross-linking, no public/internal API separation, missing agent-facing summaries, missing usage examples, and shallow rationale for rejected alternatives.

## Scope

### T1: Pipeline enforcement — cross-linking and conflicts

- Validate that current module/decision/scenario cards have meaningful cross-links.
- Escalate missing links from warning to error after repeated cross-link attempts.
- Update reviewer prompt to block promotion when cross-linking or conflict checks are incomplete.
- Add explicit conflict-detection pass to bootstrap workflow.

### T2: Ontology — public API separation

- Make `## Публичный интерфейс` required for module cards.
- Add `## Внутренняя реализация` as recommended for module cards.
- Update extractor/reviewer prompts and bootstrap skeletons accordingly.

### T3: Ontology — `agent_summary` and examples

- Add optional `agent_summary` frontmatter field.
- Recommend `## Примеры использования` for module and decision cards.
- Include `agent_summary` in search/context output.
- Warn when current cards lack `agent_summary`.
- Update prompts and skeletons to populate summaries/examples.

### T5: Prompt — rationale depth

- Require structured reasoning for rejected alternatives in decision cards.
- Reviewer must reject shallow rejected-alternative rationale.

## Non-goals

- Performance/security sections.
- Test coverage metrics.
- Mermaid generation.
- Changelog field.
- Automated CLI cross-link filling.
- Semantic conflict detection in CLI.
- Migration of existing generated KBs.

## Constraints

- TypeScript ESM.
- Zod schemas.
- Vitest tests.
- Frontmatter schema uses `.passthrough()`, so new fields must remain backward-compatible.
- Agent templates are Markdown prompt files.
- Card section contracts drive validation and agent instructions.
- All changes must pass:

```bash
npm run check
```

## Testable Acceptance Criteria

1. `agent_summary` is accepted by `MemoryFrontmatterSchema`.
2. Existing cards without `agent_summary` remain schema-valid.
3. Current cards with empty `agent_summary` produce a warning, not an error.
4. Module card section contract requires `## Публичный интерфейс`.
5. Module card section contract recommends `## Внутренняя реализация`.
6. Module and decision section contracts recommend `## Примеры использования`.
7. Validation warns when a current module/decision/scenario card has no `related_modules`, no `related_scenarios`, and `cross_link_attempts < 2`.
8. Validation errors when such a card has `cross_link_attempts >= 2` and `has_broken_relations` is false.
9. Reviewer prompt refuses promotion when required cross-link/conflict checks fail.
10. Analyst/extractor prompts instruct agents to populate `agent_summary`, usage examples, and deeper rejected-alternative rationale.
11. Bootstrap skeletons include new frontmatter/section placeholders for forward-generated KBs.
12. Search scoring includes `agent_summary`.
13. Recall/context output includes `agent_summary`.
14. `npm run check` passes.