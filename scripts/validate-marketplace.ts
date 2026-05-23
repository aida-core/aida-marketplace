// SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors
// SPDX-License-Identifier: MPL-2.0

// Marketplace validator (per ADR-0001).
//
// Reads .claude-plugin/marketplace.json and runs each registered rule. Each
// rule emits per-finding OK / FAIL records with the originating ADR number in
// the message. Exits 1 if any rule produced a FAIL; 0 otherwise.
//
// Adding a new rule:
//   1. Write an ADR under docs/adr/.
//   2. Add a Rule export in this file (or a new module imported here).
//   3. Add it to the RULES list at the bottom.
//   4. Add unit tests in scripts/validate-marketplace.test.ts.
//
// Each rule's failure messages MUST cite the ADR by id (e.g. `[ADR-0003]`)
// so contributors can find the rationale without leaving the terminal.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv, { type ErrorObject } from "ajv";

import type { Marketplace, Plugin } from "./marketplace-types.js";

// --- Types ---

export type FindingStatus = "OK" | "FAIL" | "SKIP";

export interface Finding {
  /** ADR identifier, e.g. "ADR-0003". */
  rule: string;
  status: FindingStatus;
  /** Manifest path or human-friendly locator, e.g. `plugins[0] (aida-core)`. */
  context: string;
  message: string;
}

export interface Rule {
  /** ADR identifier, e.g. "ADR-0003". */
  id: string;
  /** One-line description of what the rule enforces. */
  title: string;
  /** Run the check; return one or more findings. */
  check(marketplace: Marketplace): Finding[];
}

// --- Slug helper (ADR-0005) ---

/**
 * Returns true iff `slug` matches GitHub's username/org rules: alphanumeric or
 * hyphens, no leading/trailing hyphen, no consecutive hyphens, 1-39 chars.
 */
export function isValidGitHubSlug(slug: string): boolean {
  if (typeof slug !== "string") return false;
  if (slug.length < 1 || slug.length > 39) return false;
  // Must start and end with alphanumeric; interior chars are alphanumeric or
  // single hyphens (never consecutive).
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(slug);
}

// --- Rule: ADR-0003 (kind field + matching repo suffix) ---

function pluginContext(plugin: Plugin, index: number): string {
  return `plugins[${index}] (${plugin.name})`;
}

export const adr0003: Rule = {
  id: "ADR-0003",
  title: "Marketplace entry kinds: plugin / guidebook with matching suffix",
  check(marketplace) {
    const findings: Finding[] = [];
    marketplace.plugins.forEach((plugin, i) => {
      const ctx = pluginContext(plugin, i);
      const kind = plugin.kind;

      if (kind === undefined) {
        findings.push({
          rule: "ADR-0003",
          status: "FAIL",
          context: ctx,
          message: "`kind` is required (must be \"plugin\" or \"guidebook\").",
        });
        return;
      }

      if (kind !== "plugin" && kind !== "guidebook") {
        findings.push({
          rule: "ADR-0003",
          status: "FAIL",
          context: ctx,
          message: `\`kind\` is "${kind}"; must be one of "plugin" or "guidebook".`,
        });
        return;
      }

      const expectedSuffix = `-${kind}`;
      if (!plugin.source.repo.endsWith(expectedSuffix)) {
        findings.push({
          rule: "ADR-0003",
          status: "FAIL",
          context: ctx,
          message:
            `source.repo "${plugin.source.repo}" must end with "${expectedSuffix}" ` +
            `to match \`kind: "${kind}"\`.`,
        });
        return;
      }

      findings.push({
        rule: "ADR-0003",
        status: "OK",
        context: ctx,
        message: `kind="${kind}" matches repo suffix`,
      });
    });
    return findings;
  },
};

// --- Rule: ADR-0005 (GitHub slug identity; no email; no owner.url) ---

export const adr0005: Rule = {
  id: "ADR-0005",
  title: "Author and owner identity: GitHub slug, no email, no owner.url",
  check(marketplace) {
    const findings: Finding[] = [];

    // owner.name
    if (!marketplace.owner || typeof marketplace.owner.name !== "string") {
      findings.push({
        rule: "ADR-0005",
        status: "FAIL",
        context: "owner",
        message: "`owner.name` is required.",
      });
    } else if (!isValidGitHubSlug(marketplace.owner.name)) {
      findings.push({
        rule: "ADR-0005",
        status: "FAIL",
        context: "owner",
        message: `\`owner.name\` "${marketplace.owner.name}" is not a valid GitHub slug.`,
      });
    } else {
      findings.push({
        rule: "ADR-0005",
        status: "OK",
        context: "owner",
        message: `owner.name "${marketplace.owner.name}" is a valid GitHub slug`,
      });
    }

    // owner forbidden fields
    if (marketplace.owner?.email !== undefined) {
      findings.push({
        rule: "ADR-0005",
        status: "FAIL",
        context: "owner",
        message: "`owner.email` MUST NOT be present (contact via repo issues).",
      });
    }
    if (marketplace.owner?.url !== undefined) {
      findings.push({
        rule: "ADR-0005",
        status: "FAIL",
        context: "owner",
        message:
          "`owner.url` MUST NOT be present " +
          "(derivable from owner.name as https://github.com/<owner.name>).",
      });
    }

    // each plugin's author
    marketplace.plugins.forEach((plugin, i) => {
      const ctx = pluginContext(plugin, i);
      const author = plugin.author;

      if (!author || typeof author.name !== "string") {
        findings.push({
          rule: "ADR-0005",
          status: "FAIL",
          context: ctx,
          message: "`author.name` is required.",
        });
        return;
      }

      if (!isValidGitHubSlug(author.name)) {
        findings.push({
          rule: "ADR-0005",
          status: "FAIL",
          context: ctx,
          message: `\`author.name\` "${author.name}" is not a valid GitHub slug.`,
        });
        return;
      }

      if (author.email !== undefined) {
        findings.push({
          rule: "ADR-0005",
          status: "FAIL",
          context: ctx,
          message: "`author.email` MUST NOT be present (contact via repo issues).",
        });
        return;
      }

      findings.push({
        rule: "ADR-0005",
        status: "OK",
        context: ctx,
        message: `author.name "${author.name}" is a valid GitHub slug`,
      });
    });

    return findings;
  },
};

// --- Rule: ADR-0006 (semver-tag refs) ---

const SEMVER_TAG_RE = /^v?\d+\.\d+\.\d+$/;

export const adr0006: Rule = {
  id: "ADR-0006",
  title: "Plugin source.ref must be a semver tag (v?X.Y.Z)",
  check(marketplace) {
    const findings: Finding[] = [];
    marketplace.plugins.forEach((plugin, i) => {
      const ctx = pluginContext(plugin, i);

      // Rule scope: github sources only. Non-github sources are skipped.
      if (plugin.source?.source !== "github") {
        findings.push({
          rule: "ADR-0006",
          status: "SKIP",
          context: ctx,
          message: `source.source="${plugin.source?.source ?? "(missing)"}" — rule applies to github sources only`,
        });
        return;
      }

      const ref = plugin.source.ref;
      if (typeof ref !== "string" || ref.length === 0) {
        findings.push({
          rule: "ADR-0006",
          status: "FAIL",
          context: ctx,
          message: "`source.ref` is required and must be a non-empty string.",
        });
        return;
      }

      if (!SEMVER_TAG_RE.test(ref)) {
        findings.push({
          rule: "ADR-0006",
          status: "FAIL",
          context: ctx,
          message:
            `\`source.ref\` "${ref}" is not a semver tag. ` +
            "Expected `v?\\d+\\.\\d+\\.\\d+`; branches, SHAs, non-semver tags, " +
            "and pre-release tags are forbidden.",
        });
        return;
      }

      findings.push({
        rule: "ADR-0006",
        status: "OK",
        context: ctx,
        message: `source.ref "${ref}" is a valid semver tag`,
      });
    });
    return findings;
  },
};

// --- Rule: ADR-0007 (closed category allow-list) ---

// The canonical list with rationale lives in docs/adr/0007-category-allow-list.md.
// Amendments must update both this set and the ADR in the same PR.
const ALLOWED_CATEGORIES: ReadonlySet<string> = new Set([
  "core",
  "workflow",
  "infrastructure",
  "language",
  "integration",
  "domain",
  "productivity",
  "security",
  "observability",
]);

export const adr0007: Rule = {
  id: "ADR-0007",
  title: "Plugin category must be in the closed allow-list",
  check(marketplace) {
    const findings: Finding[] = [];
    marketplace.plugins.forEach((plugin, i) => {
      const ctx = pluginContext(plugin, i);

      if (typeof plugin.category !== "string" || plugin.category.length === 0) {
        findings.push({
          rule: "ADR-0007",
          status: "FAIL",
          context: ctx,
          message: "`category` is required and must be a non-empty string.",
        });
        return;
      }

      if (!ALLOWED_CATEGORIES.has(plugin.category)) {
        const allowed = Array.from(ALLOWED_CATEGORIES).sort().join(", ");
        findings.push({
          rule: "ADR-0007",
          status: "FAIL",
          context: ctx,
          message:
            `category "${plugin.category}" is not in the allow-list. ` +
            `Allowed: ${allowed}. Adding a new category requires an ADR amendment.`,
        });
        return;
      }

      findings.push({
        rule: "ADR-0007",
        status: "OK",
        context: ctx,
        message: `category "${plugin.category}" is in the allow-list`,
      });
    });
    return findings;
  },
};

// --- Registry ---

export const RULES: readonly Rule[] = [adr0003, adr0005, adr0006, adr0007] as const;

// --- Schema validation (ADR-0008) ---

interface SchemaResult {
  valid: boolean;
  errors: ErrorObject[];
}

function loadSchema(scriptDir: string): unknown {
  const root = resolve(scriptDir, "..");
  const schemaPath = resolve(root, "schemas", "marketplace.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf-8"));
}

export function validateSchema(marketplace: unknown, schema: unknown): SchemaResult {
  // `strict: false` because we use `description` fields for documentation that
  // strict mode would warn on.
  // The `as unknown as new ...` cast handles ajv's default-export interop quirk
  // under Node16/ESM, where TS sees the namespace rather than the class itself.
  const AjvCtor = Ajv as unknown as new (opts?: object) => {
    compile: (schema: object) => ((data: unknown) => boolean) & { errors?: ErrorObject[] | null };
  };
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  const validate = ajv.compile(schema as object);
  const ok = validate(marketplace);
  return { valid: !!ok, errors: validate.errors ?? [] };
}

function formatSchemaError(err: ErrorObject): string {
  const path = err.instancePath || "(root)";
  const detail = err.params ? ` ${JSON.stringify(err.params)}` : "";
  return `[schema] ✗ ${path}: ${err.message ?? "(no message)"}${detail}`;
}

// --- Reporter ---

function formatFinding(f: Finding): string {
  const symbol = f.status === "OK" ? "✓" : f.status === "FAIL" ? "✗" : "-";
  return `[${f.rule}] ${symbol} ${f.context}: ${f.message}`;
}

export function report(findings: readonly Finding[]): number {
  let failCount = 0;
  let okCount = 0;
  let skipCount = 0;

  for (const f of findings) {
    const line = formatFinding(f);
    if (f.status === "FAIL") {
      failCount += 1;
      console.error(line);
    } else if (f.status === "SKIP") {
      skipCount += 1;
      console.log(line);
    } else {
      okCount += 1;
      console.log(line);
    }
  }

  console.log("");
  console.log(
    `Validator summary: ${okCount} passing, ${failCount} failing, ${skipCount} skipped.`,
  );
  if (failCount > 0) {
    console.error(
      "Failed checks cite ADR numbers. See docs/adr/<NNNN>-*.md for the rationale " +
        "and the canonical rule wording.",
    );
  }
  return failCount;
}

// --- Main ---

export function runRules(marketplace: Marketplace): Finding[] {
  const findings: Finding[] = [];
  for (const rule of RULES) {
    findings.push(...rule.check(marketplace));
  }
  return findings;
}

function main(): void {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const root = resolve(__dirname, "..");
  const manifestPath = resolve(root, ".claude-plugin", "marketplace.json");

  let raw: string;
  try {
    raw = readFileSync(manifestPath, "utf-8");
  } catch (err) {
    console.error(`[ERROR] could not read ${manifestPath}: ${(err as Error).message}`);
    process.exit(2);
  }

  let marketplace: Marketplace;
  try {
    marketplace = JSON.parse(raw) as Marketplace;
  } catch (err) {
    console.error(`[ERROR] ${manifestPath} is not valid JSON: ${(err as Error).message}`);
    process.exit(2);
  }

  // Structural validation first (ADR-0008). If the manifest doesn't conform
  // to the schema, semantic rules can't run safely — report and exit.
  let schema: unknown;
  try {
    schema = loadSchema(__dirname);
  } catch (err) {
    console.error(`[ERROR] could not load marketplace schema: ${(err as Error).message}`);
    process.exit(2);
  }
  const schemaResult = validateSchema(marketplace, schema);
  if (!schemaResult.valid) {
    console.error("Schema validation FAILED (per ADR-0008):");
    for (const err of schemaResult.errors) {
      console.error("  " + formatSchemaError(err));
    }
    console.error("");
    console.error("Fix structural issues before semantic rules can run.");
    process.exit(1);
  }
  console.log("[schema] ✓ marketplace.json conforms to schemas/marketplace.schema.json");

  const findings = runRules(marketplace);
  const failures = report(findings);
  process.exit(failures > 0 ? 1 : 0);
}

const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) {
  main();
}
