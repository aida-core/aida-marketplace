<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Changelog

All notable changes to the AIDA marketplace are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the marketplace adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
