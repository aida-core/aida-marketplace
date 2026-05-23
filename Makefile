# SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors
# SPDX-License-Identifier: MPL-2.0

# AIDA Marketplace Makefile
# Run `make help` for available targets

.PHONY: help install clean-venv lint lint-yaml lint-md lint-json lint-reuse typecheck check validate validate-frontmatter link-check test

# --- Python venv resolution -------------------------------------------------
#
# `make install` provisions a local Python venv in .venv/ so contributors on
# modern macOS / Python 3.12+ don't hit PEP 668 "externally-managed-environment"
# errors. The variables below use RECURSIVE expansion (`=`, not `:=`) so the
# $(wildcard) check is re-evaluated each time the variable is referenced — that
# way `make install lint` in a single invocation correctly picks up the freshly
# created venv binaries for the lint step.
#
# CI doesn't run `make install`; it pip-installs to the GitHub Actions Python
# directly. When .venv/ is absent, the wildcards fall through to system
# binaries on PATH. Same Makefile, both worlds.
#
# Make 3.81-compatible (no `export PATH`, no `.ONESHELL`).

VENV := .venv
PY = $(if $(wildcard $(VENV)/bin/python),$(VENV)/bin/python,python3)
YAMLLINT = $(if $(wildcard $(VENV)/bin/yamllint),$(VENV)/bin/yamllint,yamllint)
REUSE = $(if $(wildcard $(VENV)/bin/reuse),$(VENV)/bin/reuse,reuse)

# --- Targets ----------------------------------------------------------------

help: ## Show this help message
	@echo "AIDA Marketplace - Available targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# Dependencies
install: ## Install Node and Python dev dependencies (creates .venv/ if missing)
	npm ci
	@command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 is not installed or not on PATH." >&2; exit 1; }
	@test -d $(VENV) || python3 -m venv $(VENV)
	$(VENV)/bin/pip install --upgrade pip
	$(VENV)/bin/pip install -r requirements-dev.txt

clean-venv: ## Remove the local Python virtualenv
	rm -rf $(VENV)

# Linting
lint: lint-yaml lint-md lint-json lint-reuse ## Run all linters (YAML, Markdown, JSON, REUSE)

lint-yaml: ## Run yamllint on YAML files
	$(YAMLLINT) .github/workflows/ .yamllint.yml .markdownlint.yml

lint-md: ## Run markdownlint-cli2 on Markdown files
	markdownlint-cli2 '**/*.md'

lint-json: ## Validate marketplace.json
	$(PY) -m json.tool .claude-plugin/marketplace.json > /dev/null

lint-reuse: ## Verify REUSE / SPDX compliance (every file has copyright + license info)
	$(REUSE) lint

# Typecheck + plugin validation (mirrors the CI typecheck job)
typecheck: ## Run TypeScript typecheck
	npm run typecheck

check: ## Run plugin version check
	npm run check

validate: ## Run marketplace.json rule validation (per ADR-0001)
	npm run validate

validate-frontmatter: ## Validate YAML frontmatter on markdown files
	$(PY) scripts/validate-frontmatter.py

link-check: ## Validate markdown links via lychee (install: brew install lychee, or cargo install lychee)
	@command -v lychee >/dev/null 2>&1 || { echo "ERROR: lychee not installed. brew install lychee  OR  cargo install lychee" >&2; exit 1; }
	lychee --config lychee.toml '**/*.md'

test: ## Run unit tests
	npm test
