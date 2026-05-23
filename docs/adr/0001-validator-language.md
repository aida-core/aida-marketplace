<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0001: Validator implementation language

- **Status:** Accepted
- **Date:** 2026-05-22
- **Filed from:** [#57](https://github.com/aida-core/aida-marketplace/issues/57)

## Context

The marketplace needs a validator that enforces per-rule constraints on `marketplace.json` and listed-plugin metadata (see [#42](https://github.com/aida-core/aida-marketplace/issues/42)). Today, validation lives in TypeScript inside `scripts/update-marketplace.ts --check`. A downstream marketplace (Splash-AI) implements the same checks as `scripts/validate-marketplace.sh` calling Python heredocs.

We need to decide on a canonical implementation language so that:

1. New rules land in a predictable place when ADRs are added.
2. Downstream marketplaces have a reference pattern to copy.
3. Contributors have one runtime to install when running validation locally.

## Considered options

1. **TypeScript (current)** — extend `scripts/update-marketplace.ts` with a structured `--check` mode that emits per-rule `OK` / `FAIL` / `SKIP` and names the ADR in failures.
   - Pros: same language as update tooling, type safety, no second runtime, JSON Schema validators (ajv) are first-class.
   - Cons: `npm install` required for any contributor running validation locally; bash composability is poor.

2. **bash + Python (downstream pattern)** — a `validate-marketplace.sh` orchestrates per-rule sections, shelling out to `python3 -c '...'` for JSON manipulation.
   - Pros: trivially scriptable per-rule, Python is ubiquitous on CI runners, easy to add a rule by appending a section.
   - Cons: mixed runtime, brittle heredoc quoting, no shared type model with the update tooling.

3. **Hybrid (bash orchestrator + TypeScript checker)** — keep the per-rule structure in bash, but each section calls into the TypeScript validator with a `--rule=<id>` flag.
   - Pros: gets bash's per-rule visibility and TypeScript's type safety.
   - Cons: most complex of the three; two languages to maintain; startup cost (Node) per rule invocation unless batched.

## Decision

Adopt **TypeScript** as the canonical validator language. Extend `scripts/update-marketplace.ts` into a `scripts/validate-marketplace.ts` (or add a `validate` subcommand) that emits structured per-rule results with ADR references in failure messages.

Rationale:

- The update tooling is already TypeScript — co-locating prevents the type model from forking.
- `npm install` is a one-time cost; the marketplace already requires Node for update tooling.
- JSON Schema validation (ADR-0xxx, see [#50](https://github.com/aida-core/aida-marketplace/issues/50)) is best expressed in JS-native validators.
- Downstream marketplaces in mixed-runtime shops can still wrap our TS validator in bash; the reverse (wrapping bash from TS) is uglier.

## Consequences

**Gained:**

- One language for both update tooling and validation; shared types for `marketplace.json`.
- Easier to publish the validator as a reusable npm package later if needed.
- Better tooling (LSP, refactors, generated types from JSON Schema).

**Accepted costs:**

- Contributors must run `npm install` to validate locally — partially mitigated by a `make validate` target that handles bootstrap.
- Downstream marketplaces preferring Python/bash get a documented "alternative pattern" note but not first-class support.

## Enforcement

- The CI workflow runs `make validate` (which runs the TS validator); this is the gate.
- New rules added per-ADR ship as a new check inside the validator, named with the ADR number (e.g., `[ADR-0003]`) so failure messages are traceable.
- A future ADR may define the per-rule output format (`OK` / `FAIL` / `SKIP`) more rigorously — track as a follow-up if drift appears.
