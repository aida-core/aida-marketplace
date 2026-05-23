<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Maintainers

This file describes the role model for `aida-core/aida-marketplace`.
GitHub's [CODEOWNERS](.github/CODEOWNERS) file enforces "required
reviewer per path" but has no syntax for distinguishing roles — the
sections below document the conceptual roles, while CODEOWNERS lists
the people who must review.

## Roles

### Owner

- **Authority:** final say on direction, governance, releases. Listed in
  CODEOWNERS for every path.
- **GitHub access:** admin.
- **What they can do:** bypass branch protection, modify CI/CD, force-push
  (when temporarily allowed), configure repo settings, cut releases.
- **Branch protection contract:** see [ADR-0010](docs/adr/0010-branch-protection-baseline.md)
  for the baseline and [docs/runbooks/branch-protection.md](docs/runbooks/branch-protection.md)
  for the `gh api` commands to apply / re-apply the policy. Owner admin
  bypass is the documented escape hatch under the Simple profile while
  CODEOWNERS has a single entry — recorded in the GitHub audit log.

### Committer

- **Authority:** trusted contributor with merge rights. Triages issues,
  reviews PRs, lands accepted changes.
- **GitHub access:** maintain or write.
- **What they can do:** push to feature branches, merge approved PRs,
  label and triage issues. Cannot bypass branch protection.

### Collaborator

- **Authority:** anyone who opens PRs or files issues.
- **GitHub access:** read (or write for trusted contributors).
- **What they can do:** open PRs and issues. Not required as a reviewer.

## Current people

| GitHub user                                | Role  | Areas |
| ------------------------------------------ | ----- | ----- |
| [@oakensoul](https://github.com/oakensoul) | Owner | All   |

(No committers or designated collaborators yet — anyone is welcome to
open PRs.)

## How to add a committer

1. Add as a repo collaborator with `Write` access.
2. Add a row to "Current people" above.
3. (Optional) Add to `.github/CODEOWNERS` for paths they will co-own.
