// SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors
// SPDX-License-Identifier: MPL-2.0

// Unit tests for the marketplace validator. Run via `npm test` (or
// `make test`). Uses Node's built-in test runner — no extra deps.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { adr0003, adr0005, adr0006, isValidGitHubSlug } from "./validate-marketplace.js";
import type { Marketplace, Plugin } from "./marketplace-types.js";

function baseMarketplace(): Marketplace {
  return {
    name: "test",
    version: "0.1.0",
    description: "",
    owner: { name: "aida-core" },
    plugins: [],
  };
}

function basePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    name: "example",
    kind: "plugin",
    source: { source: "github", repo: "aida-core/example-plugin", ref: "v1.0.0" },
    description: "An example.",
    version: "1.0.0",
    category: "core",
    author: { name: "aida-core" },
    tags: ["example"],
    ...overrides,
  };
}

describe("isValidGitHubSlug", () => {
  it("accepts a simple lowercase slug", () => {
    assert.equal(isValidGitHubSlug("aida-core"), true);
  });

  it("accepts a single-character slug", () => {
    assert.equal(isValidGitHubSlug("a"), true);
  });

  it("accepts mixed-case", () => {
    assert.equal(isValidGitHubSlug("Oakensoul"), true);
  });

  it("rejects empty string", () => {
    assert.equal(isValidGitHubSlug(""), false);
  });

  it("rejects leading hyphen", () => {
    assert.equal(isValidGitHubSlug("-foo"), false);
  });

  it("rejects trailing hyphen", () => {
    assert.equal(isValidGitHubSlug("foo-"), false);
  });

  it("rejects consecutive hyphens", () => {
    assert.equal(isValidGitHubSlug("foo--bar"), false);
  });

  it("rejects underscore", () => {
    assert.equal(isValidGitHubSlug("foo_bar"), false);
  });

  it("rejects slash (path-like)", () => {
    assert.equal(isValidGitHubSlug("aida-core/aida-core-plugin"), false);
  });

  it("rejects slugs longer than 39 chars", () => {
    assert.equal(isValidGitHubSlug("a".repeat(40)), false);
  });

  it("accepts a 39-char slug", () => {
    assert.equal(isValidGitHubSlug("a".repeat(39)), true);
  });
});

describe("ADR-0003 rule (kind + matching suffix)", () => {
  it("passes when kind matches the source.repo suffix", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin());
    const findings = adr0003.check(m);
    assert.equal(findings.filter((f) => f.status === "FAIL").length, 0);
    assert.equal(findings.filter((f) => f.status === "OK").length, 1);
  });

  it("passes for a guidebook with matching -guidebook suffix", () => {
    const m = baseMarketplace();
    m.plugins.push(
      basePlugin({
        name: "contests",
        kind: "guidebook",
        source: { source: "github", repo: "aida-core/contests-guidebook", ref: "v0.1.0" },
      }),
    );
    const findings = adr0003.check(m);
    assert.equal(findings.filter((f) => f.status === "FAIL").length, 0);
  });

  it("fails when kind is missing", () => {
    const m = baseMarketplace();
    const p = basePlugin();
    delete (p as { kind?: unknown }).kind;
    m.plugins.push(p);
    const fails = adr0003.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
    assert.match(fails[0].message, /kind.*required/i);
  });

  it("fails when kind is not in the allowed set", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ kind: "playbook" as unknown as Plugin["kind"] }));
    const fails = adr0003.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
    assert.match(fails[0].message, /must be one of/i);
  });

  it("fails when kind=plugin but suffix is -guidebook", () => {
    const m = baseMarketplace();
    m.plugins.push(
      basePlugin({
        source: { source: "github", repo: "aida-core/example-guidebook", ref: "v1.0.0" },
      }),
    );
    const fails = adr0003.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
    assert.match(fails[0].message, /-plugin/);
  });

  it("returns one finding per plugin", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ name: "a" }));
    m.plugins.push(basePlugin({ name: "b" }));
    const findings = adr0003.check(m);
    assert.equal(findings.length, 2);
  });
});

describe("ADR-0005 rule (slug identity, no email, no owner.url)", () => {
  it("passes for a clean owner + clean plugin author", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin());
    const findings = adr0005.check(m);
    assert.equal(findings.filter((f) => f.status === "FAIL").length, 0);
  });

  it("fails when owner.name is not a valid slug", () => {
    const m = baseMarketplace();
    m.owner.name = "foo bar"; // space is invalid
    const fails = adr0005.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
    assert.match(fails[0].message, /not a valid GitHub slug/);
  });

  it("fails when owner.email is present", () => {
    const m = baseMarketplace();
    m.owner.email = "rj@example.com";
    const fails = adr0005.check(m).filter((f) => f.status === "FAIL");
    assert.ok(fails.some((f) => /owner.email/i.test(f.message)));
  });

  it("fails when owner.url is present", () => {
    const m = baseMarketplace();
    m.owner.url = "https://example.com";
    const fails = adr0005.check(m).filter((f) => f.status === "FAIL");
    assert.ok(fails.some((f) => /owner.url/i.test(f.message)));
  });

  it("fails when plugin author.name is missing", () => {
    const m = baseMarketplace();
    const p = basePlugin();
    delete (p as { author?: unknown }).author;
    m.plugins.push(p);
    const fails = adr0005.check(m).filter((f) => f.status === "FAIL");
    assert.ok(fails.some((f) => /author.name.*required/i.test(f.message)));
  });

  it("fails when plugin author.name is not a valid slug", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ author: { name: "AIDA Core" } })); // space invalid
    const fails = adr0005.check(m).filter((f) => f.status === "FAIL");
    assert.ok(fails.some((f) => /not a valid GitHub slug/.test(f.message)));
  });

  it("fails when plugin author.email is present", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ author: { name: "aida-core", email: "ops@example.com" } }));
    const fails = adr0005.check(m).filter((f) => f.status === "FAIL");
    assert.ok(fails.some((f) => /author.email/i.test(f.message)));
  });

  it("passes for a multi-plugin manifest with all-clean entries", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ name: "a" }));
    m.plugins.push(
      basePlugin({
        name: "b",
        kind: "guidebook",
        source: { source: "github", repo: "aida-core/b-guidebook", ref: "v0.1.0" },
      }),
    );
    const findings = adr0005.check(m);
    assert.equal(findings.filter((f) => f.status === "FAIL").length, 0);
  });
});

describe("ADR-0006 rule (semver-tag refs)", () => {
  it("passes for a v-prefixed semver tag", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ source: { source: "github", repo: "aida-core/example-plugin", ref: "v1.4.6" } }));
    const findings = adr0006.check(m);
    assert.equal(findings.filter((f) => f.status === "FAIL").length, 0);
    assert.equal(findings.filter((f) => f.status === "OK").length, 1);
  });

  it("passes for a bare semver tag (no v prefix)", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ source: { source: "github", repo: "aida-core/example-plugin", ref: "1.4.6" } }));
    const findings = adr0006.check(m).filter((f) => f.status === "FAIL");
    assert.equal(findings.length, 0);
  });

  it("fails on a branch name", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ source: { source: "github", repo: "aida-core/example-plugin", ref: "main" } }));
    const fails = adr0006.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
    assert.match(fails[0].message, /not a semver tag/);
  });

  it("fails on a 40-char commit SHA", () => {
    const m = baseMarketplace();
    m.plugins.push(
      basePlugin({
        source: { source: "github", repo: "aida-core/example-plugin", ref: "a1b2c3d4e5f6789012345678901234567890abcd" },
      }),
    );
    const fails = adr0006.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
  });

  it("fails on a non-semver tag", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ source: { source: "github", repo: "aida-core/example-plugin", ref: "release-2024-01" } }));
    const fails = adr0006.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
  });

  it("fails on a pre-release tag", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ source: { source: "github", repo: "aida-core/example-plugin", ref: "v1.2.3-rc1" } }));
    const fails = adr0006.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
    assert.match(fails[0].message, /pre-release/);
  });

  it("fails on a build-metadata tag", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ source: { source: "github", repo: "aida-core/example-plugin", ref: "v1.2.3+build.5" } }));
    const fails = adr0006.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
  });

  it("fails on a two-segment version", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ source: { source: "github", repo: "aida-core/example-plugin", ref: "v1.2" } }));
    const fails = adr0006.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
  });

  it("fails on a missing ref", () => {
    const m = baseMarketplace();
    const plugin = basePlugin();
    (plugin.source as { ref?: unknown }).ref = undefined;
    m.plugins.push(plugin);
    const fails = adr0006.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
    assert.match(fails[0].message, /required/);
  });

  it("skips non-github sources", () => {
    const m = baseMarketplace();
    m.plugins.push(
      basePlugin({
        source: { source: "npm", repo: "some-pkg", ref: "1.0.0" } as Plugin["source"],
      }),
    );
    const findings = adr0006.check(m);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].status, "SKIP");
  });
});
