# Ограничения текущей реализации

Этот документ фиксирует только ограничения — что не реализовано, что работает частично, что отложено. Что реализовано — см. `IMPLEMENTATION_STATUS.md`.

## Главное ограничение

CLI — deterministic heuristic, не semantic understanding. Инструмент строит первичную карту проекта по путям, расширениям, именам файлов, markdown-заголовкам и keyword matching. Semantic reasoning — задача LLM-агентов (memory-extractor, memory-analyst, memory-coder, memory-reviewer), не CLI.

## Не реализовано

### External integrations (v0.5+)

- анализ связей спеки с PR/Jira/commit — требует external API integration;
- Jira/Confluence export ingestion — требует парсинга external форматов;
- richer contract/proto/OpenAPI analysis — требует contract parsers.

### OpenCode TUI (не ts-kb-flow)

- UI-навигация по memory bank — требует OpenCode UI API;
- интерактивное подтверждение memory diff — требует OpenCode UI API;
- interactive review memory diff — требует OpenCode UI API.

### LLM-side (требует runtime, не CLI)

- semantic deduplication claims ("MUST filter" = "shall filter") — memory-analyst делает advisory, не auto-merge;
- связывание rationale с current decisions — semantic matching, v0.4+;
- обновление decision card при появлении новой спеки — reconcile extension, v0.4+;
- различение explicit vs inferred rationale — LLM judgment (memory-analyst помечает, но не автоматически).

### By design (не планируется)

- CLI-side AST symbol analysis — LLM делает semantic verification, не CLI keyword match;
- CLI как LLM orchestrator — OpenCode dispatches агенты, не CLI;
- external database / RAG / embeddings — source of truth = Markdown;
- GraphRAG / persistent service outside repository;
- PDF/DOCX ingestion — только Markdown specs.

## Частичные ограничения

### Bootstrap — эвристический

Создаёт preliminary cards с placeholder content. Не гарантированно точная инженерная документация без LLM enrichment.

Ожидаемое использование: `bootstrap` → LLM agents (extractor → coder → reviewer) → `validate` → human review diff.

### Spec classification — keyword-based evidence

`checkEvidence` — keyword match (basename tokens), не symbol analysis. Может дать false positive (claim содержит "registry", файл `registry.go` → confirmed, хотя функция может делать другое). LLM memory-coder делает semantic verification поверх CLI skeleton.

### Cross-document comparison — Jaccard, не semantic

`detectSpecRelations` — Jaccard topic overlap ≥ 0.3 + "replaces" keyword. Может пропустить semantic supersedes (разные слова, тот же смысл) или дать false positive (тот же topic, разный intent). LLM memory-analyst делает semantic comparison advisory.

### Context pack — lexical scoring

Релевантность основана на token matching, не semantic search. Может вернуть лишние cards или пропустить релевантные по смыслу.

### Validation — форма + policy, не content truth

Проверяет frontmatter schema, relations, evidence format (`at <path>:<line>` pattern), dangerous policies. Не проверяет фактическую истинность содержимого — LLM memory-reviewer делает quality rubric + re-read verification.

### Claim linking — keyword match

`linkClaimsToCards` — canonical title overlap + source_path match. Может miss semantic links (claim про "фильтрацию" → module "access control", разные слова, тот же смысл).

## Риски

### Ложная уверенность

Bootstrap создаёт аккуратные Markdown файлы, которые выглядят убедительно, но содержат preliminary выводы.

Митигация: `review_required: true`, evidence-gated `code_confirmed` (validate ERROR + updateCard THROW без `## Code evidence` секции с `at <path>:<line>` форматом), LLM review.

### Rationale додуман

LLM может сформулировать причины, которых не было в источниках.

Митигация: `evidence_level: inferred` для inferred rationale; memory-analyst instruction: "if rationale not explicitly stated → mark inferred"; `review_required: true`.

### OpenCode может не применять skills автоматически

Митигация: AGENTS.md project-level instruction; memory-guard plugin (`chat.message` auto-context injection, `tool.execute.before` advisory warning); `/memory-context` перед задачами.

## Что не баг

Ожидаемое ограничение, не дефект:

- bootstrap создаёт preliminary cards с `needs_review`;
- current behavior не заполняется без code evidence;
- старые спеки не превращаются в current behavior (validate rejects);
- context pack может вернуть лишние cards (lexical score);
- claim extraction — keyword-based, не semantic (LLM делает semantic поверх);
- evidence check — basename match, не symbol analysis (LLM memory-coder делает semantic verification);
- пользователь должен смотреть diff перед принятием памяти.