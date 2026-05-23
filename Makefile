# SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors
# SPDX-License-Identifier: MPL-2.0

# AIDA Marketplace Makefile
# Run `make help` for available targets

.PHONY: help install lint lint-yaml lint-md lint-json lint-reuse typecheck check

help: ## Show this help message
	@echo "AIDA Marketplace - Available targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""

# Dependencies
install: ## Install Node and Python dev dependencies
	npm ci
	pip install -r requirements-dev.txt

# Linting
lint: lint-yaml lint-md lint-json lint-reuse ## Run all linters (YAML, Markdown, JSON, REUSE)

lint-yaml: ## Run yamllint on YAML files
	yamllint .github/workflows/ .yamllint.yml .markdownlint.yml

lint-md: ## Run markdownlint-cli2 on Markdown files
	markdownlint-cli2 '**/*.md'

lint-json: ## Validate marketplace.json
	python3 -m json.tool .claude-plugin/marketplace.json > /dev/null

lint-reuse: ## Verify REUSE / SPDX compliance (every file has copyright + license info)
	reuse lint

# Typecheck + plugin validation (mirrors the CI typecheck job)
typecheck: ## Run TypeScript typecheck
	npm run typecheck

check: ## Run plugin version check
	npm run check
