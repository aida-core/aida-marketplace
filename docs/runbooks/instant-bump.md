<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Runbook: instant marketplace bump via `repository_dispatch`

By default, Renovate polls listed plugins weekly (Monday 08:00 UTC). For
`aida-core/*` plugins the 0-day age exemption means the bump lands the
same Monday. Other plugins wait the 14-day org-wide
`minimumReleaseAge` gate.

If a plugin needs **instant** propagation (e.g., a security-fix release
the same day it ships), the marketplace's `check-updates.yml` workflow
accepts a `repository_dispatch` event of type `plugin-released`. This
runbook documents the plugin-side workflow that sends the event.

## When to enable this

Only enable on a plugin repo if at least one of the following is true:

- The plugin ships releases multiple times per day (Renovate's
  weekly cycle becomes a bottleneck).
- The plugin is trusted enough that bypassing the marketplace's
  routine update cadence is acceptable for THIS plugin specifically.
- A real incident has been bottlenecked by Renovate latency.

If none of the above apply, the answer is "don't add this" — the
default cadence is sufficient.

## What it does (vs what it doesn't)

The dispatch triggers `check-updates.yml`, which is the **legacy
auto-PR workflow**. It opens a PR with the new version bump that goes
through normal CI + branch protection. It does **not** auto-merge.
Renovate's own automation (with its supply-chain gates) is still the
primary path.

## Plugin-side workflow

In each plugin repo that opts in, add `.github/workflows/notify-marketplace.yml`:

```yaml
# SPDX-FileCopyrightText: 2026 <plugin author>
# SPDX-License-Identifier: <plugin license>

---
name: Notify aida-marketplace of release

on:
  release:
    types: [published]

# Only the dispatch step needs auth; default GITHUB_TOKEN cannot dispatch
# across repos, so the dispatch step uses a secret PAT or App token.
permissions:
  contents: read

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Dispatch marketplace update check
        uses: peter-evans/repository-dispatch@SHA-PIN-HERE # vX.Y.Z
        with:
          token: ${{ secrets.MARKETPLACE_DISPATCH_TOKEN }}
          repository: aida-core/aida-marketplace
          event-type: plugin-released
          client-payload: |
            {
              "plugin": "${{ github.repository }}",
              "version": "${{ github.event.release.tag_name }}"
            }
```

### Required secret

`MARKETPLACE_DISPATCH_TOKEN` must be a token with `Contents: Write` and
`Actions: Write` on `aida-core/aida-marketplace`. Options:

- **Fine-grained PAT** owned by a maintainer. Lower setup cost; rotation
  becomes a per-maintainer task.
- **GitHub App** (per ADR-0004 Enterprise profile path). Higher setup
  cost; cleaner rotation; survives maintainer changes.

For most plugins under the Simple-profile org, a fine-grained PAT is
sufficient. The PAT MUST be scoped to `aida-core/aida-marketplace`
only — not the whole user.

## Verifying it works

After the workflow lands and the next release publishes:

1. Visit the marketplace's Actions page; confirm a `Check Plugin Updates`
   run was triggered by `repository_dispatch` (visible in the run header).
2. Confirm the run opened a PR titled `chore: update plugin versions`
   if the new release was actually newer than the pinned ref.
3. The PR should appear within ~30s of the plugin release. If it
   doesn't, check:
   - The dispatch token is still valid.
   - The plugin repo's notify workflow ran successfully.
   - `client-payload.plugin` matches the marketplace's
     `source.repo` for that listing.

## Removing it

Delete `.github/workflows/notify-marketplace.yml` from the plugin repo
and revoke `MARKETPLACE_DISPATCH_TOKEN`. The marketplace's dispatch
listener is harmless without dispatches — it just sits dormant.

## Interaction with Renovate

The dispatch path and Renovate are independent. Possible outcomes:

- Renovate hasn't opened a PR yet (e.g., between Monday cycles) — the
  dispatch opens one. Renovate's next cycle finds it and skips.
- Renovate already opened a PR — the dispatch workflow's existing-PR
  check (`automated/plugin-updates-*` branch prefix search) skips.

No conflict, no duplicate PRs.

## Out of scope

This runbook documents the *opt-in* dispatch path for plugins that need
instant propagation. It does not promote dispatch as the default — the
default remains Renovate's polling cadence with supply-chain gates.

For the cross-repo App-vs-PAT decision, see
[ADR-0004](../adr/0004-github-app.md). The Enterprise-profile
recommendation there matches the App-based variant of this runbook's
auth.
