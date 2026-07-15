---
entity_type: module
id: agent-tool-registry
title: Agent & Tool Registry
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
  - api-mesh
  - ai-runtime
aliases:
  - agent registry
  - tool registry
  - agent card registry
  - реестр агентских карточек
related_modules:
  - mcp-gateway
related_scenarios:
  - a2a-agent-discovery
related_decisions:
  - registry-is-discovery-not-orchestration
code_refs:
  - path: internal/registry
    kind: production
  - path: pkg/agentcard
    kind: production
test_refs:
  - path: tests/agent-registry
    kind: integration
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Agent & Tool Registry

## Ответственность

Реестр хранит и предоставляет метаданные агентов/инструментов для обнаружения, фильтруя доступность согласно идентичности сервиса и политике доступа.

## Не входит в ответственность

- Выбор целевого агента
- Бизнес-оркестрация
- Выполнение вызовов в runtime

## Текущее поведение

Вызывающие агенты используют метаданные обнаружения для поиска доступных целей. Runtime-вызовы выполняются через путь mesh/runtime, а не самим реестром.

## Связанные сценарии

- a2a-agent-discovery

## Связанные решения

- registry-is-discovery-not-orchestration

## Свидетельства из кода

- `internal/registry`
- `pkg/agentcard`

## Свидетельства из тестов

- `tests/agent-registry`

## Известные риски

- Логика фильтрации может требовать обновлений по мере развития политик доступа.

## Открытые вопросы

- Какие проверки относятся к времени обнаружения, а какие — к runtime?

## Почему такие границы

Реестр остаётся компонентом обнаружения, чтобы не смешивать хранение метаданных, выбор цели и runtime-оркестрацию.

## Публичный интерфейс

- `FilterCardsForCaller(ctx, identity, policy)` — фильтрация доступных карточек агентов для вызывающего сервиса.
- `ListAgents(filter, options)` — получение списка агентов с поддержкой фильтров и пагинации.
- `GetAgent(id)` — получение метаданных конкретного агента.
- `GetTool(id)` — получение метаданных конкретного инструмента.

## Внутренняя реализация

- `internal/registry/access_filter.go` — логика фильтрации по идентичности и политикам доступа.
- `pkg/agentcard/agent_card.go` — структуры и сериализация карточек агентов.
- Внутренние хелперы форматирования и кэширования (не использовать напрямую).

## Примеры использования

```go
// Пример: получить доступные агенты для вызывающего сервиса
filtered := registry.FilterCardsForCaller(ctx, callerIdentity, policy)
for _, card := range filtered {
    fmt.Printf("Agent: %s [%s]\n", card.Name, card.Kind)
}
```

## Подтверждения в коде

- Функция FilterCardsForCaller в internal/registry/access_filter.go:5 (FilterCardsForCaller)
