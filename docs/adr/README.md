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
