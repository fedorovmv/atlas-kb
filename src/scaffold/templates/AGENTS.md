# Project Instructions

## Memory-First Development

Before coding tasks involving product behavior or architecture:
1. Run /memory-context to load relevant memory cards.
2. Read the module/scenario/decision cards related to your task.
3. Check code_refs and test_refs in those cards for the actual source files.

Before changing product behavior:
1. Read the relevant memory module card(s).
2. If a card has evidence_level=code_confirmed, verify the ## Свидетельства из кода section matches reality before relying on it.
3. After your change, update the memory card if behavior changed.

## Evidence Integrity

- evidence_level=code_confirmed requires ## Свидетельства из кода section with specific file:line references.
- evidence_level=test_confirmed requires ## Свидетельства из тестов section.
- The CLI validates this — invalid evidence_level will be rejected.
- Never set code_confirmed without actually reading the code and citing specific symbols.
