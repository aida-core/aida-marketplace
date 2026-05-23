<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# ADR-0009: Listed plugins must ship `.claude-plugin/aida-config.json`

- **Status:** Accepted
- **Date:** 2026-05-23
- **Filed from:** [#44](https://github.com/aida-core/aida-marketplace/issues/44)

## Context

The marketplace exists to curate **AIDA-conformant** plugins. Today, nothing
operationally enforces that a listed plugin actually IS AIDA-conformant —
anyone could submit a non-AIDA repository and the manifest would happily
accept it. The closest signal we have is the `-plugin` repo suffix
(ADR-0003), which is a naming convention, not a structural fact about the
plugin itself.

A better signal is the presence of `.claude-plugin/aida-config.json` in the
plugin's source repo. The AIDA scaffolding generator (in
`aida-core-plugin`) writes this file as part of `init`, and the file is
required for the plugin to function as an AIDA extension. So:

- **It's a structural fact, not a self-claim.** A `"aida": true` field
  somewhere can be added by anyone; an `aida-config.json` shipping a real
  config block has to come from the scaffolder or a deliberate hand-port.
- **It scales with the framework.** As `aida-config.json` evolves (new
  fields, schema versions), the marketplace gets free validation that
  plugins keep pace.
- **It's verifiable by a single GitHub Contents API call** at the pinned
  `source.ref` — no need to clone the plugin or parse its contents.

## Considered options

1. **No check** — current state. Listings are taken on faith.
   - Pros: zero work.
   - Cons: doesn't operationally enforce the marketplace's reason for existing.

2. **Verify `.claude-plugin/aida-config.json` exists at `source.ref`**
   for every listed plugin.
   - Pros: cheap (one API call per plugin per validate run); structural
     fact, not gameable by self-claim; aligns with the existing ref-existence
     check pattern in `update-marketplace.ts`.
   - Cons: requires network access in CI (`gh` CLI + `GITHUB_TOKEN`);
     private plugins need elevated auth (Enterprise profile per ADR-0002).

3. **Parse and validate `aida-config.json` contents** against a schema.
   - Pros: catches malformed configs, not just missing files.
   - Cons: a separate ADR's worth of design (what fields are required?
     what counts as "valid"?); the contents schema lives upstream in
     `aida-core-plugin` and changes there shouldn't break this validator.

4. **Require a specific commit SHA in `aida-config.json`** to prove the
   file came from a real scaffolder run.
   - Pros: more tamper-resistant.
   - Cons: forces all scaffolds to carry a synthetic SHA; over-engineered
     for the threat model (we trust the source-repo owner; this rule is
     about detecting accidents, not malice).

## Decision

Adopt **option 2: existence check at `source.ref`**.

Specifically:

- For every entry in `plugins[]` where `source.source === "github"`, the
  validator checks that `.claude-plugin/aida-config.json` exists at the
  pinned `source.ref` in the plugin's source repo.
- **Exception:** the AIDA foundation plugin
  (`aida-core/aida-core-plugin`) is exempt. The marketplace's existence is
  predicated on it being THE foundation; requiring it to declare
  conformance to itself is circular.
- **Non-github sources** are SKIPPED. The rule applies to GitHub refs
  only; other sources need their own conformance check (TBD).
- **404** on the Contents API → FAIL with a message naming the missing
  path and the pinned ref.
- **200** → OK.
- **Transient errors** (timeout, 5xx) → FAIL with a clear "could not
  verify" message. CI should never silently pass an unverified plugin.
- **`gh` CLI unavailable or unauthenticated locally** → SKIP all per-plugin
  checks with a notice asking the dev to install/auth gh. CI always has
  `gh` + `GITHUB_TOKEN`, so this branch only fires on dev machines.

This is *not* a contents check. We only verify file existence. A future
ADR can layer contents validation on top.

## Consequences

**Gained:**

- A real, structural conformance signal for every listed plugin.
- The marketplace's curated promise becomes mechanically enforceable.
- New plugins added without scaffolder usage get caught at PR time.
- Aligns the marketplace with the AIDA scaffolder's contract.

**Accepted costs:**

- N GitHub API calls per validate run (one per non-foundation,
  github-sourced plugin). With the current plugin count, this is trivial
  (~ms per call, well under any rate limit).
- CI requires `GH_TOKEN` on the validate step. (Already wired for the
  existing `npm run check` step.)
- Local dev requires `gh auth login` for a complete validation. Without it,
  ADR-0009 SKIPs (other rules still run).
- Private plugins (Enterprise profile per ADR-0002) require a GitHub App
  token for cross-repo reads (ADR-0004). Upstream's simple profile uses the
  default `GITHUB_TOKEN`.

## Enforcement

Validator rule `[ADR-0009]` (per [ADR-0001](./0001-validator-language.md)):

- Available + authenticated `gh` CLI required. The rule checks once at the
  start; if unavailable, it emits a single SKIP notice covering all
  per-plugin checks (no false FAIL on dev machines without `gh`).
- For each `plugins[]` entry where `source.source === "github"`:
  - If `source.repo === "aida-core/aida-core-plugin"`: SKIP (foundation
    exemption).
  - Otherwise: `gh api repos/{repo}/contents/.claude-plugin/aida-config.json?ref={ref}`.
    HTTP 200 → OK; HTTP 404 → FAIL; other errors → FAIL with "could not
    verify" message.
- Non-github sources: SKIP.
- Failure messages cite this ADR.

The rule is implemented with dependency injection (`RemoteFileChecker`
interface) so tests can run with a mock checker. The default checker
shells out to `gh api` for production use.
