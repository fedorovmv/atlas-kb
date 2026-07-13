---
entity_type: historical
id: historical-requirements
title: REQUIREMENTS.md
status: historical
authority: historical_context
evidence_level: spec_only
stability: deprecated
source_confidence: low
last_reviewed: '2026-07-13'
review_required: false
knowledge_types:
  - historical_context
source_refs:
  - path: docs/specs/REQUIREMENTS.md
    role: historical
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# REQUIREMENTS.md (historical)

## Какая проблема решалась
Инструмент должен помогать ИИ coding agent работать с существующим программным продуктом на основе:

- текущего кода;
- тестов;
- актуальной документации;
- новых и старых спек;
- описаний сценариев;
- demo/test/prod-модулей;
- архитектурных решений и rationale.

Результатом должна быть локальная **memory bank** в виде Markdown-файлов с frontmatter, которую можно хранить в репозитории, читать руками и использовать из OpenCode.

Инструмент не должен быть отдельным RAG/БД. Память должна быть файловой, repo-native и пригодной для review через diff/PR.

## Актуальное обоснование
Должна описывать:

- context;
- problem;
- decision;
- rationale;
- alternatives considered;
- rejected alternatives;
- consequences/trade-offs;
- current behavior evidence;
- affected modules/scenarios.

## Устаревшие идеи
Требует ревью — что больше не применимо?

## Выжившие решения
Требует ревью — какие решения из этой спецификации перенесены?

## Ссылки на текущие решения
Требует ревью — ссылки на текущие карточки решений, заменяющие эту.
