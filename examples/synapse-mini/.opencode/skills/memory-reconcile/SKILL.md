---
name: memory-reconcile
description: Reconcile repository memory with current code, tests, contracts and docs.
---

# Memory Reconcile Skill

Use this skill to detect drift between `.ai/memory` and the repository.

## Steps

1. Run `npm run memory -- validate`.
2. List current module cards.
3. For each current module, verify major claims against code_refs and test_refs.
4. Find current claims with weak evidence.
5. Find proposals that may now be implemented.
6. Write unresolved contradictions to conflicts.
7. Write unresolved questions to open-questions.
8. Do not rewrite current memory from specs alone.
