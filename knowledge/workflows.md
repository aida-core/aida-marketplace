---
type: guide
title: Contributor workflows — common recipes
description: Step-by-step recipes for the contributor tasks that recur most often on aida-marketplace. Each recipe names the files touched, the CI gates that will check the work, and links to deeper material.
audience: contributors
---

<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Contributor workflows

Each recipe below is task-shaped, not process-shaped. PR mechanics
(branches, commit format, no-AI-coauthor) live in the org-level
`CONTRIBUTING.md` and `MAINTAINERS.md` — not duplicated here.

## Add a new plugin to the marketplace

1. Pick the `kind` — `plugin` (capability) or `guidebook` (curated set of
   agents with progressive domain knowledge) per [ADR-0003](../docs/adr/0003-marketplace-entry-kinds.md).
2. Verify the upstream repo's name ends with the matching suffix
   (`-plugin` or `-guidebook`). If it doesn't, the upstream needs renaming
   first — the validator will fail the listing.
3. Verify the upstream repo ships `.claude-plugin/aida-config.json` at the
   ref you intend to pin. (ADR-0009; foundation `aida-core/aida-core-plugin`
   is the only exemption.)
4. Pick a `category` from the closed allow-list in
   [ADR-0007](../docs/adr/0007-category-allow-list.md). If none fits, that's
   the "amend the allow-list" recipe below — not a free-form pick.
5. Append a new entry to `plugins[]` in `.claude-plugin/marketplace.json`:

   ```json
   {
     "name": "short-id",
     "kind": "plugin",
     "source": { "source": "github", "repo": "owner/short-id-plugin", "ref": "v1.0.0" },
     "description": "Short, factual sentence.",
     "version": "1.0.0",
     "category": "one-of-the-nine",
     "homepage": "https://github.com/owner/short-id-plugin",
     "author": { "name": "owner" },
     "tags": ["concise", "kebab-case"]
   }
   ```

6. Run `make validate`. The validator will tell you exactly which ADR
   each failing rule traces to.
7. Update `CHANGELOG.md` under `[Unreleased] > Added`.
8. PR. CI runs `TypeScript` (typecheck + tests + validator), `Lint`,
   `Changelog`, `No AI Co-Authors`, `link-check pr-scope`, and `Apply
   labels`.

## Bump a plugin's pinned version (manual path)

Most version bumps happen automatically via Renovate (see `tooling.md`).
When you need to bump manually:

1. From a clean clone: `npm run update`. This calls
   `scripts/update-marketplace.ts` to fetch each plugin's latest release
   tag and rewrite `marketplace.json` deterministically.
2. Review the diff. The script also rewrites the plugin table in
   `README.md` (via marker comments).
3. `make validate` to confirm the rewrites still pass.
4. CHANGELOG entry under `Changed`.

## Rebuild `marketplace.json` after a manual edit

The output format is `JSON.stringify(marketplace, null, 2) + "\n"`. If you
ever hand-edit and accidentally indent differently, run
`scripts/update-marketplace.ts --update` to re-emit deterministically.

If you change a field structure (e.g., adding `kind`), update
`schemas/marketplace.schema.json` in the same PR and re-run
`make validate` to confirm.

## Add a new validator rule

Per the [#42](https://github.com/aida-core/aida-marketplace/issues/42)
governance pattern: rule = ADR + check + tests in **one PR**.

1. Write an ADR under `docs/adr/NNNN-rule-slug.md` following
   `0000-adr-template.md`. Status: Accepted by the time the PR merges.
2. If the rule is structural (a missing/required field, an enum, a
   pattern): update `schemas/marketplace.schema.json` to express it.
3. Add the rule to `scripts/validate-marketplace.ts`:
   - Define `adrNNNN: Rule = { id, title, check(marketplace) { ... } }`
   - Append to the `RULES` array.
   - Use the `[ADR-NNNN]` prefix in every failure message so contributors
     can find the rationale from CI output.
4. Add unit tests in `scripts/validate-marketplace.test.ts`. Cover OK,
   FAIL, and SKIP cases. The existing rules average ~7 tests each — match
   that depth.
5. Update `docs/adr/README.md` to list the new ADR.
6. CHANGELOG entry under `Added`.
7. `make typecheck && make test && make validate` locally before pushing.

## Add a new category to the allow-list

ADR-0007 explicitly governs this. The recipe:

1. Confirm there's a concrete planned listing that doesn't fit any of the
   nine existing categories. ADR-0007 says: don't add anticipatory
   categories.
2. Amend `docs/adr/0007-category-allow-list.md`. Add the row to the
   Decision table (category, meaning, example). Status stays `Accepted`
   — this is an in-place amendment, not a new ADR, unless the change is
   structural.
3. Update `ALLOWED_CATEGORIES` in `scripts/validate-marketplace.ts`.
4. Update the enum in `schemas/marketplace.schema.json` (`properties.category.enum`).
5. Add the planned listing to `marketplace.json` in the same PR (so the
   new category isn't sitting there unused).
6. CHANGELOG entry.

## Add a new ADR (no validator rule)

For decisions that don't manifest as a manifest rule (governance,
process, profile choices, etc.):

1. Copy `docs/adr/0000-adr-template.md` to `docs/adr/NNNN-slug.md`.
2. Fill Status / Date / Filed from / Context / Considered options /
   Decision / Consequences / Enforcement.
3. Update `docs/adr/README.md`.
4. CHANGELOG entry.

## Apply / re-apply branch protection

Don't restate the commands here. See
[`docs/runbooks/branch-protection.md`](../docs/runbooks/branch-protection.md).
The runbook covers Simple-profile (this repo) and Enterprise-profile
snippets, tag protection for `v*`, and the Dependabot alerts toggle.

## Investigate version drift

1. Check the Renovate Dependency Dashboard (auto-issue opened by Renovate).
2. The `check-updates.yml` workflow is the legacy fallback — it opens a
   `chore: update plugin versions` PR weekly. If neither has surfaced
   what you expect, the issue is in the upstream plugin (not tagged?
   not a github release? the regex manager in `aida-core/.github`'s
   `default.json` only matches `source.ref` to `github-releases`).
3. Workflow dispatch manually: `gh workflow run check-updates.yml`.

## Respond to a link-check failure

1. The CI job names the broken link with its file + line.
2. If it's an external link that died: update the link or remove it.
3. If it's a self-reference (e.g., the marketplace `$schema` URL on a
   schema-change PR): verify `lychee.toml`'s exclude list still covers
   the pattern. The schema URL is `^https://raw.githubusercontent.com/aida-core/aida-marketplace/main/schemas/`.
4. If it's a flake (rate limit, transient 5xx): lychee retries 3× — if
   it still fails, push an empty commit or wait. If it's recurring,
   tune `max_retries` / `max_concurrency` in `lychee.toml`.

## Cut a release of the marketplace itself

This is currently undocumented because the marketplace doesn't ship a
versioned artifact — operators consume via `github>aida-core/aida-marketplace`
refs. Tracking as follow-up [#77](https://github.com/aida-core/aida-marketplace/issues/77)
(release workflow + SBOM).
