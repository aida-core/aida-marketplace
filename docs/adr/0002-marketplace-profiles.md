<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0002: Marketplace operator profiles

- **Status:** Accepted
- **Date:** 2026-05-22
- **Filed from:** [#56](https://github.com/aida-core/aida-marketplace/issues/56)

## Context

AIDA marketplaces vary widely in scope and constraints:

- Some are public, all-OSS, with trusted plugin sources (the upstream `aida-marketplace` is one).
- Others are private or internal, listing private plugins, with stricter review or compliance requirements.
- Some are happy to run on hosted services; others have policy requirements to own the entire auth chain.

A single recommended setup can't cover both ends well. Pushing complexity onto a
hobby/community operator is wasteful; pushing under-engineered defaults onto a regulated
operator is unsafe. Different ADRs (update mechanism, GitHub App, secret management) all
bottom out at the same dimension: what kind of marketplace is this?

This ADR defines two named operator profiles. Future ADRs and reference configs slot into one or the other.

## Considered options

1. **One-size-fits-all pattern** — recommend a single canonical setup (e.g., auto-PR + manual merge + own GitHub App for everyone).
   - Pros: one path to learn, one set of reference configs.
   - Cons: over-engineered for OSS-only operators, under-equipped for private/internal operators.

2. **Two named profiles: Simple and Enterprise** — both documented with reference configs; operators pick which fits their constraints.
   - Pros: covers the realistic spectrum; each downstream ADR can target one profile cleanly.
   - Cons: two reference patterns to maintain; risk of profile drift if operators don't re-declare when their needs change.

3. **Profile-free, freeform** — document the dimensions (hosting, auth, review depth, auto-merge policy) and let each operator pick à la carte.
   - Pros: maximum flexibility.
   - Cons: paradox of choice for new operators; combinations diverge wildly, defeating the purpose of upstream guidance.

## Decision

Adopt **option 2**: two named profiles.

### Simple profile

- **Use case:** public marketplace, all-public listings from trusted sources, hobby/community pace.
- **Update tooling:** Mend-hosted Renovate App (free for public and private repos).
- **Auth:** App-less — Mend handles GitHub auth.
- **Auto-merge:** `true` for trusted-source minor/patch updates. Major versions and external sources require dashboard approval.
- **Safety gate:** strong CI — validator (ADR-0001) + tests + branch protection on `main` with required checks.
- **Reference config:** [`docs/profiles/renovate-simple.json`](../profiles/renovate-simple.json).

### Enterprise profile

- **Use case:** private or internal marketplace, mixed public + private listings, internal review or compliance requirements.
- **Update tooling:** self-hosted Renovate (typically in GitHub Actions) or Mend with App-authed access for private-repo reads.
- **Auth:** own GitHub App (per ADR-0004) for private-repo reads and any cross-repo writes.
- **Auto-merge:** conservative by default (`false`). Trusted-source minor/patch can be enabled once Renovate operations have been validated against the operator's CI and review policies.
- **Safety gate:** CI + dashboard approval for external sources and major bumps + audit-logged merges.
- **Reference config:** [`docs/profiles/renovate-enterprise.json`](../profiles/renovate-enterprise.json).

**`aida-marketplace` adopts the Simple profile.**

## Consequences

**Gained:**

- Operators get a clear "pick a profile" entry point and a reference config they can copy.
- ADR-0004 (GitHub App) becomes a profile-conditional decision instead of a global one.
- Issue [#30](https://github.com/aida-core/aida-marketplace/issues/30) (Adopt Renovate) becomes concretely "adopt Renovate for the Simple profile on this repo."
- Downstream private marketplaces have a named, reusable pattern to mirror.

**Accepted costs:**

- Two reference configs to keep current.
- Profile drift risk: an operator on Simple might start adopting Enterprise-style gates without explicitly migrating profiles. Mitigation: keep the configs in `docs/profiles/` minimal and version them; ask operators to declare their profile in their README.

## Enforcement

- This ADR is documentation-driven, not validator-enforced. Profile choice belongs to the operator.
- The reference configs in [`docs/profiles/`](../profiles/) are the canonical examples; downstream operators copy and adapt.
- Marketplace operators are asked to declare their profile in their README (suggested wording: *"This marketplace operates the **Simple** profile per ADR-0002."*).
- Per-ADR enforcement (ADR-0001 validator, ADR-0003 suffix check, ADR-0005 author identity, etc.) applies to all profiles unless the ADR explicitly scopes itself to one.
