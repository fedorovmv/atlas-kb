---
description: Reconcile memory bank with code, tests and docs
---

You are the orchestrator. Use the atlas-reconcile skill. **Load it via the `skill` tool first.**

Goal: reconcile `.ai/memory` with current code, tests, contracts and docs.

Steps (dispatch subagents for evidence work, do NOT do all work yourself):

1. Run `.ai/atlas/bin/atlas validate` and `.ai/atlas/bin/atlas reconcile --json` yourself to get the report.
2. Dispatch `atlas-coder` subagent: for each stale ref and weak current claim from the report, it reads the referenced code/tests, verifies whether the claim still holds, returns findings.
3. Dispatch `atlas-reviewer` subagent: it reviews the coder findings, decides which cards need status changes, updates conflicts and open questions using the `atlas_updateCard` tool.
4. Run `.ai/atlas/bin/atlas validate` again — ensure no errors.
5. Show a concise reconciliation report and `git diff .ai/memory/`.
