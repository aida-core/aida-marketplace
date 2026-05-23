<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0004: GitHub App for cross-repo operations

- **Status:** Accepted
- **Date:** 2026-05-22
- **Filed from:** [#58](https://github.com/aida-core/aida-marketplace/issues/58)

## Context

A GitHub App provides scoped, rotated credentials for workflows that need to:

1. Read release tags from **private** plugin repositories.
2. Open auto-PRs or issues into **other** repositories (cross-repo writes — e.g., propagating security advisories to plugin repos).
3. Operate above the default `GITHUB_TOKEN` rate limit (5k req/hr for authenticated App tokens vs. 1k req/hr per workflow run for `GITHUB_TOKEN`).

The default `GITHUB_TOKEN` handles the public-OSS case fine. Apps become essential when private-repo reads, cross-repo writes, or sustained high-volume calls enter the picture.

Under [ADR-0002](./0002-marketplace-profiles.md) (operator profiles), this decision is profile-conditional rather than universal.

## Considered options

1. **Provision an App on the upstream org now** — set up an App for `aida-core`, switch existing workflows to use it.
   - Pros: ready when needed; a live reference for downstream operators.
   - Cons: secret rotation overhead, upfront ops work, unused capability today.

2. **No App for Simple profile; required for Enterprise profile** — Simple operators stay App-less via Mend-hosted Renovate; Enterprise operators provision and manage their own App.
   - Pros: matches the actual need surface; aida-marketplace stays low-ops; clean alignment with ADR-0002.
   - Cons: when upstream eventually crosses an Enterprise trigger, App setup happens under whatever timeline that trigger sets.

3. **Defer entirely, document nothing** — treat App provisioning as out-of-scope for upstream guidance.
   - Pros: simplest.
   - Cons: Enterprise operators recreate the same setup from scratch each time, without a reference pattern.

## Decision

Adopt **option 2**: profile-conditional.

- **Simple profile** (including `aida-marketplace` today): no GitHub App. Mend-hosted Renovate handles auth. Workflows use the default `GITHUB_TOKEN`. This is sufficient for all-public listings.
- **Enterprise profile**: a GitHub App is required. At minimum it needs `Contents: Read` on
  the plugin repos being tracked, plus `Pull requests: Write` and `Issues: Write` on the
  marketplace repo itself. Reference docs and example workflow snippets live in
  [`docs/profiles/enterprise-github-app.md`](../profiles/enterprise-github-app.md) (to be
  written under the implementation issue).

### Triggers to migrate `aida-marketplace` from Simple → Enterprise

If any of these become true, revisit this ADR and provision an App:

1. A private plugin is listed (App needed to read release tags from a private repo).
2. A workflow needs to write into a plugin repo outside this repo's scope (e.g., automated security advisories).
3. `GITHUB_TOKEN` rate limits start affecting routine runs.

None of these are true today. Track the triggers; don't pre-provision.

## Consequences

**Gained:**

- `aida-marketplace` avoids App secret management until a concrete trigger fires.
- Enterprise operators get a documented reference pattern, including install steps and the `actions/create-github-app-token@v3` workflow snippet.
- Clear trigger conditions prevent provisioning capability before there's a use for it.

**Accepted costs:**

- When a trigger fires upstream, App provisioning is a one-time cost paid under that timeline.
- The Enterprise App reference doc must stay current even though upstream doesn't exercise it.

## Enforcement

- **Simple profile**: no rule. Default `GITHUB_TOKEN` is the assumed auth. If a workflow ever needs broader scope, that's the migration signal.
- **Enterprise profile**: documented requirement, not validator-enforced. Operators self-attest in their README per ADR-0002.
- **Reference doc**: [`docs/profiles/enterprise-github-app.md`](../profiles/enterprise-github-app.md) — covers App install, permissions, secret rotation, and the example workflow snippet using `actions/create-github-app-token@v3`. Maintained alongside this ADR.
