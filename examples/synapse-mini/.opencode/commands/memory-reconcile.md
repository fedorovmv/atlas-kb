---
description: Reconcile memory bank with code, tests and docs
agent: memory-reviewer
---

Use the memory-reconcile skill.

Goal: reconcile `.ai/memory` with current code, tests, contracts and docs.

Steps:
1. Run `npm run memory -- validate`.
2. Extract current claims from module/scenario cards.
3. Verify claims against code_refs/test_refs.
4. Find stale proposals and weak-evidence current claims.
5. Update conflicts and open questions.
6. Show a concise reconciliation report and diff.
