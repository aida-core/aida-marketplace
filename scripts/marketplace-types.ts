// SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors
// SPDX-License-Identifier: MPL-2.0

// Shared type definitions for the AIDA marketplace manifest. Imported by
// scripts/update-marketplace.ts (write side) and scripts/validate-marketplace.ts
// (read-only rule enforcement). Field-level rules are enforced by the
// validator, not the type system — types describe shape, validator describes
// policy (per ADR-0001).

export interface PluginSource {
  source: string;
  repo: string;
  ref: string;
}

export interface PluginAuthor {
  name: string;
  // email is allowed by the schema but forbidden by ADR-0005's validator rule.
  // It stays in the type so legacy manifests still typecheck during migration.
  email?: string;
}

export type PluginKind = "plugin" | "guidebook";

export interface Plugin {
  name: string;
  // `kind` is required by ADR-0003 but optional in the type for the same
  // migration reason. The validator emits a FAIL when it's missing.
  kind?: PluginKind;
  source: PluginSource;
  description: string;
  version: string;
  category: string;
  homepage?: string;
  author?: PluginAuthor;
  tags: string[];
}

export interface MarketplaceOwner {
  name: string;
  // ADR-0005 forbids both of these on owner. Same migration reasoning.
  email?: string;
  url?: string;
}

export interface Marketplace {
  name: string;
  version: string;
  description: string;
  owner: MarketplaceOwner;
  plugins: Plugin[];
}
