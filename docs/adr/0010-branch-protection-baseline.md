<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0010: Branch protection baseline

- **Status:** Accepted
- **Date:** 2026-05-23
- **Filed from:** [#49](https://github.com/aida-core/aida-marketplace/issues/49)

## Context

Marketplaces are high-blast-radius repositories. A bad merge to `main`
propagates to every operator who runs `/plugin install` against the
marketplace — there is no staging layer between this repo's `main` and a
plugin landing on someone's machine. The CI gates we've built (typecheck,
linters, validator, JSON schema check, frontmatter check, link check) are
the *machine* enforcement. Branch protection is the *policy* enforcement
that says: "no PR merges unless those gates have actually run and passed."

Until now this repo's branch protection has been configured ad-hoc.
[#49](https://github.com/aida-core/aida-marketplace/issues/49) asks us to
document the baseline so it's:

- visible to contributors (the contract is explicit),
- reproducible (a scaffolded downstream marketplace can apply it from a
  runbook), and
- auditable (drift is observable against a written reference).

[ADR-0002](./0002-marketplace-profiles.md) established Simple vs Enterprise
operator profiles. Branch protection is exactly the kind of policy that
should differ between them: a public, solo-maintained marketplace has very
different "blast radius vs friction" tradeoffs than a private internal
marketplace with a dedicated review team.

## Considered options

1. **No documented baseline — operator's choice.**
   - Pros: zero work; full flexibility.
   - Cons: every new marketplace re-invents the wheel; drift across
     downstream marketplaces; no auditability.

2. **One global baseline applied uniformly.**
   - Pros: uniform contract everywhere.
   - Cons: over-engineered for solo Simple operators (every routine merge
     needs admin override); under-engineered for Enterprise (no signed
     commits, no strict checks, no audit-logged admin bypass).

3. **Profile-conditional baselines mirroring ADR-0002.**
   - Pros: matches the operator-profile model the rest of our governance
     uses; downstream marketplaces inherit by declaring their profile.
   - Cons: two baselines to maintain.

## Decision

Adopt **option 3**. Two baselines, both applying the full GitHub branch
protection security control set, with profile-specific differences in
review depth and admin bypass.

### Common controls (both profiles)

These apply to `main` regardless of profile:

| Control | Setting | Why |
| --- | --- | --- |
| `dismiss_stale_reviews_on_push` | `true` | A new push invalidates prior approval. |
| `required_signatures` | `true` | Pairs with the no-AI-coauthor CI gate ([ADR-0005](./0005-author-and-owner-identity.md) identity context). Forces verifiable commit authorship. |
| `required_conversation_resolution` | `true` | All PR review threads must be resolved before merge. |
| `allow_force_pushes` | `false` | History is append-only on `main`. |
| `allow_deletions` | `false` | `main` cannot be deleted. |
| `required_status_checks.strict` | `true` | Branches must be up-to-date with `main` before merge. |
| Tag protection on `v*` | enabled | Release tags are the marketplace's pinning surface (per [ADR-0006](./0006-semver-tag-refs.md)). Rewriting/deleting them breaks consumers. |

Required status check contexts (workflow job names that GitHub gates on):

- `TypeScript` (typecheck + tests + validator + version check)
- `Lint` (yaml + md + json + REUSE + frontmatter + CODEOWNERS)
- `Audit` (`npm audit --audit-level=high`; per [ADR-0012](./0012-supply-chain-audit-policy.md))
- `No AI Co-Authors`
- `Changelog`
- `PR scope (changed markdown only)` (link-check on PRs)

Deliberately **NOT** required: `Apply labels` (the labeler workflow). A
labeler failure shouldn't block merges — labels are signal, not safety.

### Simple profile (this repo's baseline)

| Control | Setting | Why |
| --- | --- | --- |
| `required_approving_review_count` | `1` | Minimum threshold for external contributions. |
| `require_code_owner_reviews` | `false` | See "Sole-code-owner tension" below. |
| `require_last_push_approval` | `false` | A maintainer's approval persists across their own fixup commits (combined with `dismiss_stale` for substantive changes). |
| `enforce_admins` (UI: "Include administrators") | `false` | Admin bypass available for solo-maintainer edge cases. Bypass is recorded in the audit log. |

### Enterprise profile

| Control | Setting | Why |
| --- | --- | --- |
| `required_approving_review_count` | `2` | Two-eyes principle for any merge. |
| `require_code_owner_reviews` | `true` | CODEOWNERS roster expected to have ≥2 entries; assigns review authority by path. |
| `require_last_push_approval` | `true` | Stricter than Simple: any subsequent push requires re-approval. |
| `enforce_admins` | `true` | No admin bypass. Even admins go through the review gate. |
| Linear history | `true` | Recommended; keeps git history clean for audit. |

### Sole-code-owner tension (Simple profile)

This repo currently has one CODEOWNERS entry (`@oakensoul`). Setting
`require_code_owner_reviews: true` on a single-code-owner repo creates a
self-approval deadlock — GitHub disallows PR authors from approving their
own PRs, so every PR by the owner requires admin bypass. Renovate's
auto-merge for trusted-source minor/patch updates ([ADR-0002](./0002-marketplace-profiles.md))
breaks for the same reason.

Disabling `require_code_owner_reviews` on Simple resolves both problems
without meaningfully reducing safety:

1. The 1-required-approval requirement still blocks external contributors
   from self-merging.
2. The required status checks (validator, no-AI-coauthor, linters) are
   non-bypassable from a reviewer perspective — they fail or they pass.
3. `enforce_admins: false` provides a documented escape hatch logged in
   the GitHub audit trail.

**Named trigger to re-enable:** when this repo's `.github/CODEOWNERS`
has two or more entries (or any entry beyond the global `@oakensoul`
wildcard), a follow-up PR MUST flip `require_code_owner_reviews` to
`true`. This is the only deferred decision in ADR-0010.

### Rulesets vs classic branch protection

GitHub now offers two mechanisms for branch policy enforcement:

- **Classic branch protection** (what this ADR documents) — single
  per-branch policy applied via `/repos/{owner}/{repo}/branches/{branch}/protection`.
- **Repository Rulesets** — newer, layerable, with finer control. Multiple
  rulesets can stack.

For v1 of the reference marketplace, classic branch protection is
sufficient and is the better-documented path for scaffolded downstreams.
Migrating to Rulesets is a future ADR if the layering becomes useful.

## Consequences

**Gained:**

- Contract is visible to contributors and auditable against the runbook.
- Downstream marketplaces inherit a copyable baseline by declaring their
  profile in their README.
- The required-status-check list is now an explicit dependency of the
  workflow names — renaming a job is a breaking change that the runbook
  surfaces.
- Renovate's auto-merge (per [ADR-0002](./0002-marketplace-profiles.md)
  Simple profile) works without per-PR admin override.

**Accepted costs:**

- Two baselines to maintain. Each must be kept in sync with the actual
  workflow job names in `.github/workflows/`.
- Branch protection is *not* mechanically validated by our validator
  ([ADR-0001](./0001-validator-language.md)) — it's GitHub-enforced. Drift
  detection is manual (re-run the runbook periodically).
- `required_signatures: true` requires contributors to sign commits with
  GPG or SSH. This is a real friction increase from today. Until contributors
  have signing configured, applying this control will block their PRs.
  Apply only after operators have set up signing per GitHub's docs.

## Enforcement

This ADR is **documentation-driven**. GitHub enforces branch protection
directly; there is no validator rule because there is no manifest to
validate.

- Runbook: [`docs/runbooks/branch-protection.md`](../runbooks/branch-protection.md)
  — literal `gh api` commands per profile. Operators apply the baseline by
  running the commands.
- The runbook notes that the GitHub branch-protection PUT endpoint is
  REPLACE semantics (not merge) — the full JSON payload is required each
  time. Partial payloads silently zero out unrelated settings.
- Drift detection: there is no automated drift check today. Filed as a
  follow-up under [#49](https://github.com/aida-core/aida-marketplace/issues/49)
  — a future scheduled workflow could compare live protection against the
  baseline JSON and open an issue on drift.
- CODEOWNERS validation: a malformed `.github/CODEOWNERS` silently
  disables code-owner-review enforcement. Verify with `gh api
  repos/{owner}/{repo}/codeowners/errors` periodically. Filed as a
  follow-up.

When the workflow set changes (new required check, renamed job), update
the required-status-checks list in both the runbook and the Simple/Enterprise
baselines in this ADR's tables. The PR doing the rename MUST update both.
