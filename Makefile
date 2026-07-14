# atlas — Makefile
#
# Цели:
#   make setup              — установить зависимости и собрать кит
#   make build              — собрать dist/
#   make test               — прогнать vitest
#   make check              — build + test
#   make install TARGET=... — установить scaffold в целевой проект (только init)
#   make bootstrap TARGET=... — проанализировать проект и создать skeleton cards
#   make atlas CMD=...      — выполнить команду atlas в целевом проекте
#
# Примеры:
#   make install TARGET=/path/to/repo
#   make bootstrap TARGET=/path/to/repo FORCE=1   — пересоздать skeleton (перезаписать enriched)
#   make atlas TARGET=/path/to/repo CMD=bootstrap
#   make atlas TARGET=/path/to/repo CMD='validate --strict-warnings'
#   make atlas TARGET=/path/to/repo CMD='recall "изменить фифильтрацию agent cards"'

SHELL := /bin/bash
NODE  := node
TSX   := npx tsx
NPX   := npx

# Целевой проект для install/atlas (по умолчанию текущая директория)
TARGET ?= $(CURDIR)
# Аргумент atlas: одна команда (с флагами) строкой
CMD    ?= help
# FORCE=1 — передать --force (пересоздать scaffold/bootstrap, перезаписать enriched карты)
FORCE  ?= 0
FORCE_FLAG := $(if $(filter 1 true yes,$(FORCE)),--force,)

# Корень кита
KIT_ROOT := $(CURDIR)

.PHONY: setup build test check clean install bootstrap atlas atlas-init atlas-discover atlas-validate atlas-reconcile atlas-render atlas-ls atlas-recall atlas-ingest

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
#   2. запускает atlas init --root <TARGET>
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
	@echo "→ Далее: /atlas-bootstrap (LLM-агенты) или make atlas-ingest TARGET=$(TARGET) SPEC=..."

# ─────────────────────── Удобные именованные цели ───────────────────────
#
# Каждая принимает TARGET=<path>

atlas-init: build
	$(TSX) src/cli.ts --root "$(TARGET)" init

atlas-discover: build
	$(TSX) src/cli.ts --root "$(TARGET)" discover

atlas-validate: build
	$(TSX) src/cli.ts --root "$(TARGET)" validate

atlas-reconcile: build
	$(TSX) src/cli.ts --root "$(TARGET)" reconcile --fix

atlas-render: build
	$(TSX) src/cli.ts --root "$(TARGET)" render

atlas-ls: build
	$(TSX) src/cli.ts --root "$(TARGET)" ls

# recall: QUERY="текст задачи"
atlas-recall: build
	$(TSX) src/cli.ts --root "$(TARGET)" recall "$(QUERY)"

# ingest: SPEC="specs/**/*.md"
atlas-ingest: build
	$(TSX) src/cli.ts --root "$(TARGET)" ingest "$(SPEC)"

# ─────────────────────────── Универсальный запуск ───────────────────────────
#
# make atlas TARGET=/path CMD='validate --strict-warnings'
# make atlas TARGET=/path CMD='show agent-tool-registry'
# make atlas TARGET=/path CMD='recall "изменить фильтрацию"'

atlas: build
	$(TSX) src/cli.ts --root "$(TARGET)" $(CMD)