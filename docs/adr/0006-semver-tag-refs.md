<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0006: Plugin source refs must be semver tags

- **Status:** Accepted
- **Date:** 2026-05-23
- **Filed from:** [#43](https://github.com/aida-core/aida-marketplace/issues/43)

## Context

Each `plugins[].source.ref` in `marketplace.json` is a Git reference — a tag,
branch, or commit SHA. Today the field is unconstrained. That allows three
failure modes the marketplace doesn't want:

- **Branches drift silently.** A `ref: "main"` floats as the plugin author
  commits; consumers installing the plugin end up with whatever was on `main`
  at the moment of install, with no version pinning.
- **SHAs are unreadable.** A 40-char hex string in the manifest gives no
  signal about *what* version is pinned. Reviewers can't tell whether a bump
  is a patch or a major version.
- **Non-semver tags are unstable contracts.** A tag like `"release-2024-01"`
  doesn't compose with semver-aware tooling (Renovate, the existing version
  comparator in `update-marketplace.ts`, the validator's downstream rules).

The marketplace is a public catalog of plugin pins. Pins should be specific,
versioned, and machine-comparable.

## Considered options

1. **Forbid branches and SHAs, allow any Git tag.**
   - Pros: minimal restriction; any release tagging convention works.
   - Cons: non-semver tags (`release-2024-01`, `stable`) still break tooling
     that does version math.

2. **Require strict semver tags (`v?\d+\.\d+\.\d+`).**
   - Pros: composes with all semver-aware tooling; consumers can reason
     about version deltas; matches the convention `update-marketplace.ts`
     already enforces via `isValidSemver`.
   - Cons: forbids legitimate pre-release pins (`v1.2.3-rc1`).

3. **Allow full semver including pre-releases (`v?\d+\.\d+\.\d+(-.+)?`).**
   - Pros: enables pinning to release candidates for testing.
   - Cons: pre-releases in a public catalog are usually a mistake; they
     surface unstable code to consumers who expect stability.

4. **Require strict semver with mandatory `v` prefix (`v\d+\.\d+\.\d+`).**
   - Pros: enforces one consistent style.
   - Cons: extra restriction with no functional benefit; some plugin repos
     legitimately tag without the `v`.

## Decision

Adopt **option 2: strict semver tags, `v` prefix optional**.

The validator MUST accept `source.ref` values matching `^v?\d+\.\d+\.\d+$` and
reject everything else, including:

- Branch names (`main`, `develop`, `next`).
- Commit SHAs (40-char hex).
- Non-semver tags (`release-2024-01`, `stable`, `latest`).
- Pre-release tags (`v1.2.3-rc1`, `v1.2.3-beta.2`).
- Build-metadata tags (`v1.2.3+sha.abc123`).

Rationale:

- The marketplace is a stability boundary. Pins should be specific, stable,
  machine-comparable releases — not branches that drift, not pre-releases
  that surface unstable code, not opaque SHAs.
- Renovate's `extractVersionTemplate` already strips the optional `v` prefix
  (per the org-level config in `aida-core/.github`), so accepting either form
  costs nothing.
- The existing `isValidSemver` helper in `update-marketplace.ts` uses the
  same regex; this ADR canonicalizes that convention.

If a plugin author needs pre-release exposure to specific consumers, the
right channel is a separate pre-release marketplace, not the upstream
catalog — same pattern as ADR-0002's Simple vs Enterprise profile split.

## Consequences

**Gained:**

- Manifest pins are guaranteed to be specific, semver-comparable releases.
- Renovate, the validator, and downstream tooling can do version math
  without special cases.
- Reviewers can tell at a glance whether a bump is patch / minor / major.

**Accepted costs:**

- Pre-release testing requires a different channel (testing fork, separate
  marketplace, or direct repo install). The public catalog is for stable
  releases only.
- Plugin repos must publish semver tags; non-semver release schemes
  (date-based, etc.) are incompatible. In practice this aligns with
  AIDA's existing convention.
- This rule is sibling to ADR-0001 (validator language) and ADR-0003
  (entry kinds); it does not affect other ADR-defined rules.

## Enforcement

Validator rule `[ADR-0006]` (per [ADR-0001](./0001-validator-language.md)):

- Every `plugins[]` entry whose `source.source === "github"` has a
  `source.ref` matching `^v?\d+\.\d+\.\d+$`.
- Non-github sources are SKIPPED (the rule applies only to GitHub refs).
- Missing `source.ref` is a FAIL.
- Failure messages cite this ADR.

The check is offline and pattern-based — no network calls. The validator
does not verify that the tag *exists* on the source repo; that's covered
by the existing `update-marketplace.ts --check` flow (which does fetch
release tags via the GitHub API) and by Renovate (which fails the auto-
update PR if the tag can't be resolved).
