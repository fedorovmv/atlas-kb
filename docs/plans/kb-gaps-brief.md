# KB Gaps Brief

## Goal

Close gaps between the current implementation and the approved specs in `docs/specs/REQUIREMENTS.md` and `docs/specs/IMPLEMENTATION_DESIGN.md` for the v0.1 + v0.2 roadmap scope.

## Scope

- Discovery pipeline:
  - file inventory
  - heuristic classification
  - topic extraction
  - candidate module detection
- Bootstrap pipeline:
  - generate memory cards from a real project instead of only static demo scaffold
- Spec classification:
  - `classifySpecActuality`
  - claim extraction
  - `ingest-spec`
- Reconcile pipeline:
  - stale/spec-vs-actual reporting
- Missing CLI commands:
  - `discover`
  - `bootstrap`
  - `ingest-spec`
  - `reconcile`
- Missing OpenCode artifacts:
  - `memory-bootstrap` skill
  - `/memory-bootstrap` command
  - discover/bootstrap tools in `memory.ts` template
- Context pack enhancements:
  - include conflicts/open-questions
  - include per-card `usage_policy`
  - apply source priority from config
- Validation enhancement:
  - catch `spec_only` cards marked as `current_behavior` without explicit review
- `examples/synapse-mini` test fixture
- Expanded tests beyond the current 9 passing tests

## Non-goals

- Semantic classifier via runtime LLM integration; deferred to v0.2+ runtime LLM work.
- Graph export; deferred to v0.4.
- MCP server; deferred to v0.4.
- OpenCode plugin integration beyond generated templates.

## Constraints discovered

- ESM modules with NodeNext resolution.
- `.js` extensions are used in TypeScript imports.
- Zod is used for schemas.
- `fast-glob` is used for file discovery.
- `gray-matter` is used for frontmatter parsing.
- Existing async/fs conventions should be preserved.
- Cross-platform paths should use `toPosixPath`.
- Commands are thin wrappers over core functions.
- Scaffold artifacts currently live as inline strings in `src/scaffold/templates.ts`.
- No separate installer/template directory exists.

## Acceptance criteria

- Each missing command exists, is wired in `src/cli.ts`, and has passing tests.
- `discoverProject` inventories files, classifies them heuristically, extracts topics, and reports candidate modules.
- `bootstrapMemory` generates cards from a real project, not only static demo cards.
- `ingestSpec` creates proposal and/or historical memory artifacts based on spec actuality.
- `reconcile` reports stale or mismatched spec-derived memory.
- Context output includes conflicts/open-questions, per-card policy, and source-priority ordering.
- Validation catches `spec_only` cards claiming `current_behavior` without explicit review.
- `examples/synapse-mini` works as a fixture for discovery/bootstrap/spec-ingest scenarios.
- `npm run check` passes, including the existing 9 tests plus the new coverage.