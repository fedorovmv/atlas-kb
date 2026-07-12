---
entity_type: scenario
id: a2a-agent-discovery
title: A2A Agent Discovery
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
  - design_rationale
product_areas:
  - ai-runtime
aliases:
  - agent discovery
  - agent card discovery
  - a2a discovery
related_modules:
  - agent-tool-registry
related_decisions:
  - registry-is-discovery-not-orchestration
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Сценарий: A2A Agent Discovery

## Цель

Вызывающий агент обнаруживает доступные карточки агентов перед вызовом целевого сервиса через mesh.

## Участники

- Вызывающий агент
- Реестр

## Поток выполнения

1. Вызывающий агент запрашивает доступные карточки агентов.
2. Реестр фильтрует карточки согласно идентичности вызывающего и политикам.
3. Вызывающий агент получает доступные карточки.
4. Вызывающий агент вызывает выбранный целевой сервис через mesh/runtime.

## Ограничения

- Реестр не выбирает целевой агент.
- Реестр не выполняет вызовы целей.
- Исторические спецификации не могут переопределить текущее runtime-поведение.

## Сценарии ошибок

Определению подлежит.

## Связанные модули

- agent-tool-registry

## Связанные тесты

Определению подлежит.

## Обоснование

Паттерн discovery-first обеспечивает разделение между метаданными и runtime-исполнением.
