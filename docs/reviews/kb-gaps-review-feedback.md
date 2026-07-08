# KB Gaps Plan Review Feedback

- Requirements: docs/specs/REQUIREMENTS.md
- Design: docs/specs/IMPLEMENTATION_DESIGN.md
- Plan: docs/plans/kb-gaps-plan.md
- Brief: docs/plans/kb-gaps-brief.md
- Base: 24d5bc176f84d0ce43482404f311ba0d01d3fb30 (branch v/kb-openspec)
- Council: balanced-plan, 3/3 REVISE

## Ledger

| ID | Status | Evidence | Decision | Required change | Verification |
|----|--------|----------|----------|-----------------|--------------|
| F1 | ACCEPTED | synapse-mini in Phase D; Tasks 1,4,5,6-9 need fixture | Move Task 11 → Phase 0 | Plan reorder | Plan references fixture-first |
| F2 | PARTIALLY ACCEPTED | source-priority.yaml EXISTS in templates.ts:544 with priority[]+rules[]; not undefined design | Add zod schema for existing config format; Task 2 parses it | Plan: Task 2 add schema parse step | Context test uses config |
| F3 | ACCEPTED | UsagePolicySchema has no explicit_review field | v0.1 reject unconditionally; defer override to v0.2 | Plan Task 3 simplified | Validate test rejects |
| F4 | ACCEPTED | Task 5 vs Task 8 boundary unclear | Task 5 = pure fns (classifySpecActuality, extractClaims); Task 8 = orchestration | Plan wording | Task 5 no IO orchestration |
| F5 | ACCEPTED | reconciliation/ dir exists in scaffold; bootstrap should create, context should load | Task 4 creates reconciliation/; Task 2 loads reconciliation/*.md | Plan both tasks | Tests |
| F6 | ACCEPTED | Task 12 is unbounded sink | Unit tests in Tasks 1-9; Task 12 = integration tests only (E2E synapse-mini) | Plan split | Test count per task |
| F7 | REJECTED | Task 1 too large | Keep single task with tighter criteria — coder-view concern minor | No change | — |
| F8 | ACCEPTED | CLI conventions undefined | Add conventions section: --root, --memory-root, --dry-run, --json, exit codes | Plan section | CLI tests |
| F9 | ACCEPTED | OpenCode artifacts underspecified | Add mini-spec per artifact (skill content, command format, tool signatures) | Plan Task 10 | Init test |
| F10 | ACCEPTED | No E2E integration test | Add to Task 12 (integration) | Plan Task 12 | E2E test passes |
| F11 | ACCEPTED | Rollback/compat notes missing | Add per-task notes for 2,3,7 | Plan notes | — |

## Next gate
RERUN_COUNCIL after plan revision.