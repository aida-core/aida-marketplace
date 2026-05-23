<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0005: Author and owner identity

- **Status:** Accepted
- **Date:** 2026-05-22
- **Filed from:** [#59](https://github.com/aida-core/aida-marketplace/issues/59)

## Context

Two places in `marketplace.json` carry identity:

1. **`owner.name`** at the top level — who maintains the marketplace itself.
2. **`plugins[].author.name`** on each listed entry — who authors the listed plugin or guidebook.

Both currently pin to an individual GitHub username (`"oakensoul"`) with an attached email. This creates the same problems in both places:

- **Misleading attribution** — implies single ownership when there are multiple contributors.
- **Orphaning** — if the original person rotates out, the field's identity goes stale.
- **Inconsistent listings** — some entries might pin to individuals, others to org-level names.
- **Email rotation** — pinning an individual email to a public manifest creates PII and rotation concerns.

Individual contribution attribution already lives in Git history, `AUTHORS`, and `MAINTAINERS.md`. The manifest fields should describe identity in a way that maps to something verifiable.

## Considered options

1. **Per-org canonical display names** — maintain a mapping table (e.g., `aida-core` → `"AIDA Core"`) and require the `name` field to match the table.
   - Pros: human-readable display names.
   - Cons: arbitrary mapping table to maintain; no canonical source for the "right" name; doesn't compose with personal-org plugins; new orgs require marketplace updates.

2. **GitHub slug** — every identity field MUST be a valid GitHub slug (an org or user that exists at `github.com/<slug>`).
   - Pros: single source of truth (GitHub itself); no mapping table; mechanically verifiable; one rule for org-owned and personal entries.
   - Cons: displays as a slug (`aida-core`) rather than a polished display name (`AIDA Core`); UI consumers wanting display names resolve via GitHub's API.

3. **Keep individual contributor names** — status quo.
   - Pros: simple.
   - Cons: all the failure modes in Context.

## Decision

Adopt **option 2: GitHub slug** for both `owner.name` and `plugins[].author.name`.

### Rules

- **`owner.name`** (top-level) MUST be a valid GitHub slug. The marketplace operator chooses whether to use a personal user slug (for solo-maintained marketplaces) or an org slug (for org-owned marketplaces).
- **`plugins[].author.name`** MUST be a valid GitHub slug. For org-owned plugins, it SHOULD default to the source repo's org slug (e.g., `"aida-core"` for `aida-core/aida-core-plugin`). Individual contributors MAY use their own user slug.
- **`email` is forbidden** on both `owner` and `plugins[].author`. Repo issues are the contact channel.
- **`url` is forbidden** on `owner` (redundant — `github.com/<slug>` is implied).
- A "valid GitHub slug" means: alphanumeric and hyphens, no leading or trailing hyphen, no consecutive hyphens, max 39 characters — and SHOULD exist at `github.com/<slug>` as an org or user (verify-mode check).

### Concrete change for `aida-marketplace`

`owner` becomes:

```json
{
  "owner": { "name": "oakensoul" }
}
```

(personal handle retained — marketplace-operator choice).

`plugins[0].author` becomes:

```json
{ "name": "aida-core" }
```

(org slug, since the plugin lives under `aida-core/`).

### Why GitHub slug instead of canonical display names

- **Single source of truth:** GitHub itself is authoritative. No mapping table to fork, sync, or relitigate.
- **Symmetry:** orgs and users use the same kind of value; same rule applies everywhere.
- **Mechanically verifiable:** the validator can pattern-check offline, or hit `https://api.github.com/users/<slug>` or `/orgs/<slug>` to confirm existence.
- **Composable:** new orgs and users publish without any marketplace update — their slug just works.

### Why drop email and owner.url

- Email tied to an individual creates a rotation problem the moment that person steps back.
- `owner.url` adds no information beyond `github.com/<owner.name>` and creates drift risk if the slug changes.
- Less PII surface in a public manifest is always better.

## Consequences

**Gained:**

- One uniform rule for every identity field in the manifest.
- No canonical-name mapping table to fork or sync.
- Migration is a small mechanical edit, not a values discussion.
- Operator choice preserved at the marketplace-owner level (personal vs org slug).
- UI consumers needing display names resolve them themselves via the GitHub API — separation of concerns.

**Accepted costs:**

- Identity fields display as slugs, not polished display names. Acceptable trade for the simplicity.
- One-shot migration: update `owner` and the existing plugin's `author` in `marketplace.json`.
- Scope change for [#46](https://github.com/aida-core/aida-marketplace/issues/46): the "canonical author identity mapped per source org" framing is superseded by this ADR. Close #46 with a pointer here.

## Enforcement

Validator rule `[ADR-0005]` (per [ADR-0001](./0001-validator-language.md)):

**Top-level `owner`:**
- `owner.name` is present.
- `owner.name` matches GitHub's slug pattern.
- `owner.email` MUST NOT be present.
- `owner.url` MUST NOT be present.

**Per-entry `plugins[].author`:**
- `author.name` is present.
- `author.name` matches GitHub's slug pattern.
- `author.email` MUST NOT be present.

**Optional verify-mode check** (opt-in, off by default to conserve GitHub API rate limit):

- Hit `https://api.github.com/users/<slug>` or `/orgs/<slug>`; expect 200 for every slug in the manifest.
- When the GitHub App is provisioned (per [ADR-0004](./0004-github-app.md) — Enterprise profile or upstream migration), this check can run on every PR. Until then, leave as an opt-in `make verify-authors` target.

Failure messages cite this ADR.

**Follow-ups:**

- One-shot PR updating `.claude-plugin/marketplace.json` per this ADR (drop email/url from owner; switch author to `"aida-core"`; add `kind: "plugin"` per [ADR-0003](./0003-marketplace-entry-kinds.md)).
- Close [#46](https://github.com/aida-core/aida-marketplace/issues/46) with a pointer to this ADR.
