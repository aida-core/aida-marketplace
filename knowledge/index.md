---
type: reference
title: Knowledge index — aida-marketplace contributor docs
description: Catalog of progressively-loaded reference material for contributors and Claude Code. Routes to workflows, tooling, troubleshooting; not loaded unconditionally.
---

<!-- SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Knowledge index

Progressive-disclosure reference material for `aida-marketplace`. Read these
on demand; `CLAUDE.md` at the repo root has the always-loaded hard rules and
command reference.

The companion ADR index lives at [`docs/adr/README.md`](../docs/adr/README.md).
Operational runbooks live in [`docs/runbooks/`](../docs/runbooks/). Don't
duplicate that content here — link to it.

## Files in this directory

| File | Purpose | Read when… |
| --- | --- | --- |
| [`index.md`](./index.md) | This catalog | You want to know what else exists |
| [`workflows.md`](./workflows.md) | Step-by-step contributor recipes | You're trying to *do* something (add a plugin, amend an ADR, rebuild the manifest, etc.) |
| [`tooling.md`](./tooling.md) | Inventory of every tool, schema, and config | You want to know *what's wired up* (validator, Renovate, lychee, labeler, AI-coauthor gate, etc.) |
| [`troubleshooting.md`](./troubleshooting.md) | Common contributor failure modes | A check is red and you don't know why (REUSE, frontmatter, lychee, signed commits, validator rules) |

## Audience modes

- **Human contributor** — start with the README, glance at `workflows.md` for
  the recipe that matches your task, drop into `tooling.md` or specific ADRs
  as needed.
- **Claude Code working on a PR** — `CLAUDE.md` is already loaded. Read the
  specific knowledge file that matches the question; don't bulk-read this
  directory. ADRs are short — read the source rather than paraphrase.
- **Author of a new knowledge file** — match the frontmatter shape used by
  existing files. Don't restate ADRs or runbooks; link them. The line
  between "this file" and "an ADR" is: ADRs record *decisions*; knowledge
  files record *how to navigate and apply* those decisions.

## What's NOT in this directory

- **ADRs themselves** — they live in [`docs/adr/`](../docs/adr/). Read
  [`docs/adr/README.md`](../docs/adr/README.md) for the index. There is no
  separate `governance.md` here — adding one would just duplicate the ADR
  index and drift on the first amendment.
- **Branch-protection commands** — in [`docs/runbooks/branch-protection.md`](../docs/runbooks/branch-protection.md).
- **Org-wide contributor process** — in `aida-core/.github` (CONTRIBUTING.md
  at the org level applies as a fallback).
- **Consumer-facing install instructions** — in the root [`README.md`](../README.md).
