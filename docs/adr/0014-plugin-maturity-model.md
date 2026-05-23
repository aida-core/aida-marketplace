<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0014: Plugin Maturity Model

- **Status:** Accepted
- **Date:** 2026-05-23
- **Filed from:** [#21](https://github.com/aida-core/aida-marketplace/issues/21)

## Context

The marketplace catalogues plugins. Today there's no machine-readable
signal of *how mature* any listed plugin is across compliance, security,
DevOps, and quality dimensions. Manual audits don't scale; OpenSSF
Scorecard is too generic. A marketplace-aware grading system would
let operators see at a glance "is this listing well-maintained?" and
eventually gate listings on a minimum maturity level.

This ADR establishes the maturity model — its dimensions, scoring,
level mapping, and how it's run.

## Considered options

1. **Don't build it** — operators eyeball plugin repos.
   - Pros: zero work.
   - Cons: doesn't scale; no audit trail; the catalog has no signal of
     quality.

2. **Wrap OpenSSF Scorecard** — let Scorecard do the heavy lifting,
   add marketplace-specific checks on top.
   - Pros: reuses a maintained tool; broader signal.
   - Cons: heavy dep; many of Scorecard's checks aren't relevant to
     small Claude Code plugins (binary attestation, packaging
     workflow specifics); the output format isn't tuned to "is this
     ready for the catalog?"

3. **Build a focused, local-first model** — implement the
   marketplace-specific checks ourselves as a tight script. Local
   scan against a checked-out repo, no network, fast.
   - Pros: tight feedback loop; transparent check inventory;
     extensible (each check is one function); copyable into
     scaffolded marketplaces.
   - Cons: another tool to maintain; doesn't catch the broader
     issues Scorecard knows about.

## Decision

Adopt **option 3: build a focused, local-first model**.

### Dimensions

Four dimensions, six checks each (24 total in MVP):

| Dimension | Focus |
| --- | --- |
| **Compliance** | LICENSE, SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, CHANGELOG.md, AUTHORS / `package.json#author` |
| **Security** | `.gitignore` secret patterns, dep updater configured (Renovate/Dependabot), audit in CI, REUSE config, no leaked secret files at root, security contact in SECURITY.md |
| **DevOps** | CI workflow present, `permissions:` block, third-party Actions SHA-pinned, CODEOWNERS, issue/PR templates, pre-commit hooks |
| **Quality** | Task runner (Makefile/Taskfile/justfile), test runner config, lint config, type config, test files, README has usage |

### Scoring

Each check returns `present` | `partial` | `missing` | `n/a`.

Score = `(present + 0.5 * partial) / (present + partial + missing)`.
`n/a` is excluded from the denominator (used when a dimension has no
applicable artifacts, e.g., the security-contact check on a repo
with no SECURITY.md).

### Level mapping

| Score range | Level |
| --- | --- |
| `< 0.5` | **Level 1 — Foundation** |
| `0.5 – 0.69` | **Level 2 — Governed** |
| `0.7 – 0.89` | **Level 3 — Hardened** |
| `≥ 0.9` | **Level 4 — Exemplary** |

### MVP scope

- **Local-first**: scans a local filesystem path. No network.
  `--repo owner/name` mode (via `gh api`) is deferred.
- **JSON + Markdown output**: structured for tooling, readable for
  humans.
- **CI-runnable**: `make maturity` target; `--fail-under <level>` flag
  for opt-in CI gating.
- **Self-report committed**: `docs/maturity/self-report.md` is a
  snapshot of the marketplace's own maturity at the time of merge.
  Regenerate via `make maturity-report`.

### Org-fallback caveat

The compliance checks (`SECURITY.md`, `CONTRIBUTING.md`, etc.) look
for files in the repo itself. They do NOT detect GitHub's org-level
fallback (`<org>/.github/SECURITY.md` etc.). A repo that relies on
org fallbacks will score lower in the Compliance dimension than its
*effective* contributor-facing experience would suggest. This is an
intentional trade — the scanner has no way to know which org a
local clone "belongs to" — and is called out in the report's
narrative when relevant.

## Consequences

**Gained:**

- A reproducible, fast quality signal for any local repo.
- Per-dimension scores expose *what's weak* — operators see actionable
  gaps rather than a single opaque number.
- Pattern is scaffoldable into downstream marketplaces verbatim.
- 97 unit tests guard the scoring math and individual check logic;
  regression-resistant.

**Accepted costs:**

- Another tool to maintain. Mitigation: each check is a pure function
  with isolated tests; adding/removing checks is mechanical.
- Local-only MVP misses plugins listed in the marketplace that aren't
  cloned locally. Remote mode is the obvious follow-up (filed as #21a).
- Org-fallback files aren't detected, biasing compliance scores
  downward for repos that intentionally rely on org defaults.
- "Maturity" is a model, not a measurement. The check inventory is
  opinionated and will need to evolve as the catalog grows.

## Enforcement

- `scripts/maturity.ts` is the CLI; `scripts/maturity-checks.ts` is
  the check inventory; `scripts/maturity.test.ts` exercises both.
- `make maturity` runs the scan; default output is JSON. Use
  `--format markdown` for human reports.
- `make maturity-report` regenerates `docs/maturity/self-report.md`
  (committed for visibility).
- The maturity scan is NOT a required CI status check today. Operators
  can opt in via `--fail-under <level>` once they're comfortable with
  the model. (For the marketplace itself: currently `Level 3`. Don't
  enforce a minimum until it's been stable for a few cycles.)

## Deferred (filed as follow-ups)

1. **Remote mode** — `--repo owner/name` via `gh api /repos/.../contents`.
   Lets the scanner grade every plugin in the marketplace, not just
   local clones.
2. **Marketplace integration** — validator rule that rejects plugin
   listings below a minimum maturity level. Requires remote mode
   first.
3. **Badge endpoint** — JSON output suitable for shields.io.
4. **Historical tracking** — commit each per-run JSON to
   `docs/maturity/history/<timestamp>.json`.
5. **Org-fallback detection** — recognize when a repo relies on
   `<org>/.github` for compliance files and credit accordingly.
6. **Custom profiles** — `--profile python|node|rust` for
   language-specific check subsets.
