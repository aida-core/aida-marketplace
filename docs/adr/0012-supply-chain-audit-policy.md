<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0012: Supply-chain audit policy (`npm audit` in CI)

- **Status:** Accepted
- **Date:** 2026-05-23
- **Filed from:** [#76](https://github.com/aida-core/aida-marketplace/issues/76)

## Context

The marketplace already has multiple CVE-handling surfaces:

- **Renovate** opens version bumps weekly; CVE patches auto-merge for
  trusted-source minor/patch updates (ADR-0002).
- **Dependabot vulnerability alerts** surface GHSA-database advisories
  (notifications-only; not PR-producing).
- **`minimumReleaseAge: "14 days"`** + **`minimumConfidence: "high"`**
  gate routine npm dep updates org-wide.

What's missing is a **blocking PR-time gate**: a direct contributor
could land a PR adding a vulnerable dep before Renovate's next cycle
catches it. Or a transitive dep could carry a newly-published advisory
that none of the *update*-triggered tools see (Renovate fires on dep
changes; advisories on unchanged lockfiles don't trigger it).

`npm audit` against the committed lockfile fills that gap.

## Considered options

1. **No audit** — rely on Renovate + Dependabot alerts as today.
   - Pros: zero added CI surface.
   - Cons: latency window between when an advisory publishes and when
     Renovate catches it; direct contributors can land vulnerable deps
     un-gated.

2. **`npm audit` warn-only annotation** — runs in CI, never fails.
   - Pros: information without friction.
   - Cons: warnings become invisible. Quality gates need teeth.

3. **`npm audit --audit-level=high` blocking** — fails the PR on any
   high or critical advisory against direct or transitive deps.
   - Pros: actual gate; Renovate's CVE PRs naturally clear it; pairs
     well with the existing supply-chain stack.
   - Cons: when a transient false-positive or "accepted-risk" CVE
     surfaces, the operator has to fix or work around it (npm has no
     first-class allowlist).

4. **External scanner** (`socket.dev`, `osv-scanner`) — heavier,
   external service.
   - Pros: richer signal (typosquats, malicious patterns, beyond CVE).
   - Cons: external dependency, more setup, signal/noise tradeoff for
     a small repo.

## Decision

Adopt **option 3: `npm audit --audit-level=high` as a blocking CI job.**

- New `Audit` job in `.github/workflows/ci.yml`. Runs on PR and on
  push to `main`.
- Command: `npm audit --audit-level=high --omit=optional`.
  - `--audit-level=high` blocks on high or critical; ignores
    moderate/low (npm's moderate has notorious false-positive rate for
    devDeps).
  - `--omit=optional` skips optional deps — they're not in the install
    path for CI runs.
  - Production AND devDeps are audited; devDeps run in CI with
    `GITHUB_TOKEN` so a compromised `tsx`/`ajv`/etc. is in scope.
- `Audit` is added to the Simple-profile required-status-checks list
  in [ADR-0010](./0010-branch-protection-baseline.md) and the
  [branch-protection runbook](../runbooks/branch-protection.md).

### Allowlist mechanism — deferred until needed

npm has no first-class audit ignore. When a high+ advisory surfaces:

1. **Preferred path:** bump the offending dep, or pin via
   `package.json` `overrides` to a patched version. Renovate's CVE
   auto-merge usually does this within hours/days of the advisory
   publishing.
2. **If no fix exists:** discuss in the PR. If genuinely
   accepted-risk, the team can either bump `--audit-level=critical`
   temporarily (loses granularity) OR implement a custom allowlist
   tool. The custom tool is deferred — current devDep count (4) and
   solo maintainer state make the YAGNI case strong. File a follow-up
   if/when a real accepted-risk CVE appears.

### Interaction with the rest of the supply-chain stack

| Surface | Trigger | Action | Latency |
| --- | --- | --- | --- |
| Renovate CVE auto-merge | New patch+minor release | Open PR, auto-merge after CI | hours |
| Dependabot alerts | New GHSA advisory | Notification only | minutes |
| **`Audit` job (this ADR)** | Every PR + push | Block merge if high+ CVE | per-PR |

No conflict. A Renovate CVE PR that bumps the vulnerable dep makes
`Audit` go green on the same PR.

## Consequences

**Gained:**

- PR-time blocking gate. A vulnerable dep can't land while the advisory
  is open.
- Pairs naturally with Renovate's CVE PRs — they auto-clear the gate.
- Reference-implementation paper trail: scaffolded marketplaces have
  a documented audit policy to inherit.

**Accepted costs:**

- One additional required CI check (`Audit`) added to ADR-0010's
  baseline.
- A transient or accepted-risk CVE could block PRs until the team
  decides how to handle it (allowlist deferred to follow-up).
- Slight CI run-time addition (~5-10s for `npm audit` on this repo's
  lockfile).

## Enforcement

- New `Audit` job in `.github/workflows/ci.yml`. Job name `Audit` is the
  required-status-check string in branch protection.
- Add `Audit` to [ADR-0010](./0010-branch-protection-baseline.md)
  baseline's required-checks list AND to the runbook's
  `required_status_checks.contexts` array. Apply the updated
  branch-protection payload after merging this ADR's PR.
- No validator rule needed; this is a CI-enforced policy.

**Follow-up:** if/when an accepted-risk transitive CVE surfaces and the
preferred remediation (override) is unavailable, file an issue to add a
formal allowlist mechanism (e.g., `audit-allowlist.json` + a
`scripts/audit-ci.ts` filter). Until then, YAGNI.
