<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Runbook: apply the branch-protection baseline

Operational reference for applying the baseline defined in
[ADR-0010](../adr/0010-branch-protection-baseline.md). Two profiles —
**Simple** (this repo) and **Enterprise** (downstream private marketplaces) —
each with full security control set.

## Prerequisites

- `gh` CLI installed and authenticated as a user with **admin** access to
  the target repo.
- Contributors have set up signed commits per
  [GitHub's docs](https://docs.github.com/en/authentication/managing-commit-signature-verification)
  **before** applying — `required_signatures: true` will block any unsigned
  commit. If contributors aren't ready, comment out that field in the
  payload until they are.

## Important: PUT semantics are REPLACE, not MERGE

The GitHub branch-protection PUT endpoint
(`/repos/{owner}/{repo}/branches/{branch}/protection`) **replaces** the
entire policy with the supplied payload. A partial payload silently zeroes
out unrelated settings.

> Always send the full JSON every time. Don't try to patch fields
> individually.

The snippets below are complete payloads. Apply by piping into
`gh api -X PUT`.

## Status-check naming

The strings in `required_status_checks.contexts` must match the workflow
**job names** exactly. From the current workflows:

| Job name | Source file |
| --- | --- |
| `TypeScript` | `.github/workflows/ci.yml` (typecheck job) |
| `Lint` | `.github/workflows/ci.yml` (lint job) |
| `Changelog` | `.github/workflows/ci.yml` (changelog job) |
| `No AI Co-Authors` | `.github/workflows/no-ai-coauthor.yml` |
| `PR scope (changed markdown only)` | `.github/workflows/link-check.yml` (pr-scope job) |

Deliberately **not** required: `Apply labels` (the labeler workflow) —
labeling is signal, not safety.

If a workflow job is renamed, update this runbook and the baseline JSON
in the same PR.

## Simple profile (this repo)

Per ADR-0010: 1 approval required, no code-owner-review (sole-maintainer
context), admin bypass allowed (logged in the audit trail), full control
set otherwise.

```bash
gh api -X PUT repos/aida-core/aida-marketplace/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "TypeScript",
      "Lint",
      "No AI Co-Authors",
      "Changelog",
      "PR scope (changed markdown only)"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": false,
    "dismiss_stale_reviews": true,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_signatures": true,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "lock_branch": false
}
JSON
```

Tag protection for `v*` (separate API):

```bash
gh api -X POST repos/aida-core/aida-marketplace/tags/protection \
  -H "Accept: application/vnd.github+json" \
  -f pattern='v*'
```

## Enterprise profile (downstream private marketplaces)

Per ADR-0010: 2 approvals + code-owner-review (assumes ≥2 entries in
CODEOWNERS), last-push approval, no admin bypass, linear history.

Replace `<OWNER>/<REPO>` with your marketplace's owner/repo.

```bash
gh api -X PUT repos/<OWNER>/<REPO>/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "TypeScript",
      "Lint",
      "No AI Co-Authors",
      "Changelog",
      "PR scope (changed markdown only)"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 2,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_signatures": true,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "lock_branch": false,
  "required_linear_history": true
}
JSON
```

Tag protection for `v*`:

```bash
gh api -X POST repos/<OWNER>/<REPO>/tags/protection \
  -H "Accept: application/vnd.github+json" \
  -f pattern='v*'
```

## Verifying current settings

After applying, read back the live state:

```bash
gh api repos/aida-core/aida-marketplace/branches/main/protection \
  -H "Accept: application/vnd.github+json"
```

The returned JSON should match the payload above field-for-field (modulo
GitHub-added fields like `url`).

For tag protection:

```bash
gh api repos/aida-core/aida-marketplace/tags/protection \
  -H "Accept: application/vnd.github+json"
```

## Repository-level controls (out of scope for branch protection)

These complement branch protection but live at the repo level (not on the
branch endpoint). Confirm via the GitHub UI under **Settings → Security**:

- Dependabot alerts: **enabled** (we use Renovate for updates; alerts
  still surface CVEs)
- Secret scanning: **enabled**
- Push protection for secrets: **enabled**

These cannot be cleanly set via the branch-protection runbook; treat them
as a separate one-time setup.

## Rulesets vs classic (forward-looking)

This runbook targets GitHub's classic branch-protection API. GitHub
Rulesets are a newer, layerable alternative. ADR-0010 names classic as
the current canonical path; migration to Rulesets is a future ADR.

## Common operational scenarios

### "I'm a solo maintainer and my PR is stuck on 0/1 approvals"

Use the admin bypass:

```bash
gh pr merge <NUMBER> --admin --squash --delete-branch
```

`enforce_admins: false` on Simple makes this legal. The bypass is
recorded in the GitHub audit log. This is the documented escape hatch —
not a hack.

### "Renovate auto-merge isn't landing on a Simple-profile repo"

Likely cause: `require_code_owner_reviews: true` or
`required_approving_review_count > 0`. Renovate's auto-merge bypasses
code-owner-review but still respects approval-count. If you have 1 approval
required and no humans approve, Renovate's PR sits indefinitely. The
Simple baseline above (1 approval, no code-owner-review) only resolves
this for Renovate PRs if you can configure Renovate to self-approve (out
of scope for this runbook).

### "CI gates pass but I want to merge anyway, bypassing branch protection"

Use the admin bypass above. If you find yourself doing this routinely,
the policy is misaligned with your workflow — open an ADR-amendment PR.

### "I want to re-enable `require_code_owner_reviews` because we now
have 2 code owners"

Update `.github/CODEOWNERS` first. Then flip the field in the Simple
payload above and re-run. Document the change in CHANGELOG and reference
this runbook.
