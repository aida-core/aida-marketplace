---
type: reference
title: Tooling inventory — validators, CI, Renovate, schemas
description: What's wired up in aida-marketplace and where each tool lives. Reference for contributors who need to know which check enforces what before they touch a file.
---

<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Tooling inventory

## `.claude-plugin/` — the manifest layer

| File | What |
| --- | --- |
| `.claude-plugin/marketplace.json` | The manifest Claude Code reads. Has `$schema` pointing at the canonical schema. |

The manifest is the single source of truth for what plugins/guidebooks the
marketplace lists. Every validator and CI check ultimately targets this
file.

## `schemas/` — structural definitions

| File | What |
| --- | --- |
| `schemas/marketplace.schema.json` | JSON Schema draft-07 for `marketplace.json`. Mirrors value-level constraints from ADRs 0003, 0005, 0006, 0007. Cross-field rules (kind ↔ suffix matching) live in the validator, not here. (ADR-0008) |

The frontmatter schema for markdown files is **referenced not vendored**.
It lives at `aida-core/aida-core-plugin/.frontmatter-schema.json` and is
fetched by `validate-frontmatter.py` at runtime (or overridden via
`$AIDA_FRONTMATTER_SCHEMA`).

## `scripts/` — TypeScript validator + helpers

| File | What |
| --- | --- |
| `scripts/validate-marketplace.ts` | The validator. Loads the schema, runs ajv structural validation, then runs 5 ADR-traced semantic rules. Exits 1 if any rule emits a FAIL. |
| `scripts/marketplace-types.ts` | Shared TypeScript types for the manifest. Imported by both `update-marketplace.ts` and `validate-marketplace.ts`. |
| `scripts/validate-marketplace.test.ts` | 62 unit tests using `node:test` (built-in; no extra deps). Run via `make test`. |
| `scripts/update-marketplace.ts` | The version-bump and README-render tool. Called by `npm run check` (read-only) and `npm run update` (writes). |
| `scripts/validate-frontmatter.py` | Python frontmatter validator. Fetches schema from upstream URL by default; skips files without frontmatter (gradual adoption). |
| `scripts/add_spdx_headers.py` | One-shot SPDX header insertion tool. Idempotent. |

The validator's `Rule` interface is the extension point. Add a new rule
by appending to `RULES` and updating `marketplace.schema.json`/tests — see
`knowledge/workflows.md` § "Add a new validator rule."

## `.github/workflows/` — CI

| Workflow | Triggers | Purpose |
| --- | --- | --- |
| `ci.yml` | push/PR to main | TypeScript (typecheck + tests + validator + `npm run check`), Lint (yaml/md/json/REUSE/frontmatter), Changelog gate |
| `no-ai-coauthor.yml` | PR to main | Scans PR commit trailers for AI co-author attribution and rejects |
| `check-updates.yml` | Mon 08:00 UTC + dispatch | Legacy auto-PR for plugin version bumps. Renovate is the primary path now |
| `labeler.yml` | PR to main | `actions/labeler` applies category labels by changed paths |
| `link-check.yml` | PR (when md changes) + Mon 09:00 UTC + dispatch | lychee link validation; PR job fails on broken links, cron job opens an issue |

All workflows have top-level `permissions: contents: read` as the
least-privilege baseline. Jobs that need broader scope (PR creation, issue
creation, label writes) escalate at job level.

All third-party Actions are SHA-pinned with a trailing `# vX.Y.Z` comment;
Renovate maintains the pins.

## Renovate (org-extended)

Per ADR-0002, this repo uses the Simple profile. Configuration:

- **Org-level defaults** live in `aida-core/.github/default.json`:
  custom regex manager for marketplace `source.ref` values, labeling rules
  (`trusted-source` / `external-source` / `major-version`), supply-chain
  gates (`minimumReleaseAge: "14 days"`, `minimumConfidence: "high"`),
  CVE auto-merge for patch+minor via `vulnerabilityAlerts`.
- **Per-repo overrides** in `renovate.json`: extend the org config; enable
  auto-merge for `aida-core/*` minor/patch; set `minimumReleaseAge: "0 days"`
  for `aida-core/*` (we own those plugins).

## Dependabot

- **Vulnerability alerts:** enabled. Surfaces CVEs from the GHSA database.
- **Security updates:** deliberately disabled — Renovate already handles
  CVE-patch auto-merge, and enabling Dependabot security updates would
  create duplicate PRs.

See [`docs/runbooks/branch-protection.md`](../docs/runbooks/branch-protection.md)
for the `gh api` commands.

## REUSE / SPDX

- `REUSE.toml` covers JSON files (which can't carry inline SPDX) and a few
  named config files (AUTHORS, .gitignore, .markdownlintignore, .gitkeep).
- `LICENSES/MPL-2.0.txt` carries the canonical license text.
- `make lint-reuse` is a blocking CI gate via `reuse lint`.
- New hand-authored files MUST carry an SPDX header
  (`SPDX-FileCopyrightText` + `SPDX-License-Identifier`).
- `scripts/add_spdx_headers.py` exists for one-shot rollouts.

## Linting + formatting

| Tool | Where | Notes |
| --- | --- | --- |
| `yamllint` | `.yamllint.yml` | Workflow YAML + dotfiles |
| `markdownlint-cli2` | `.markdownlint.yml` | 300-char line limit, blank lines around lists/headings |
| `tsc --noEmit` | `tsconfig.json` | TypeScript strict mode |
| `reuse` | `REUSE.toml` | SPDX/REUSE compliance |
| `lychee` | `lychee.toml` | Markdown link validation |

## Branch protection (GitHub-enforced)

See [`docs/runbooks/branch-protection.md`](../docs/runbooks/branch-protection.md)
and [ADR-0010](../docs/adr/0010-branch-protection-baseline.md).

Required status checks for Simple-profile (this repo): `TypeScript`,
`Lint`, `No AI Co-Authors`, `Changelog`, `PR scope (changed markdown only)`.

## Makefile

The Makefile is the single entry point for every local command. `$(PY)`,
`$(YAMLLINT)`, `$(REUSE)` resolve to venv binaries (`.venv/bin/...`) if
`make install` has been run, system binaries otherwise. Recursive
expansion (`=`, not `:=`) so `make install lint` in one invocation works
correctly. Make 3.81-compatible (no `export PATH`).

## What's NOT here

- **Pre-commit hooks** — deferred to follow-up [#78](https://github.com/aida-core/aida-marketplace/issues/78).
- **`npm audit` in CI** — deferred to [#76](https://github.com/aida-core/aida-marketplace/issues/76); policy ADR pending.
- **Release workflow + SBOM** — deferred to [#77](https://github.com/aida-core/aida-marketplace/issues/77).
- **CODEOWNERS validation** — deferred to [#81](https://github.com/aida-core/aida-marketplace/issues/81).
- **Marketplace-specific issue templates** — deferred to [#79](https://github.com/aida-core/aida-marketplace/issues/79).
