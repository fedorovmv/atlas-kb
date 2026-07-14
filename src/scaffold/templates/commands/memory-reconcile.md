---
description: Reconcile memory bank with code, tests and docs
---

You are the orchestrator. Use the memory-reconcile skill.

Goal: reconcile `.ai/memory` with current code, tests, contracts and docs.

Steps (dispatch subagents for evidence work, do NOT do all work yourself):

1. Run `.ai/memory-tool/bin/memory validate` and `.ai/memory-tool/bin/memory reconcile --json` yourself to get the report.
2. Dispatch `memory-coder` subagent: for each stale ref and weak current claim from the report, it reads the referenced code/tests, verifies whether the claim still holds, returns findings.
3. Dispatch `memory-reviewer` subagent: it reviews the coder findings, decides which cards need status changes, updates conflicts and open questions using the `memory_updateCard` tool.
4. Run `.ai/memory-tool/bin/memory validate` again — ensure no errors.
5. Show a concise reconciliation report and `git diff .ai/memory/`.
