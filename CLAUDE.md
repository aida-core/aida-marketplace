---
type: documentation
title: AIDA Marketplace — project context for Claude Code
description: Always-loaded project memory for Claude Code working on aida-marketplace. Hard rules, repo layout, command reference, and a map into knowledge/ for deeper context loaded on demand.
audience: contributors
---

<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# AIDA Marketplace — Claude Code project memory

This repo is the **canonical reference marketplace for AIDA**. `aida-core-plugin`
will eventually scaffold downstream marketplaces from this one. Quality bar is
high: patterns here are designed to be copied verbatim.

This file is loaded into every conversation. Keep it terse. Deeper material
lives in `knowledge/` — load those files via `Read` when the question calls for
them (see Knowledge map below).

## Repo layout

```text
.claude-plugin/marketplace.json   — the manifest Claude Code reads
schemas/marketplace.schema.json   — structural schema (referenced by manifest's $schema)
scripts/                          — TypeScript validator, frontmatter validator, update tool
docs/adr/                         — Architecture Decision Records (0001–0010)
docs/runbooks/                    — operational runbooks (branch-protection, etc.)
knowledge/                        — progressively-read reference material (this directory)
.github/workflows/                — CI: typecheck, lint, validator, frontmatter, link-check, labeler
renovate.json                     — Renovate per-repo overrides (extends aida-core/.github)
```

## Hard rules (from accepted ADRs — see `docs/adr/README.md`)

- **Entry kind + suffix match.** Every `plugins[]` entry has `kind: "plugin"`
  or `kind: "guidebook"`, and `source.repo` ends with that suffix. (ADR-0003)
- **Identity is a GitHub slug.** `owner.name` and `plugins[].author.name` are
  GitHub slugs only. No `email`, no `owner.url`. (ADR-0005)
- **Refs are semver tags.** `source.ref` matches `v?\d+\.\d+\.\d+$`. No
  branches, no SHAs, no pre-release/build-metadata tags. (ADR-0006)
- **Categories are a closed set.** `category` is one of `core`, `workflow`,
  `infrastructure`, `language`, `integration`, `domain`, `productivity`,
  `security`, `observability`. (ADR-0007)
- **Listed plugins ship `.claude-plugin/aida-config.json`** at the pinned
  `source.ref`. The foundation (`aida-core/aida-core-plugin`) is exempt.
  (ADR-0009)
- **JSON Schema is the structural source of truth.** `schemas/marketplace.schema.json`
  defines the manifest shape; validator runs ajv first, semantic rules second.
  (ADR-0008)
- **Rule = ADR + check in same PR.** Adding a new constraint means writing an
  ADR, updating the schema (if structural), and adding a validator rule —
  in one PR. (#42)
- **No AI co-author trailers.** The `no-ai-coauthor.yml` CI gate blocks PRs
  whose commits contain AI attribution. There's no skip label.
- **SPDX header on every hand-authored file.** REUSE lint is a blocking gate.
- **Signed commits required on `main`.** Per ADR-0010 branch protection.

## Commands

| Command | What |
| --- | --- |
| `make install` | Create `.venv/`, install npm + Python dev deps |
| `make lint` | yamllint, markdownlint, json, REUSE |
| `make validate` | Run the marketplace.json validator (schema + ADR rules) |
| `make validate-frontmatter` | Validate YAML frontmatter on `.md` files |
| `make test` | Unit tests via `node:test` |
| `make typecheck` | `tsc --noEmit` |
| `make link-check` | lychee against all markdown |
| `make check` | Plugin version check (calls `gh api`) |
| `npm run update` | Apply pending version bumps to `marketplace.json` |

## Knowledge map

When a question goes beyond the hard rules above, `Read` one of these:

- `knowledge/index.md` — catalog of this directory + audience-mode guidance
- `knowledge/workflows.md` — step-by-step recipes (add a plugin, amend an ADR,
  add a validator rule, rebuild the manifest, bump a category)
- `knowledge/tooling.md` — inventory of every tool, what it does, where it
  lives (validator, schema, Renovate, lychee, labeler, CI workflows, AI
  co-author gate)
- `knowledge/troubleshooting.md` — common contributor failures (REUSE lint,
  frontmatter, link-check, signed commits, validator rules)

Knowledge files carry YAML frontmatter for AIDA's frontmatter validator
(per ADR-0008). The frontmatter is metadata for AIDA tooling, **not** a
signal Claude Code uses to choose which file to load — the file path being
mentioned here is what makes Claude aware that the file is worth reading.

For ADR depth, read `docs/adr/README.md` for the index, then the specific
ADR. Don't paraphrase ADRs from memory — they are short, read the source.

## Related

- `README.md` — installation and consumer-facing docs
- `MAINTAINERS.md` — role model (Owner / Committer / Collaborator)
- `docs/runbooks/branch-protection.md` — `gh api` commands for ADR-0010
- `CHANGELOG.md` — Keep a Changelog format; updated on every PR
- `.github/CODEOWNERS` — required-reviewer rules
