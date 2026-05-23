---
type: reference
title: Troubleshooting — common CI failures and contributor traps
description: Concrete fixes for the failure modes contributors hit most often. Use as a runbook when CI is red and the error isn't obvious.
---

<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Troubleshooting

Common failures and what to do about each. If a failure isn't listed
here, file an issue noting which CI gate emitted it — that's how this
file grows.

## REUSE / SPDX lint failed

**Symptom:** `make lint-reuse` (or CI `Lint` job) fails with
`MISSING COPYRIGHT AND LICENSING INFORMATION`.

**Why:** Every hand-authored source file must carry SPDX headers.
JSON files (which can't have inline comments) are covered by
`REUSE.toml` aggregate annotations. Other files need inline headers.

**Fix:**

- **Markdown:** add at the top, after frontmatter if any:

  ```markdown
  <!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
  <!-- SPDX-License-Identifier: MPL-2.0 -->
  ```

- **TS / JS / Python:** `// SPDX-...` or `# SPDX-...` near the top of
  the file (after any shebang).
- **YAML / TOML:** `# SPDX-...` near the top.
- **Bulk fix:** `scripts/add_spdx_headers.py` runs idempotently.

If the missing file is something REUSE can't carry inline (lockfiles,
fixtures), add an annotation to `REUSE.toml`.

## Frontmatter validation failed

**Symptom:** `make validate-frontmatter` or the `Lint` CI job emits a
`FAIL <path>: <field>: <message>` line.

**Why:** A markdown file's YAML frontmatter doesn't match the AIDA
frontmatter schema (fetched from upstream `aida-core/aida-core-plugin`).

**Fix:**

- Required fields by `type`:
  - `documentation`, `guide`, `reference` — `title` (description recommended)
  - `adr` — `title`, `status` (proposed/accepted/deprecated/superseded), `date`
  - `skill`, `agent` — `name`, `description`, `version`, `tags`
- Reference the upstream schema if the message is unclear: [.frontmatter-schema.json](https://github.com/aida-core/aida-core-plugin/blob/main/.frontmatter-schema.json).
- Offline / sibling-clone dev: set `AIDA_FRONTMATTER_SCHEMA=/path/to/.frontmatter-schema.json`.
- For files that legitimately have no frontmatter, that's OK — the
  validator skips them. Don't add empty frontmatter to silence it.

## `link-check` PR job failed

**Symptom:** CI `PR scope (changed markdown only)` job fails with a list
of broken links.

**Why:** lychee found a URL or anchor it couldn't resolve.

**Fix:**

- If the link is genuinely dead: update or remove it.
- If the failure is a github.com anchor (`#L42`, `#some-header`):
  lychee can't reliably validate client-side rendered anchors.
  Check `lychee.toml` — the github.com fragment exclude
  (`^https://github\.com/.*#`) should already cover it. If a new
  pattern is needed, add it there.
- If it's the marketplace's own `$schema` URL on a schema-change PR:
  the self-reference doesn't resolve until merge. Verify the exclude
  pattern `^https://raw.githubusercontent.com/aida-core/aida-marketplace/main/schemas/`
  is still in place.
- If it's a transient network error: lychee retries 3× before
  failing. Push an empty commit to re-run; if recurring, tune
  `lychee.toml`'s `max_retries`/`max_concurrency`.

## Validator rule failed (`[ADR-NNNN] ✗ …`)

**Symptom:** `make validate` or the CI `TypeScript` job emits
`[ADR-NNNN] ✗ <context>: <message>`.

**Why:** The marketplace manifest violates an enforced rule. The ADR
number in the message names the rationale.

**Fix:**

- Read the ADR (`docs/adr/NNNN-*.md`). The Decision section explains
  what's expected; the Enforcement section explains exactly what the
  validator checks.
- Common rules to check first:
  - **ADR-0003** kind / suffix mismatch: rename the repo or change
    the `kind` field
  - **ADR-0005** GitHub slug: `email` is forbidden, `owner.url` is
    forbidden, `name` must match `^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$`
  - **ADR-0006** ref not semver: must match `^v?\d+\.\d+\.\d+$` — no
    pre-release, no build metadata
  - **ADR-0007** category not in allow-list: pick from the nine, or
    follow `workflows.md` to amend the list
  - **ADR-0009** missing `aida-config.json`: upstream repo needs the
    file at the pinned ref (the foundation `aida-core/aida-core-plugin`
    is exempt)

## Schema validation failed (`[schema] ✗ …`)

**Symptom:** The validator emits a `[schema] ✗ /path/to/field: ...`
line BEFORE any ADR rules run.

**Why:** The manifest fails structural validation against
`schemas/marketplace.schema.json` (ajv). Semantic rules can't run on
broken structure.

**Fix:**

- The error path (`/plugins/0/category`, etc.) points at the failing
  field. Cross-reference the schema to see what shape is expected.
- Most common: missing required field (`name`, `kind`, `source`,
  `author`), wrong enum value, type mismatch, additional unexpected
  property.

## Signed-commit check failed

**Symptom:** Branch protection rejects the PR with "requires signed
commits."

**Why:** ADR-0010 enforces signed commits on `main`. Your commits
aren't GPG/SSH-signed.

**Fix:**

- Configure commit signing per GitHub's
  [docs](https://docs.github.com/en/authentication/managing-commit-signature-verification).
- For SSH signing: `git config --global gpg.format ssh` +
  `git config --global user.signingkey ~/.ssh/your_key.pub` +
  `git config --global commit.gpgsign true`.
- Re-sign existing commits: `git rebase --exec 'git commit --amend
  --no-edit -S' origin/main`.

## `make lint-md` errors locally but I don't have `markdownlint-cli2`

**Symptom:** `make lint-md` says
`markdownlint-cli2: No such file or directory`.

**Why:** Not installed. CI installs it as part of the `Lint` job.

**Fix:** `npm install -g markdownlint-cli2` (one-time global install),
or rely on CI.

## `no-ai-coauthor` check failed

**Symptom:** The `No AI Co-Authors` workflow rejects the PR.

**Why:** A commit in the PR has a `Co-Authored-By:` trailer pointing
at an AI tool (Claude, Copilot, ChatGPT, Cursor, etc.) or an
`@anthropic.com`/`@openai.com` noreply address.

**Fix:**

- `git log --format='%B' origin/main..HEAD` to find the offending
  commit.
- Rebase and rewrite: `git rebase -i origin/main`, edit the bad commit
  to drop the trailer.
- Force-push the cleaned branch.
- There's no `skip-` label — the policy is firm.

## Renovate didn't open a PR I expected

**Symptom:** A plugin shipped a new release; no Renovate PR appeared.

**Why:** Most likely the `minimumReleaseAge` gate (14 days globally,
0 days for `aida-core/*`). Or the release isn't a github-release (only
git tags don't trigger the regex manager).

**Fix:**

- Check the Renovate Dependency Dashboard issue for the repo.
- Confirm the upstream release was a github-release (not just a tag).
- For non-`aida-core/*` plugins, wait the 14-day age gate.
- For verification: `gh workflow run check-updates.yml` (the legacy
  fallback) will also open a PR if drift exists.
