# repo-memory-opencode-kit — Makefile
#
# Цели:
#   make setup              — установить зависимости и собрать кит
#   make build              — собрать dist/
#   make test               — прогнать vitest
#   make check              — build + test
#   make install TARGET=... — установить scaffold в целевой проект (только init)
#   make bootstrap TARGET=... — проанализировать проект и создать skeleton cards
#   make memory CMD=...     — выполнить команду repo-memory в целевом проекте
#
# Примеры:
#   make install TARGET=/path/to/repo
#   make bootstrap TARGET=/path/to/repo FORCE=1   — пересоздать skeleton (перезаписать enriched)
#   make memory TARGET=/path/to/repo CMD=bootstrap
#   make memory TARGET=/path/to/repo CMD='validate --strict-warnings'
#   make memory TARGET=/path/to/repo CMD='context "изменить фифильтрацию agent cards"'

SHELL := /bin/bash
NODE  := node
TSX   := npx tsx
NPX   := npx

# Целевой проект для install/memory (по умолчанию текущая директория)
TARGET ?= $(CURDIR)
# Аргумент repo-memory: одна команда (с флагами) строкой
CMD    ?= help
# FORCE=1 — передать --force (пересоздать scaffold/bootstrap, перезаписать enriched карты)
FORCE  ?= 0
FORCE_FLAG := $(if $(filter 1 true yes,$(FORCE)),--force,)

# Корень кита
KIT_ROOT := $(CURDIR)

.PHONY: setup build test check clean install bootstrap memory memory-init memory-discover memory-validate memory-reconcile memory-render memory-ls memory-context memory-ingest-spec

# ─────────────────────────── Разработка кита ───────────────────────────

setup: node_modules
	@echo "→ Установка завершена"

node_modules:
	npm install

build: dist
	@echo "→ Сборка завершена"

dist: node_modules
	npm run build

test: node_modules
	npm run test

check: build test
	@echo "→ check OK (build + test)"

clean:
	rm -rf dist
	@echo "→ dist удалён"

# ───────────────────────── Установка в целевой проект ─────────────────────────
#
# make install TARGET=/path/to/repo
#   1. собирает кит
#   2. запускает repo-memory init --root <TARGET>
#
# Только scaffold: .ai/memory/ + .opencode/ (агенты, skills, commands, tools, plugin).
# Никакого анализа проекта, никакого bootstrap, никакого копирования спек.

install: build
	@echo "→ Установка scaffold в: $(TARGET)"
	$(TSX) src/cli.ts --root "$(TARGET)" init $(FORCE_FLAG)
	@echo "→ Готово. Scaffold создан."
	@echo "→ Далее: make bootstrap TARGET=$(TARGET)"

# ─────────────────────── Анализ + skeleton cards ───────────────────────
#
# make bootstrap TARGET=/path/to/repo
#   1. discover — инвентаризация файлов, классификация, candidate modules
#   2. bootstrap — skeleton cards из discovery
#   3. validate — проверить инварианты
#
# Отдельный этап. Запускать после install, когда готов scaffold.

bootstrap: build
	@echo "→ Анализ проекта и создание skeleton cards: $(TARGET)"
	$(TSX) src/cli.ts --root "$(TARGET)" bootstrap $(FORCE_FLAG)
	$(TSX) src/cli.ts --root "$(TARGET)" validate
	@echo "→ Готово. Skeleton cards созданы."
	@echo "→ Далее: /memory-bootstrap (LLM-агенты) или make memory-ingest-spec TARGET=$(TARGET) SPEC=..."

# ─────────────────────── Удобные именованные цели ───────────────────────
#
# Каждая принимает TARGET=<path>

memory-init: build
	$(TSX) src/cli.ts --root "$(TARGET)" init

memory-discover: build
	$(TSX) src/cli.ts --root "$(TARGET)" discover

memory-validate: build
	$(TSX) src/cli.ts --root "$(TARGET)" validate

memory-reconcile: build
	$(TSX) src/cli.ts --root "$(TARGET)" reconcile --fix

memory-render: build
	$(TSX) src/cli.ts --root "$(TARGET)" render

memory-ls: build
	$(TSX) src/cli.ts --root "$(TARGET)" ls

# context: QUERY="текст задачи"
memory-context: build
	$(TSX) src/cli.ts --root "$(TARGET)" context "$(QUERY)"

# ingest-spec: SPEC="specs/**/*.md"
memory-ingest-spec: build
	$(TSX) src/cli.ts --root "$(TARGET)" ingest-spec "$(SPEC)"

# ─────────────────────────── Универсальный запуск ───────────────────────────
#
# make memory TARGET=/path CMD='validate --strict-warnings'
# make memory TARGET=/path CMD='show agent-tool-registry'
# make memory TARGET=/path CMD='context "изменить фильтрацию"'

memory: build
	$(TSX) src/cli.ts --root "$(TARGET)" $(CMD)