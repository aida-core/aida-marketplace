<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Plugin Maturity Model

A focused, local-first scoring system that grades a plugin repository
across four dimensions — Compliance, Security, DevOps, Quality — and
produces a maturity level (1=Foundation, 2=Governed, 3=Hardened,
4=Exemplary).

See [ADR-0014](../adr/0014-plugin-maturity-model.md) for the design
rationale and check inventory.

## Run it

```bash
# Scan the current directory; print JSON to stdout
make maturity

# Markdown report (human-readable)
npx tsx scripts/maturity.ts . --format markdown

# Scan a different path
npx tsx scripts/maturity.ts /path/to/plugin-repo --format markdown

# CI gate: fail if overall level < 3
npx tsx scripts/maturity.ts . --fail-under 3
```

## Files

- [`self-report.md`](./self-report.md) — committed snapshot of THIS
  marketplace's own maturity. Regenerate with `make maturity-report`.

## Interpreting the report

Each check returns one of:

- **`present` (✓)** — the artifact / behavior is in place
- **`partial` (~)** — the artifact exists but is incomplete (e.g.,
  `.gitignore` exists but covers only one secret pattern)
- **`missing` (✗)** — the artifact is absent
- **`n/a` (-)** — the check doesn't apply (excluded from scoring)

Score = `(present + 0.5 * partial) / (present + partial + missing)`.

## Org-fallback caveat

The Compliance dimension checks for `SECURITY.md`, `CONTRIBUTING.md`,
`CODE_OF_CONDUCT.md` in the local repo. GitHub's org-level fallbacks
(`<org>/.github/SECURITY.md` etc.) are NOT detected — the local
scanner has no way to know which org a clone belongs to.

If your repo intentionally relies on org defaults, the Compliance
score will read lower than the effective contributor experience.
Detection of org fallbacks is filed as a future enhancement.

## Adding a new check

1. Add the function to `scripts/maturity-checks.ts` (one pure
   function per check).
2. Add it to the appropriate dimension array in `DIMENSIONS`.
3. Add a test in `scripts/maturity.test.ts`.
4. Regenerate `docs/maturity/self-report.md`.
5. CHANGELOG entry.

## Deferred enhancements

See the "Deferred" section of [ADR-0014](../adr/0014-plugin-maturity-model.md):
remote mode, marketplace integration (validator gate), badge endpoint,
historical tracking, org-fallback detection, custom profiles.
