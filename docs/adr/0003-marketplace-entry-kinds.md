<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0003: Marketplace entry kinds — plugin and guidebook

- **Status:** Accepted
- **Date:** 2026-05-22
- **Filed from:** [#55](https://github.com/aida-core/aida-marketplace/issues/55)

## Context

Two semantically distinct kinds of catalog entries are emerging in AIDA marketplaces:

- **Plugins** ship *capability* — skills, slash commands, MCP integrations, agents that perform actions. They answer *"what does this do?"* (e.g., a TDD-enforcement plugin runs tests on a PR.)
- **Guidebooks** ship *domain knowledge* — a curated set of agents/experts that progressively walks the assistant through a specific area. They answer *"what does this team know?"* (e.g., a contests-domain guidebook with multiple expert agents and progressive disclosure of conventions.)

Conflating the two muddles discovery and installation expectations. A user looking for "scaffold a new X" wants a guidebook; a user looking for "run TDD on this PR" wants a plugin. Same marketplace, different intent.

The current schema has no formal distinction. Listings rely on informal naming conventions that don't always reflect the underlying kind, and on a `category` field that classifies *within* a kind rather than *between* kinds.

## Considered options

1. **Schema field only** — add `kind: "plugin" | "guidebook"` to each entry; require it; let the repo name be anything.
   - Pros: explicit in the JSON; tools can filter on the field directly.
   - Cons: the field can drift from repo content if the operator forgets to update it; one source of truth that can lie.

2. **Naming convention only** — every listed entry's source repo must end in `-plugin` or `-guidebook`; no schema field.
   - Pros: no schema change; suffix visible everywhere (URLs, install paths, Git history).
   - Cons: less discoverable in the JSON itself; programmatic filters have to parse strings; the suffix is invisible if you're only looking at the manifest.

3. **Dual enforcement: schema field *and* matching suffix** — every entry has both, and the validator (ADR-0001) checks they agree.
   - Pros: explicit *and* visible everywhere; drift is mechanically impossible (one rule per validator run); operator gets immediate feedback if the two disagree.
   - Cons: small redundancy in the manifest; every new entry must populate both.

4. **Don't formalize** — leave as informal convention.
   - Pros: zero cost.
   - Cons: drift continues; new contributors won't know the distinction exists.

## Decision

Adopt **option 3: dual enforcement**.

Every entry in `marketplace.json` carries:

1. A `kind` field on the entry: `"plugin"` or `"guidebook"`.
2. A source repo name ending in the matching suffix: `-plugin` or `-guidebook`.

The validator (ADR-0001) enforces:

- `kind` is present and is one of the allowed values.
- `source.repo` suffix matches `kind` exactly (no `-plugin` repo with `kind: "guidebook"` or vice versa).

Example:

```json
{
  "plugins": [
    {
      "name": "aida-core",
      "kind": "plugin",
      "source": { "repo": "aida-core/aida-core-plugin", "ref": "v1.4.6" }
    },
    {
      "name": "contests",
      "kind": "guidebook",
      "source": { "repo": "myorg/contests-guidebook", "ref": "v0.1.0" }
    }
  ]
}
```

### Why "guidebook"

The original `#55` framing used "playbook," but playbook carries sports/military genre
baggage. "Guidebook" captures the same mental model — *a curated work that progressively
walks you through a domain* — with no domain-specific flavor. A guidebook isn't a single
document; it's a unified work that contains multiple sections/experts inside (travel
guidebook → city guide + food guide + transit guide; contests guidebook → onboarding agent +
rules agent + scoring agent). That matches the actual content shape: a bundle of agents with
progressively disclosed knowledge.

### Why dual enforcement over either alone

- A schema-only rule can be falsified by an operator who updates the field but not the repo (or vice versa).
- A suffix-only rule keeps the distinction out of the JSON, where tooling and humans naturally look.
- With both, each source of truth checks the other. The validator catches any disagreement on the first CI run, before merge.

## Consequences

**Gained:**

- Discovery works either way: filter on `kind`, or grep on the suffix.
- "Field says X, repo says Y" drift is mechanically impossible past the validator.
- Downstream marketplaces inherit the pattern by adopting the same validator (ADR-0001).
- The naming convention is self-documenting in URLs and clone paths.

**Accepted costs:**

- Existing repos may need renaming if their suffix doesn't match the kind they actually are. Audit current listings before the rule becomes blocking; remediate in a one-shot PR.
- Every new entry must populate both fields. Templates and scaffolding should default both correctly.
- The outer key of `marketplace.json` stays as `plugins` (Claude Code's marketplace schema expects this), even though entries can now be `kind: "guidebook"` too. Minor historical-name awkwardness, accepted in exchange for not forking the upstream schema.

## Enforcement

Validator rule `[ADR-0003]` (per ADR-0001):

- Every `plugins[]` entry has a `kind` field.
- `kind` value is one of `"plugin"` or `"guidebook"` (closed set; new kinds require an ADR).
- `source.repo` ends in the matching suffix (`-plugin` for `kind: "plugin"`, `-guidebook` for `kind: "guidebook"`).
- Failure messages cite this ADR by number and link to it.

**One-time audit:** any current listing without a `kind` field or with a non-conforming suffix gets flagged on the next validator run. Remediate via separate PR before the rule becomes blocking on `main`.

**Scaffolding:** the plugin scaffolder (`aida-core-plugin`) should default `kind` and suffix appropriately based on what the user is creating. Tracked as a follow-up under the validator implementation issue.
