<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0013: Marketplace release model

- **Status:** Accepted
- **Date:** 2026-05-23
- **Filed from:** [#77](https://github.com/aida-core/aida-marketplace/issues/77)

## Context

`marketplace.json` carries a top-level `"version"` field (currently
`"0.2.0"`). The marketplace is consumed via
`github>aida-core/aida-marketplace` refs — there's no published artifact
beyond the git tree itself. That works for the install lane (consumers
track `main`), but it doesn't address the audit lane: regulated downstream
operators and supply-chain reviewers need a "what was the registry at
moment X" artifact they can pin to and diff against.

[ADR-0006](./0006-semver-tag-refs.md) enforces semver tags on plugin
`source.ref` values. The same discipline naturally extends to the
marketplace's own version. [ADR-0010](./0010-branch-protection-baseline.md)
already protects `v*` tags from rewrite/deletion. What's missing is the
workflow that turns a `v*` tag push into an immutable audit artifact.

## Considered options

1. **No releases** — keep `version` as a soft field; consumers always
   track `main`.
   - Pros: zero added CI surface; no tag-vs-manifest coordination.
   - Cons: no audit artifact; `version` field becomes a lie that
     nobody verifies; regulated downstreams must re-invent this.

2. **Auto-tag on every Renovate merge** — every plugin bump produces a
   new marketplace patch release.
   - Pros: fully automatic; consumers can pin to fresh tags.
   - Cons: tag spam; the "release" loses signal value when every
     Renovate PR creates one; high coordination cost with
     branch-protection / required-signatures.

3. **Manual semver tag at maintainer discretion** — maintainer cuts
   a release when the manifest state is worth pinning.
   - Pros: tag = real signal; bump policy ties to ADR-0006 semver
     discipline; reuses existing CHANGELOG flow.
   - Cons: depends on maintainer judgment; no fixed cadence.

4. **Periodic snapshots** (weekly cron tags).
   - Pros: fixed cadence; predictable for auditors.
   - Cons: no signal value; tags accumulate fast; awkward for
     downstreams who want to pin meaningful snapshots.

## Decision

Adopt **option 3: manual semver tag at maintainer discretion**.

### Release shape

A release is a git tag `v<X>.<Y>.<Z>` on `main` plus a GitHub Release
containing three artifacts:

1. **`marketplace.json`** — verbatim snapshot of the registry at the tag.
2. **`plugin-pins.json`** — derived array of
   `{name, repo, ref, version}` for each listed plugin. One file, one
   line per plugin, sortable and diffable between releases.
3. **`sbom.cdx.json`** — CycloneDX 1.6 SBOM of the marketplace's own
   `package-lock.json` (the validator's supply chain).

### Bump policy

- **patch** (`v0.2.0 → v0.2.1`): plugin patch/minor bumps only; no
  new plugins, no ADR-driven schema changes.
- **minor** (`v0.2.0 → v0.3.0`): a new plugin or guidebook is added,
  an ADR with consumer-visible effect ships, or a plugin's major bump
  is pinned.
- **major** (`v0.2.0 → v1.0.0`): a breaking change to
  `marketplace.json` shape (new required field, removed field), or
  removal of a previously-listed plugin.

### Constraints

- `marketplace.json#version` MUST equal the tag's version (the tag's
  leading `v` is stripped for comparison). The release workflow
  asserts this and fails loudly with a fix-up hint if they diverge.
- Pre-release tags (`v0.3.0-rc1`) are NOT used for the marketplace
  itself — ADR-0006 forbids them for plugin refs and the same
  discipline applies here. Cut release candidates as separate
  branches if needed; tag only finals.
- Tag protection (per ADR-0010) prevents rewrites/deletions of `v*`
  once an SBOM has been published referencing them.

### Workflow gates (run before publishing the release)

The release workflow re-runs the validator (per ADR-0001), the plugin
version check, and `npm audit` (per ADR-0012). A tagged release that
fails CI is the failure mode worth blocking on.

## Consequences

**Gained:**

- Regulated downstream operators have a stable pin target +
  diffable SBOM.
- `version` field becomes verifiable rather than aspirational.
- Reference-implementation pattern: scaffolded downstream
  marketplaces inherit a working release pipeline.
- CHANGELOG `[Unreleased]` flow stays meaningful — releases
  trigger the flip to a versioned section.

**Accepted costs:**

- Tag-push discipline (sign the tag, push to origin, wait for
  workflow). Documented in [`docs/runbooks/release.md`](../runbooks/release.md).
- One additional workflow to maintain (`.github/workflows/release.yml`).
- SBOM and plugin-pins artifacts must be regenerated on every release —
  no caching across releases.

## Enforcement

- **Workflow gate:** `release.yml` triggers on `push: tags: ['v*.*.*']`.
  Re-runs validator + version-check + audit before publishing.
- **Version-match assertion:** workflow fails if
  `marketplace.json#version` doesn't match the tag.
- **Tag protection:** already enabled via ADR-0010 — tags can't be
  rewritten or deleted once landed.
- **Runbook:** [`docs/runbooks/release.md`](../runbooks/release.md)
  with literal `git tag -s ... && git push` sequence and pre-release
  checklist (flip `[Unreleased]` → `[v<X>.<Y>.<Z>]` in the same PR
  that bumps `marketplace.json#version`).

The release artifact set (`marketplace.json` + `plugin-pins.json` +
`sbom.cdx.json`) is the contract. Downstream consumers can rely on it
being present on every `v*` release; scaffolded marketplaces should
mirror it.
