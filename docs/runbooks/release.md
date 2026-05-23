<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Runbook: cut a marketplace release

Operational reference for [ADR-0013](../adr/0013-marketplace-release-model.md).
Releases are manual, semver-tagged, and produce three artifacts attached
to a GitHub Release.

## Prerequisites

- You're the marketplace **Owner** (per `MAINTAINERS.md`).
- Signed-commit setup per GitHub's
  [docs](https://docs.github.com/en/authentication/managing-commit-signature-verification).
  Tag protection on `v*` (per ADR-0010) doesn't enforce signing on tags
  directly, but the practice matters for the audit lane.
- Local clone on `main` is up-to-date.

## Pre-release checklist

Decide the bump per [ADR-0013](../adr/0013-marketplace-release-model.md):

- **patch** (`v0.2.0 → v0.2.1`) — plugin patch/minor bumps only
- **minor** (`v0.2.0 → v0.3.0`) — new plugin, ADR with consumer-visible
  effect, or plugin major bump
- **major** (`v0.2.0 → v1.0.0`) — breaking schema change or plugin removal

Pre-release PR:

1. Edit `.claude-plugin/marketplace.json` — bump the top-level
   `"version"` to the target version (no `v` prefix; the string).
2. Edit `CHANGELOG.md` — rename `## [Unreleased]` to
   `## [<X>.<Y>.<Z>] - YYYY-MM-DD`. Leave `## [Unreleased]` heading
   above with empty `### Added` / `### Changed` / `### Removed`
   subsections for the next cycle.
3. Open PR, get CI green, merge.

## Tag the release

After the pre-release PR merges:

```bash
git checkout main
git pull --ff-only

# Tag the release commit. Sign it (GPG or SSH).
git tag -s "v<X>.<Y>.<Z>" -m "Release v<X>.<Y>.<Z>"

# Push the tag. Triggers .github/workflows/release.yml.
git push origin "v<X>.<Y>.<Z>"
```

## What the workflow does (in order)

1. **Re-runs the validator** (ADR-0001) on the tagged tree.
2. **Re-runs the plugin version check** (`npm run check`).
3. **Re-runs `npm audit --audit-level=high`** (ADR-0012).
4. **Asserts `marketplace.json#version` equals the tag** (minus `v`
   prefix). Fails loudly if they diverge.
5. **Generates `plugin-pins.json`** — derived
   `{name, repo, ref, version}[]` for the audit lane.
6. **Generates `sbom.cdx.json`** — CycloneDX 1.6 SBOM of the validator's
   own supply chain (this repo's `package-lock.json`). Uses
   `@cyclonedx/cyclonedx-npm`.
7. **Extracts the matching `CHANGELOG.md` section** as release notes.
8. **Creates a GitHub Release** named `v<X>.<Y>.<Z>` with the three
   artifacts attached: `marketplace.json`, `plugin-pins.json`,
   `sbom.cdx.json`.

## After the workflow

- **Verify the release:** `gh release view "v<X>.<Y>.<Z>"`. Confirm all
  three artifacts are present and the release notes match the CHANGELOG
  section.
- **Tag protection is automatic** — ADR-0010's tag protection on `v*`
  prevents rewrites and deletions once landed.
- **Communicate** the release per your usual channels (PR thread, Slack,
  etc.) if anyone is pinning to specific marketplace versions.

## Common scenarios

### "The workflow failed on `Assert manifest version matches tag`"

You bumped the tag but not `marketplace.json#version` (or vice versa).
The workflow output names the mismatch. Fix:

1. Delete the local tag: `git tag -d v<X>.<Y>.<Z>`
2. **Don't push-delete the remote tag** — tag protection blocks it,
   and even if it didn't, deleting a published tag is anti-pattern.
3. Open a fix-up PR bumping `marketplace.json#version` to match the
   tag, OR pick the next available version number and re-tag.

### "Renovate opened a PR right before I tagged"

Merge the Renovate PR first if it's relevant to the release. Tagging
catches the tip of `main` at tag time — any PR not merged is excluded.

### "I need to cut a hotfix release"

Same flow. Hotfixes are patches (`v0.3.0 → v0.3.1`). Don't release
from a non-`main` branch unless you've set up a sustained release-branch
model (currently not in scope).

### "The SBOM generation step failed"

Most likely cause: a transient `npx` download failure. Re-run the
workflow from the GitHub Actions UI (re-run failed jobs). The tag
push is the authoritative trigger; re-running the workflow does
not require a new tag.

### "I want to delete an accidental tag"

You can't — tag protection blocks deletion. If a tag was pushed in
error, the right response is:

1. The (incorrect) release artifact stays in history; that's the
   point of immutable releases.
2. Cut a new tag with the correct version. Note in the release notes
   what changed and why.
3. If the bad release is materially harmful (e.g., contains a CVE
   the world thinks is fixed), publish a security advisory referencing
   it.

## Why we don't use `workflow_dispatch` for releases

Tags are the authoritative artifact identifier. Allowing manual
dispatch would let a maintainer re-run the workflow against a
different tag, which dilutes the "the tag IS the release intent"
discipline. If a botched release ever needs re-publishing, fix-up via
a new tag rather than re-running against the bad one.
