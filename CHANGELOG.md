<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Changelog

All notable changes to the AIDA marketplace are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the marketplace adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `scripts/validate-marketplace.ts` — the marketplace validator
  (per ADR-0001). Pluggable rule framework that emits per-finding
  `OK` / `FAIL` records with the originating ADR number in the
  message. Wired into CI as a blocking gate.
- `scripts/marketplace-types.ts` — shared TypeScript types for the
  manifest, imported by both `update-marketplace.ts` and
  `validate-marketplace.ts` so the two stay in sync.
- `scripts/validate-marketplace.test.ts` — unit tests for the
  validator and its rules. Uses Node's built-in `node:test` so no
  new test-framework dependency is required.
- Two enforced rules in the validator:
  - `[ADR-0003]` — every `plugins[]` entry has `kind` (`plugin`
    or `guidebook`) and its `source.repo` ends in the matching
    suffix.
  - `[ADR-0005]` — `owner.name` and every `plugins[].author.name`
    is a valid GitHub slug; `email` is forbidden on both;
    `owner.url` is forbidden.
- `make validate` / `make test` targets and `npm run validate` /
  `npm test` scripts that exercise the validator and the test
  suite respectively.
- `renovate.json` adopting the Simple profile per ADR-0002. Extends
  the org-level Renovate config at
  [`aida-core/.github`](https://github.com/aida-core/.github/blob/main/default.json)
  (which provides the marketplace.json regex manager, labeling
  rules, and dashboard-approval gating). Adds the Simple-profile
  override: auto-merge minor/patch updates from `aida-core/*`
  sources behind required CI checks. Majors and external sources
  go through dashboard approval per the inherited org rules.
- `docs/adr/` directory adopting ADR-driven governance for the
  marketplace (umbrella #42). Five Phase 1 ADRs accepted from the
  /discuss issues filed in May:
  - ADR-0001: validator implementation language → TypeScript (#57)
  - ADR-0002: marketplace operator profiles → Simple / Enterprise
    (#56); aida-marketplace adopts Simple
  - ADR-0003: entry kinds → `plugin` / `guidebook` with dual
    enforcement (schema field + matching repo suffix, validator
    checks both agree) (#55)
  - ADR-0004: GitHub App → profile-conditional (Simple is App-less,
    Enterprise requires one) (#58)
  - ADR-0005: author and owner identity → GitHub slugs everywhere,
    no email, no owner.url; operator chooses personal vs org slug
    for `owner.name` (#59)
- `docs/profiles/renovate-simple.json` — reference Renovate config
  for Simple-profile marketplaces. Auto-merges trusted-source
  minor/patch updates behind CI; gates external sources and major
  bumps on dashboard approval.
- `docs/profiles/renovate-enterprise.json` — reference Renovate
  config for Enterprise-profile marketplaces. Conservative defaults
  (`automerge: false`) with dashboard approval for non-trusted
  sources and major bumps.
- `AUTHORS` file at the repo root listing substantive contributors.
  The collective copyright holder used in SPDX file headers is
  "The AIDA Marketplace Authors"; the AUTHORS roster is the
  authoritative list of who that collective is. Lets file headers
  stay stable as the contributor list grows — new substantive
  contributors are appended on first merged PR.
- SPDX `SPDX-FileCopyrightText` / `SPDX-License-Identifier` headers
  on every hand-authored source file (Markdown, YAML, TOML,
  CODEOWNERS, TypeScript, Makefile, requirements). Inserted via the
  new `scripts/add_spdx_headers.py` — idempotent, dry-run by
  default, reads `git ls-files` and skips fixtures, JSON, lockfiles,
  and `LICENSE` itself per the org skip list.
- `REUSE.toml` at the repo root licensing the skip categories
  (JSON files, `AUTHORS`, `.gitignore`, `.markdownlintignore`,
  `.gitkeep`). Repo is REUSE 3.3 compliant.
- `LICENSES/MPL-2.0.txt` (REUSE-required canonical license text).
  `LICENSE` at root is unchanged so GitHub still displays it.
- `Makefile` exposing `lint-yaml`, `lint-md`, `lint-json`,
  `lint-reuse`, and an aggregate `lint` target. Mirrors the
  pattern used in `aida-core/aida-core-plugin`.
- `requirements-dev.txt` pinning `yamllint>=1.35` and
  `reuse>=4.0` for local + CI use.

### Changed

- `.claude-plugin/marketplace.json` migrated to comply with ADR-0003
  and ADR-0005: added `kind: "plugin"` to the aida-core entry;
  changed the per-plugin `author` to `{ "name": "aida-core" }`
  (org slug, no email); slimmed top-level `owner` to
  `{ "name": "oakensoul" }` (no email, no url — operator choice
  to retain personal handle).
- CI `lint` job now runs `make lint-yaml` / `make lint-md` /
  `make lint-json` / `make lint-reuse`. `reuse lint` is now a
  blocking gate for SPDX/REUSE compliance.
- `check-updates.yml` workflow now prunes prior `automated/plugin-updates-*`
  branches before opening a new update PR, so closed/superseded automation
  branches no longer accumulate on origin.

## [0.2.0] - 2026-04-28

Governance, policy, and a new aida-core pin. Adds branch-protection
support files (CODEOWNERS, MAINTAINERS.md) and an AI-attribution gate
in CI; bumps the aida-core plugin pin to v1.4.6.

### Added

- CI workflow `no-ai-coauthor.yml` that fails any PR whose commits contain
  `Co-Authored-By:` trailers attributing authorship to known AI tools
  (Claude, Copilot, Cursor, ChatGPT, Gemini, Aider, Codex, Tabnine) or
  to Anthropic / OpenAI noreply addresses. There is no skip label.
- `.github/CODEOWNERS` defining required reviewers per path
  (`@oakensoul` is the default owner; specific paths for
  `.claude-plugin/`, `.github/`, `scripts/`, and top-level docs).
  Combined with the new `require_code_owner_reviews: true` branch
  protection setting, this makes path-owner approval mandatory.
- `MAINTAINERS.md` describing the role model (Owner / Committer /
  Collaborator) since GitHub's CODEOWNERS syntax has no notion of
  "owner vs committer" — only "required reviewer." Lists current
  people and the process to add a committer.

### Changed

- Bumped `aida-core` plugin pin from v1.4.2 to v1.4.6.
- Top-level `version` field in `marketplace.json` bumped to `0.2.0`.
- Stripped pre-existing AI co-author trailers from `main` history via
  `git filter-branch` (force-pushed). The trailers were on 7 historical
  commits and have been removed; commit subjects and content are
  unchanged. New commit SHAs as a result — anyone with a local clone
  should `git fetch && git reset --hard origin/main`.

## [0.1.0] - 2026-04-28

First versioned release of the marketplace. Cuts the org transfer from
`oakensoul/` to `aida-core/` and establishes changelog/version conventions.

### Added

- Top-level `version` field in `marketplace.json`, validated as semver by
  the update script. Gives consumers a programmatic way to know which
  marketplace release they are pointing at.
- `CHANGELOG.md` (this file), following Keep a Changelog conventions.
- CI `changelog` job that fails a PR if `CHANGELOG.md` was not modified.
  Apply the `skip-changelog` label to bypass for genuinely
  changelog-irrelevant PRs (typo fixes, internal CI tweaks).

### Changed

- Marketplace and `aida-core` plugin transferred from the `oakensoul/`
  GitHub org to the new `aida-core/` org on 2026-04-28.
- `marketplace.json` `source.repo` and `homepage` now point at
  `aida-core/aida-core-plugin`.
- Plugin update script now treats both `oakensoul` and `aida-core` as
  trusted owners so the weekly auto-update keeps working post-transfer.
- README install snippet, plugin link, documentation link, and
  contribution / issues link updated to the new canonical URLs.

### For existing users

Nothing breaks — GitHub redirects keep `oakensoul/aida-marketplace` and
`oakensoul/aida-core-plugin` resolving to their new locations, and plugin
updates continue to flow through normally.

If you want your local Claude Code state to record the canonical org,
re-add the marketplace under the new name:

```bash
/plugin marketplace remove aida
/plugin marketplace add aida-core/aida-marketplace
```

This is purely cosmetic and can be done at your convenience.
