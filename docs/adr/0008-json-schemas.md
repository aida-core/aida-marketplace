<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0008: JSON Schema as the canonical structural definition

- **Status:** Accepted
- **Date:** 2026-05-23
- **Filed from:** [#50](https://github.com/aida-core/aida-marketplace/issues/50)

## Context

ADRs [0003](./0003-marketplace-entry-kinds.md), [0005](./0005-author-and-owner-identity.md),
[0006](./0006-semver-tag-refs.md), and [0007](./0007-category-allow-list.md) establish
the manifest's structural and value-level rules. Their enforcement lives in the
TypeScript validator. That's the operational gate in CI.

What the validator does *not* give us:

- **IDE support.** Contributors editing `.claude-plugin/marketplace.json` don't get
  autocomplete or inline structural errors until they push and CI runs.
- **Cross-tool reuse.** Other languages (Python, Go, Ruby) and other tools
  (linters, dashboards, downstream marketplaces) can't validate the manifest
  without running our TS code.
- **A machine-readable spec.** The valid shape is implicit in the TS types
  and the rule list. There's no single document a contributor can read to
  understand what's expected.

JSON Schema is the obvious answer to all three.

The companion frontmatter schema for AIDA markdown files already exists at
[`aida-core/aida-core-plugin/.frontmatter-schema.json`](https://github.com/aida-core/aida-core-plugin/blob/main/.frontmatter-schema.json)
and is mature. We reference that schema rather than fork it, to avoid drift.

## Considered options

1. **Hand-maintained schema + validator** — keep the validator (semantic rules)
   and add a schema file that mirrors structural constraints. Both run in CI;
   each PR that changes one must update the other.
   - Pros: low friction; clear separation (schema for structure, validator
     for cross-field semantics); IDE picks up the schema automatically.
   - Cons: drift risk between schema and validator; reviewers must remember
     to update both.

2. **Generate the schema from validator code** — single source of truth
   in the validator; schema is a build artifact.
   - Pros: no drift possible.
   - Cons: schema generation tooling adds dependency; cross-field rules
     (e.g., ADR-0003's kind <-> suffix match) don't fit JSON Schema cleanly,
     so the generated schema would only partially express the rules anyway.

3. **Generate the validator from the schema** — single source of truth in
   the schema; validator dispatches based on schema + adds cross-field
   semantic rules on top.
   - Pros: schema-first; ajv already supports runtime validation.
   - Cons: rewrite of existing validator; cross-field rules still live
     outside the schema; bigger move than the value justifies.

4. **Schema alone, no separate validator** — drop the per-rule TypeScript
   validator in favor of pure JSON Schema validation.
   - Pros: simplest.
   - Cons: cross-field rules (kind <-> suffix matching, SKIP semantics for
     non-github sources) can't be expressed in JSON Schema; semantic
     failure messages with ADR refs disappear.

## Decision

Adopt **option 1: hand-maintained schema + validator**, with the schema
covering single-field structural constraints and the validator covering
cross-field semantics and ADR-traceable failure messages.

### Layering

- `schemas/marketplace.schema.json` is the **structural** definition.
  It expresses: required fields, types, enums, patterns, forbidden additional
  properties. IDE tools pick it up via the manifest's `$schema` pointer.
- `scripts/validate-marketplace.ts` is the **semantic** layer.
  It runs schema validation first; if structurally invalid, it reports the
  schema errors and exits. If structurally valid, it runs the semantic rules
  (ADR-0003 cross-field, ADR-0005 forbidden-property and slug, ADR-0006
  semver + SKIP semantics, ADR-0007 closed allow-list).
- Both must be updated in the same PR when rules change, per
  [#42](https://github.com/aida-core/aida-marketplace/issues/42)'s
  "rule = ADR + check in same PR" policy. The CHANGELOG entry surfaces
  drift in code review.

### Markdown frontmatter

The companion schema for markdown frontmatter lives upstream in
[`aida-core/aida-core-plugin/.frontmatter-schema.json`](https://github.com/aida-core/aida-core-plugin/blob/main/.frontmatter-schema.json).
This marketplace **references** that schema rather than vendoring a copy.
Downstream consumers (the eventual Python frontmatter validator in
[#54](https://github.com/aida-core/aida-marketplace/issues/54), plugin
scaffolding in aida-core-plugin, IDE plugins) should also reference the
upstream URL. Vendoring is a drift trap.

## Consequences

**Gained:**

- IDE autocomplete and inline structural errors for anyone editing
  `marketplace.json`.
- A machine-readable spec consumable by tools outside the validator's TS
  runtime.
- Schema-driven structural errors with field paths (e.g.,
  `/plugins/0/category: "dev-workflow" is not one of [...]`), separate from
  semantic ADR-traceable errors.

**Accepted costs:**

- Two artifacts (schema + validator) describe overlapping constraints.
  Drift risk is real but bounded by the same-PR convention plus CI gating
  both gates on every change.
- `ajv` is added as a devDependency. Common, well-maintained, ~600KB; no
  runtime impact since the validator only runs in CI.
- Cross-field semantic rules (e.g., kind <-> suffix match) can't be
  expressed in the schema. The validator stays responsible for those.

## Enforcement

- `schemas/marketplace.schema.json` is the canonical structural definition.
- `scripts/validate-marketplace.ts` loads the schema, runs `ajv` structural
  validation first; on failure, prints schema errors and exits with code 1
  before running semantic rules.
- The manifest carries a `$schema` field pointing at the local schema so
  IDEs pick it up automatically.
- Frontmatter schema validation (when [#54](https://github.com/aida-core/aida-marketplace/issues/54)
  lands) references the upstream schema by URL, not a vendored copy.

When a rule's structural shape changes (e.g., a new ADR alters the manifest),
the PR MUST update both the schema and the validator rule. CHANGELOG entries
calling out only one of the two are a review-time smell.
