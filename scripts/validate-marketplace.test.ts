// SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors
// SPDX-License-Identifier: MPL-2.0

// Unit tests for the marketplace validator. Run via `npm test` (or
// `make test`). Uses Node's built-in test runner — no extra deps.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  adr0003,
  adr0005,
  adr0006,
  adr0007,
  isValidGitHubSlug,
  makeAdr0009Rule,
  validateSchema,
  type FileCheckResult,
  type RemoteFileChecker,
} from "./validate-marketplace.js";
import type { Marketplace, Plugin } from "./marketplace-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA: unknown = JSON.parse(
  readFileSync(resolve(__dirname, "..", "schemas", "marketplace.schema.json"), "utf-8"),
);

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

describe("ADR-0007 rule (category allow-list)", () => {
  const ALLOWED = [
    "core",
    "workflow",
    "infrastructure",
    "language",
    "integration",
    "domain",
    "productivity",
    "security",
    "observability",
  ];

  it("passes for each allowed category", () => {
    const m = baseMarketplace();
    for (const cat of ALLOWED) {
      m.plugins.push(basePlugin({ name: cat, category: cat }));
    }
    const fails = adr0007.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 0);
  });

  it("fails on an ad-hoc category", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ category: "dev-workflow" }));
    const fails = adr0007.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
    assert.match(fails[0].message, /not in the allow-list/);
  });

  it("fails on a near-miss typo", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ category: "workflows" })); // plural — typo
    const fails = adr0007.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
  });

  it("fails on empty string", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ category: "" }));
    const fails = adr0007.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
    assert.match(fails[0].message, /required/);
  });

  it("fails on missing category", () => {
    const m = baseMarketplace();
    const p = basePlugin();
    (p as { category?: unknown }).category = undefined;
    m.plugins.push(p);
    const fails = adr0007.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
  });

  it("failure message lists the allow-list", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ category: "bogus" }));
    const fails = adr0007.check(m).filter((f) => f.status === "FAIL");
    assert.match(fails[0].message, /core/);
    assert.match(fails[0].message, /security/);
    assert.match(fails[0].message, /observability/);
  });

  it("failure message points to the ADR amendment process", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin({ category: "bogus" }));
    const fails = adr0007.check(m).filter((f) => f.status === "FAIL");
    assert.match(fails[0].message, /ADR amendment/);
  });
});

describe("Schema validation (ADR-0008)", () => {
  function validManifest(): Record<string, unknown> {
    return {
      name: "test",
      version: "0.1.0",
      description: "A test marketplace.",
      owner: { name: "aida-core" },
      plugins: [
        {
          name: "example",
          kind: "plugin",
          source: { source: "github", repo: "aida-core/example-plugin", ref: "v1.0.0" },
          description: "An example.",
          version: "1.0.0",
          category: "core",
          author: { name: "aida-core" },
          tags: ["example"],
        },
      ],
    };
  }

  it("accepts a clean manifest", () => {
    const result = validateSchema(validManifest(), SCHEMA);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it("accepts a manifest with optional $schema field", () => {
    const m = validManifest();
    m.$schema = "https://example.com/schema.json";
    const result = validateSchema(m, SCHEMA);
    assert.equal(result.valid, true);
  });

  it("rejects manifest missing required `owner`", () => {
    const m = validManifest();
    delete m.owner;
    const result = validateSchema(m, SCHEMA);
    assert.equal(result.valid, false);
  });

  it("rejects manifest missing required `plugins`", () => {
    const m = validManifest();
    delete m.plugins;
    const result = validateSchema(m, SCHEMA);
    assert.equal(result.valid, false);
  });

  it("rejects owner with forbidden `email` property", () => {
    const m = validManifest();
    (m.owner as Record<string, unknown>).email = "ops@example.com";
    const result = validateSchema(m, SCHEMA);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /additionalProp/i.test(e.message ?? "") || /email/.test(JSON.stringify(e.params))));
  });

  it("rejects owner.name that isn't a valid GitHub slug", () => {
    const m = validManifest();
    (m.owner as Record<string, unknown>).name = "foo bar"; // space invalid
    const result = validateSchema(m, SCHEMA);
    assert.equal(result.valid, false);
  });

  it("rejects plugin with invalid `kind` enum value", () => {
    const m = validManifest();
    ((m.plugins as Array<Record<string, unknown>>)[0]).kind = "playbook";
    const result = validateSchema(m, SCHEMA);
    assert.equal(result.valid, false);
  });

  it("rejects plugin with category not in the allow-list", () => {
    const m = validManifest();
    ((m.plugins as Array<Record<string, unknown>>)[0]).category = "dev-workflow";
    const result = validateSchema(m, SCHEMA);
    assert.equal(result.valid, false);
  });

  it("rejects plugin with source.ref that isn't semver", () => {
    const m = validManifest();
    const source = ((m.plugins as Array<Record<string, unknown>>)[0]).source as Record<string, unknown>;
    source.ref = "main";
    const result = validateSchema(m, SCHEMA);
    assert.equal(result.valid, false);
  });

  it("rejects plugin missing required `kind`", () => {
    const m = validManifest();
    delete ((m.plugins as Array<Record<string, unknown>>)[0]).kind;
    const result = validateSchema(m, SCHEMA);
    assert.equal(result.valid, false);
  });

  it("rejects wrong type on version (number instead of string)", () => {
    const m = validManifest();
    m.version = 1 as unknown as string;
    const result = validateSchema(m, SCHEMA);
    assert.equal(result.valid, false);
  });

  it("error paths point to the failing field", () => {
    const m = validManifest();
    ((m.plugins as Array<Record<string, unknown>>)[0]).category = "bogus";
    const result = validateSchema(m, SCHEMA);
    assert.equal(result.valid, false);
    const categoryErr = result.errors.find((e) => /category/.test(e.instancePath ?? ""));
    assert.ok(categoryErr, "expected an error with instancePath containing /category");
  });
});

describe("ADR-0009 rule (aida-config.json existence)", () => {
  function makeMockChecker(opts: {
    available?: boolean;
    files?: Record<string, FileCheckResult>;
  }): RemoteFileChecker {
    return {
      isAvailable: () => opts.available ?? true,
      checkFile: (repo, ref, path): FileCheckResult => {
        const key = `${repo}@${ref}:${path}`;
        return opts.files?.[key] ?? "missing";
      },
    };
  }

  it("emits a single SKIP when the checker is unavailable", () => {
    const m = baseMarketplace();
    m.plugins.push(basePlugin());
    m.plugins.push(basePlugin({ name: "b" }));
    const rule = makeAdr0009Rule(makeMockChecker({ available: false }));
    const findings = rule.check(m);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].status, "SKIP");
    assert.match(findings[0].message, /unavailable/);
  });

  it("exempts the AIDA foundation plugin", () => {
    const m = baseMarketplace();
    m.plugins.push(
      basePlugin({
        name: "aida-core",
        source: { source: "github", repo: "aida-core/aida-core-plugin", ref: "v1.4.6" },
      }),
    );
    const rule = makeAdr0009Rule(makeMockChecker({ available: true, files: {} }));
    const findings = rule.check(m);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].status, "SKIP");
    assert.match(findings[0].message, /foundation/);
  });

  it("skips non-github sources", () => {
    const m = baseMarketplace();
    m.plugins.push(
      basePlugin({
        source: { source: "npm", repo: "some-pkg", ref: "1.0.0" } as Plugin["source"],
      }),
    );
    const rule = makeAdr0009Rule(makeMockChecker({ available: true, files: {} }));
    const findings = rule.check(m);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].status, "SKIP");
  });

  it("passes when aida-config.json is present", () => {
    const m = baseMarketplace();
    m.plugins.push(
      basePlugin({
        name: "pulumi",
        source: { source: "github", repo: "aida-core/aida-pulumi-plugin", ref: "v0.9.0" },
      }),
    );
    const rule = makeAdr0009Rule(
      makeMockChecker({
        available: true,
        files: {
          "aida-core/aida-pulumi-plugin@v0.9.0:.claude-plugin/aida-config.json": "present",
        },
      }),
    );
    const findings = rule.check(m);
    const fails = findings.filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 0);
    assert.equal(findings.filter((f) => f.status === "OK").length, 1);
  });

  it("fails when aida-config.json is missing (404)", () => {
    const m = baseMarketplace();
    m.plugins.push(
      basePlugin({
        name: "flow",
        source: { source: "github", repo: "aida-core/aida-flow-plugin", ref: "v0.1.0" },
      }),
    );
    const rule = makeAdr0009Rule(
      makeMockChecker({
        available: true,
        files: {
          "aida-core/aida-flow-plugin@v0.1.0:.claude-plugin/aida-config.json": "missing",
        },
      }),
    );
    const fails = rule.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
    assert.match(fails[0].message, /HTTP 404/);
  });

  it("fails on a network/checker error (could not verify)", () => {
    const m = baseMarketplace();
    m.plugins.push(
      basePlugin({
        name: "flow",
        source: { source: "github", repo: "aida-core/aida-flow-plugin", ref: "v0.1.0" },
      }),
    );
    const rule = makeAdr0009Rule(
      makeMockChecker({
        available: true,
        files: {
          "aida-core/aida-flow-plugin@v0.1.0:.claude-plugin/aida-config.json": "error",
        },
      }),
    );
    const fails = rule.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
    assert.match(fails[0].message, /could not verify/);
  });

  it("fails when source.ref is missing", () => {
    const m = baseMarketplace();
    const plugin = basePlugin({
      source: { source: "github", repo: "aida-core/x-plugin", ref: "v1.0.0" },
    });
    (plugin.source as { ref?: unknown }).ref = undefined;
    m.plugins.push(plugin);
    const rule = makeAdr0009Rule(makeMockChecker({ available: true }));
    const fails = rule.check(m).filter((f) => f.status === "FAIL");
    assert.equal(fails.length, 1);
    assert.match(fails[0].message, /source.ref/);
  });

  it("handles a multi-plugin manifest with mixed outcomes", () => {
    const m = baseMarketplace();
    m.plugins.push(
      basePlugin({
        name: "core",
        source: { source: "github", repo: "aida-core/aida-core-plugin", ref: "v1.4.6" },
      }),
    );
    m.plugins.push(
      basePlugin({
        name: "pulumi",
        source: { source: "github", repo: "aida-core/aida-pulumi-plugin", ref: "v0.9.0" },
      }),
    );
    m.plugins.push(
      basePlugin({
        name: "flow",
        source: { source: "github", repo: "aida-core/aida-flow-plugin", ref: "v0.1.0" },
      }),
    );
    const rule = makeAdr0009Rule(
      makeMockChecker({
        available: true,
        files: {
          "aida-core/aida-pulumi-plugin@v0.9.0:.claude-plugin/aida-config.json": "present",
          "aida-core/aida-flow-plugin@v0.1.0:.claude-plugin/aida-config.json": "missing",
        },
      }),
    );
    const findings = rule.check(m);
    const skips = findings.filter((f) => f.status === "SKIP");
    const oks = findings.filter((f) => f.status === "OK");
    const fails = findings.filter((f) => f.status === "FAIL");
    assert.equal(skips.length, 1, "foundation is skipped");
    assert.equal(oks.length, 1, "pulumi has file → OK");
    assert.equal(fails.length, 1, "flow missing → FAIL");
  });
});
