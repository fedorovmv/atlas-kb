---
entity_type: decision
id: registry-is-discovery-not-orchestration
title: Registry is discovery, not orchestration
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - design_rationale
  - current_behavior
product_areas:
  - api-mesh
  - ai-runtime
affects_modules:
  - agent-tool-registry
affects_scenarios:
  - a2a-agent-discovery
related_modules:
  - agent-tool-registry
related_scenarios:
  - a2a-agent-discovery
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Решение: Registry is discovery, not orchestration

## Контекст

Продукту нужен способ для агентов и инструментов обнаруживать доступные метаданные внутри Synapse API Mesh.

## Проблема

Если ответственность реестра не определена явно, его можно перепутать с runtime-оркестратором, который выбирает агенты или выполняет вызовы.

## Решение

Реестр — это компонент обнаружения. Он хранит и предоставляет метаданные и доступность с фильтрацией по правам доступа. Он не выбирает целевые агенты и не выполняет runtime-вызовы.

## Обоснование

Эта граница сохраняет простоту компонента и избегает смешивания обнаружения метаданных, бизнес-решений и runtime-исполнения.

## Рассмотренные альтернативы

- Реестр только как хранилище метаданных (без фильтрации)
- Реестр как runtime-оркестратор

## Отклонённые альтернативы

### Реестр как runtime-оркестратор

Статус: отклонено.

Причина: это смешивает ответственность обнаружения и runtime, создавая неверные ожидания относительно реестра.

## Последствия

- Выбор агента остаётся за пределами реестра.
- Runtime-проверки должны описываться отдельно.
- Изменения кода вокруг реестра должны сохранять эту границу, пока новое решение её не заменит.

## Свидетельства текущего поведения

- FilterCardsForCaller в internal/registry/access_filter.go обеспечивает поведение только для обнаружения.

## Затронутые модули

- agent-tool-registry

## Затронутые сценарии

- a2a-agent-discovery
