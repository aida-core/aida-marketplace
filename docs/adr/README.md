<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Architectural Decision Records

This directory holds **ADRs** — short, immutable documents that record a single architectural decision the project has made, along with the context, options considered, and consequences.

ADRs exist so that conventions are discoverable and decisions don't get relitigated in every
PR. Every rule the marketplace enforces should be backed by an ADR, and every ADR should be
backed by a mechanical check (validator, CI workflow, schema).
See [#42](https://github.com/aida-core/aida-marketplace/issues/42) for the umbrella issue.

## File naming

`NNNN-kebab-case-title.md` — four-digit sequence, no gaps. New ADRs claim the next number.

## Status lifecycle

- **Proposed** — drafted, awaiting acceptance. Discussion happens on the linked issue/PR.
- **Accepted** — adopted as canonical. The enforcement mechanism is in place (or tracked as a follow-up).
- **Superseded by NNNN** — replaced by a later ADR. Body is preserved; link to the successor.
- **Deprecated** — no longer in force, no replacement.

Never edit an Accepted ADR's substance. To change a decision, write a new ADR that supersedes it.

## Template

See [`0000-adr-template.md`](./0000-adr-template.md). Copy it, rename, fill in.

## Index

| # | Title | Status | Filed from |
| --- | --- | --- | --- |
| 0001 | [Validator implementation language](./0001-validator-language.md) | Accepted | [#57](https://github.com/aida-core/aida-marketplace/issues/57) |
| 0002 | [Marketplace operator profiles](./0002-marketplace-profiles.md) | Accepted | [#56](https://github.com/aida-core/aida-marketplace/issues/56) |
| 0003 | [Marketplace entry kinds — plugin and guidebook](./0003-marketplace-entry-kinds.md) | Accepted | [#55](https://github.com/aida-core/aida-marketplace/issues/55) |
| 0004 | [GitHub App for cross-repo operations](./0004-github-app.md) | Accepted | [#58](https://github.com/aida-core/aida-marketplace/issues/58) |
| 0005 | [Author and owner identity](./0005-author-and-owner-identity.md) | Accepted | [#59](https://github.com/aida-core/aida-marketplace/issues/59) |
| 0006 | [Plugin source refs must be semver tags](./0006-semver-tag-refs.md) | Accepted | [#43](https://github.com/aida-core/aida-marketplace/issues/43) |
| 0007 | [Closed allow-list for plugin categories](./0007-category-allow-list.md) | Accepted | [#45](https://github.com/aida-core/aida-marketplace/issues/45) |
| 0008 | [JSON Schema as the canonical structural definition](./0008-json-schemas.md) | Accepted | [#50](https://github.com/aida-core/aida-marketplace/issues/50) |
| 0009 | [Listed plugins must ship `.claude-plugin/aida-config.json`](./0009-aida-config-required.md) | Accepted | [#44](https://github.com/aida-core/aida-marketplace/issues/44) |
| 0010 | [Branch protection baseline](./0010-branch-protection-baseline.md) | Accepted | [#49](https://github.com/aida-core/aida-marketplace/issues/49) |
| 0011 | [Decline local commit hooks](./0011-local-commit-hooks.md) | Accepted | [#78](https://github.com/aida-core/aida-marketplace/issues/78) |
| 0012 | [Supply-chain audit policy](./0012-supply-chain-audit-policy.md) | Accepted | [#76](https://github.com/aida-core/aida-marketplace/issues/76) |
| 0013 | [Marketplace release model](./0013-marketplace-release-model.md) | Accepted | [#77](https://github.com/aida-core/aida-marketplace/issues/77) |
