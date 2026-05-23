<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Plugin Maturity Report

- **Path:** `/Users/dx-aida-core/Developer/aida-core/aida-marketplace`
- **Scanned:** 2026-05-23T21:05:26.886Z

## Overall: Level 3 — Hardened (80%)

## Compliance — Level 2 — Governed (50%)

Counts: 3 present, 0 partial, 3 missing, 0 n/a

| | Check | Evidence |
| --- | --- | --- |
| ✓ | LICENSE file at the repo root | found LICENSE |
| ✗ | SECURITY.md | no SECURITY.md (org-level fallback at `<org>/.github/SECURITY.md` is not detected here) |
| ✗ | CONTRIBUTING.md | no CONTRIBUTING.md |
| ✗ | CODE_OF_CONDUCT.md | no CODE_OF_CONDUCT.md |
| ✓ | CHANGELOG.md (Keep a Changelog format) | found CHANGELOG.md with Keep a Changelog reference |
| ✓ | Authorship metadata (AUTHORS or package.json#author) | found AUTHORS file |

## Security — Level 4 — Exemplary (100%)

Counts: 5 present, 0 partial, 0 missing, 1 n/a

| | Check | Evidence |
| --- | --- | --- |
| ✓ | .gitignore covers secret patterns | 6/6 secret patterns ignored |
| ✓ | Dependency updater configured (Renovate or Dependabot) | found renovate.json |
| ✓ | Dependency audit tool in CI | an audit command is referenced in a CI workflow |
| ✓ | REUSE / SPDX compliance config | REUSE.toml at root |
| ✓ | No obvious secret files at repo root | no id_rsa / id_ed25519 / credentials / .env at repo root |
| - | SECURITY.md names a contact (mailto: or security@) | no SECURITY.md to check |

## Devops — Level 3 — Hardened (75%)

Counts: 4 present, 1 partial, 1 missing, 0 n/a

| | Check | Evidence |
| --- | --- | --- |
| ✓ | CI workflow(s) present | 6 workflow file(s) in .github/workflows/ |
| ✓ | Workflows declare permissions: | all 6 workflows declare top-level permissions |
| ✓ | Third-party Actions SHA-pinned | 21/21 action references SHA-pinned |
| ✓ | CODEOWNERS file | found .github/CODEOWNERS |
| ~ | Issue and/or PR templates | ISSUE_TEMPLATE/ present; no PULL_REQUEST_TEMPLATE |
| ✗ | Pre-commit hooks configured | no pre-commit / lefthook / husky configuration |

## Quality — Level 4 — Exemplary (100%)

Counts: 6 present, 0 partial, 0 missing, 0 n/a

| | Check | Evidence |
| --- | --- | --- |
| ✓ | Task runner (Makefile / Taskfile / justfile) | found Makefile |
| ✓ | Test runner configured (package.json#scripts.test or pytest config) | package.json#scripts.test set |
| ✓ | Lint config present | found .yamllint.yml |
| ✓ | Type-check configuration | found tsconfig.json |
| ✓ | Test files exist | 3 test file(s) found |
| ✓ | README has a usage section (fenced code block) | README contains at least one fenced code block |
