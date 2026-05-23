<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0007: Closed allow-list for plugin categories

- **Status:** Accepted
- **Date:** 2026-05-23
- **Filed from:** [#45](https://github.com/aida-core/aida-marketplace/issues/45)

## Context

Each entry in `marketplace.json` carries a `category` field. Today the field
is unconstrained — any string is accepted. Without an allow-list, two failure
modes accumulate as the catalog grows:

1. **Vocabulary sprawl.** Contributors invent ad-hoc categories that
   nearly-but-not-quite match existing ones — `dev-workflow`, `workflows`,
   `developer-workflow`, `dev_workflow`. Discovery suffers because filtering
   misses entries that should match.
2. **Drift between operators.** Upstream and downstream marketplaces end up
   with divergent vocabularies for the same kinds of plugins. Sharing
   plugins across catalogs requires reading minds.

A closed allow-list, enforced by the validator and amended via ADR, solves
both. New categories become deliberate additions, not accidents.

## Considered options

1. **Closed set, opinionated** — enumerate the categories upstream considers
   canonical; the validator rejects anything else.
   - Pros: prevents sprawl; forces conscious decisions; sets a vocabulary
     downstream marketplaces can adopt.
   - Cons: extending the set requires an ADR + validator change.

2. **Free-form** — keep current behavior; any string is acceptable.
   - Pros: zero friction.
   - Cons: all the sprawl and drift failure modes above; catalog vocabulary
     degrades over time without a forcing function.

3. **Hierarchical** — categories are `top/sub` (e.g.,
   `infrastructure/iac`, `infrastructure/observability`).
   - Pros: rich taxonomy; finer discovery.
   - Cons: overkill for a catalog this size; sub-categories proliferate even
     faster than flat ones; tooling has to parse the path.

## Decision

Adopt **option 1: closed allow-list**.

### Initial set (9 categories)

| Category         | Meaning                                                                       | Example                                    |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| `core`           | Foundational, framework-level plugins                                         | aida-core                                  |
| `workflow`       | Opinionated workflows for specific development practices                      | TDD enforcement, code-review automation    |
| `infrastructure` | IaC, deployment, provisioning, ops tooling                                    | terraform, pulumi                          |
| `language`       | Tooling specific to a programming language                                    | Go linter, Python formatter, TS bundler    |
| `integration`    | Adapters to third-party services                                              | Slack, Notion, Linear, GitHub Actions      |
| `domain`         | Knowledge or capability specific to a problem area                            | contests-guidebook, finance-knowledge      |
| `productivity`   | Personal effectiveness tooling                                                | note-taking, task tracking, knowledge mgmt |
| `security`       | Authentication, authorization, vulnerability scanning, compliance             | OAuth helpers, dependency audits           |
| `observability`  | Logging, metrics, tracing, monitoring                                         | Datadog adapter, OpenTelemetry helpers     |

### Boundary clarifications

A few category pairs sound close enough to need explicit boundaries:

- **`workflow` vs `productivity`** — workflow describes *team/development*
  practices (TDD, code review, release process). Productivity describes
  *personal* effectiveness tooling (note-taking, task tracking, focus tools).
- **`security` vs `domain`** — security is its own discipline with
  recognizable conventions and gets its own top-level category, even though
  it is technically a domain. Treat `domain` as the catch-all for
  application or organization-specific knowledge that doesn't fit elsewhere.
- **`observability` vs `infrastructure`** — observability is
  logging/metrics/tracing/monitoring as a discipline. Infrastructure is the
  provisioning and deployment layer underneath. A plugin that ships an OTel
  collector config is `observability`; a plugin that provisions monitoring
  pipelines via IaC is `infrastructure`.
- **`language` vs `workflow`** — language is tooling tied to a specific
  programming language regardless of practice. Workflow is the practice
  applied across languages.
- **`integration` vs `domain`** — integration is an adapter to an external
  service (the Slack integration). Domain is knowledge about a problem space
  (a `support-tickets-guidebook` that uses several integrations).

### Process for adding a new category

Per [#42](https://github.com/aida-core/aida-marketplace/issues/42)'s
"rule = ADR + check in same PR" policy:

1. Open a PR that amends this ADR's Decision section to add the new category
   (or writes a superseding ADR if the change is structural).
2. Update `ALLOWED_CATEGORIES` in `scripts/validate-marketplace.ts` in the
   same PR.
3. If a current listing is the first to use the new category, update its
   `category` field in the same PR.

**Bar for adding a category:** at least one concrete planned listing that
doesn't fit an existing category. Don't add anticipatory categories — wait
for real demand. If a category goes unused for an extended period, propose
removing it.

## Consequences

**Gained:**

- Catalog vocabulary is stable and discoverable.
- Downstream marketplaces have a documented vocabulary to inherit or
  consciously diverge from.
- The validator catches typos and ad-hoc inventions at PR time.
- New categories are deliberate decisions with rationale recorded in the
  amending PR.

**Accepted costs:**

- Listing a plugin in a category that doesn't yet exist requires an ADR
  amendment first. Small friction, deliberate.
- The current allow-list reflects upstream's anticipated taxonomy.
  Downstream marketplaces with different audiences (e.g., a finance-focused
  marketplace might want `compliance` as its own top-level category) can
  fork the ADR or override locally in their own validator.
- A category goes unused if anticipatory choices don't pan out. The
  remediation (remove the category, possibly re-categorize listings) is
  cheap.

## Enforcement

Validator rule `[ADR-0007]` (per [ADR-0001](./0001-validator-language.md)):

- Every `plugins[]` entry has a `category` field that is a non-empty string.
- `category` value is in the allow-list defined above.
- Failure messages name this ADR and list the allowed categories.

The allow-list is duplicated between this ADR (canonical, with rationale)
and `scripts/validate-marketplace.ts` (enforcement). Amendments must update
both in the same PR; the validator drift between the two is itself a
review-time check.
