<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0011: Decline local commit hooks (rely on `make lint` + CI)

- **Status:** Accepted
- **Date:** 2026-05-23
- **Filed from:** [#78](https://github.com/aida-core/aida-marketplace/issues/78)

## Context

A common contributor-ergonomics pattern is local git commit hooks
(`pre-commit`, `lefthook`, `husky`) that run linters before a commit
lands. The value proposition is faster feedback — catch problems before
push instead of after CI runs.

This repo's current state:

- All checks already run in CI on every PR (~30s for the Lint job, ~15s
  for TypeScript). The feedback delta a pre-commit hook would save is
  small.
- `make lint` is the documented local path; it runs the same checks CI
  runs. Contributors who want pre-push feedback already have it.
- The repo has 4 devDependencies (`ajv`, `tsx`, `typescript`,
  `@types/node`) and a small contributor base. Hooks solve "team-scaling"
  problems we don't yet have.
- The toolchain is hybrid Node + Python (`yamllint`, `reuse`,
  `jsonschema`, `PyYAML`). A hook framework would need to bridge both.

## Considered options

1. **`pre-commit`** (Python framework, `.pre-commit-config.yaml`)
   - Pros: handles Python + Node tools uniformly; large ecosystem of
     pre-built hooks.
   - Cons: adds a Python framework on top of an already-Python-tooled
     venv; duplicates `make lint`; contributors must run
     `pre-commit install` once.

2. **`lefthook`** (Go binary, `lefthook.yml`)
   - Pros: zero-dep binary; fast; idiomatic for Node-first repos.
   - Cons: still requires `lefthook install`; new binary on every
     contributor's machine; doesn't natively handle the Python lint
     half.

3. **`husky`** (Node, `.husky/`)
   - Pros: npm-native; integrates cleanly with the Node toolchain.
   - Cons: awkward for the Python lint half; ~6 transitive deps.

4. **Decline adoption** — rely on `make lint` + fast CI.
   - Pros: no new contributor onboarding step; no new dependency; no
     drift between local hooks and CI; CI remains the single source of
     truth for what's required.
   - Cons: contributors who don't run `make lint` before pushing find
     out about issues 30 seconds later in CI.

## Decision

Adopt **option 4: decline local commit hooks** for now.

`make lint` is already the documented local path. CI is fast. Adding a
hook framework would create a *parallel* place where lint rules live
that has to stay in sync with the Makefile and CI. The cost of that
drift is real; the benefit (saving ~30s of CI feedback latency) is
marginal at this repo's scale.

This ADR is documentation-driven — there is no validator rule to add.
It records the deferral so the question doesn't get re-raised without
new evidence.

### Named re-open triggers

Revisit this decision when ANY of the following becomes true:

1. **Contributor volume.** Three or more active contributors landing
   more than five PRs per month.
2. **CI latency.** The Lint or TypeScript job p50 exceeds 2 minutes.
3. **Repeated fixup commits.** A single contributor lands three or more
   lint-only fixup commits in a single month.
4. **A scaffolded marketplace adopts hooks first** and the pattern
   proves itself there — `aida-marketplace` follows.

## Consequences

**Gained:**

- Zero new dependency surface; zero new contributor onboarding step.
- `make lint` remains the single local path, kept in sync by being the
  same target CI runs.
- Reference-implementation paper trail: a downstream marketplace
  scaffolded from this repo gets a clear "we evaluated and declined"
  rather than a stale opt-out comment.

**Accepted costs:**

- Contributors who don't run `make lint` before pushing learn about
  issues from CI (~30s later) rather than from a hook (~immediately).

## Enforcement

Documentation-driven. No validator rule, no CI gate. If a hook is
added without flipping this ADR to Superseded, that's a review-time
signal that the named triggers have been hit.
