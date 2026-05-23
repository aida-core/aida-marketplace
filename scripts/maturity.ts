// SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors
// SPDX-License-Identifier: MPL-2.0

// Plugin Maturity Model CLI (per ADR-0014).
//
// Scans a local repo and produces per-dimension scores + an overall
// maturity level. Each check returns "present" / "partial" / "missing"
// or "n/a". The score is (present + 0.5*partial) / (present + partial
// + missing). "n/a" entries are excluded from the denominator.
//
// Levels:
//   < 0.5  → Level 1 (Foundation)
//   < 0.7  → Level 2 (Governed)
//   < 0.9  → Level 3 (Hardened)
//   ≥ 0.9  → Level 4 (Exemplary)
//
// Usage:
//   tsx scripts/maturity.ts [path] [--format json|markdown]
//                                  [--fail-under <level>]
//
// `path` defaults to the current working directory.

import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  DIMENSIONS,
  type CheckContext,
  type CheckResult,
  type Dimension,
} from "./maturity-checks.js";

// --- Types ---

export type MaturityLevel = 1 | 2 | 3 | 4;

export interface DimensionReport {
  dimension: Dimension;
  /** Number of checks where status === "present". */
  present: number;
  partial: number;
  missing: number;
  na: number;
  /** Score in [0, 1]; excludes n/a from the denominator. */
  score: number;
  level: MaturityLevel;
  checks: CheckResult[];
}

export interface MaturityReport {
  path: string;
  timestamp: string;
  dimensions: Record<Dimension, DimensionReport>;
  overall: {
    score: number;
    level: MaturityLevel;
  };
}

// --- Scoring ---

export function levelFor(score: number): MaturityLevel {
  if (score < 0.5) return 1;
  if (score < 0.7) return 2;
  if (score < 0.9) return 3;
  return 4;
}

function summarize(checks: CheckResult[]): { score: number; counts: { present: number; partial: number; missing: number; na: number } } {
  let present = 0;
  let partial = 0;
  let missing = 0;
  let na = 0;
  for (const c of checks) {
    if (c.status === "present") present += 1;
    else if (c.status === "partial") partial += 1;
    else if (c.status === "missing") missing += 1;
    else na += 1;
  }
  const considered = present + partial + missing;
  const score = considered === 0 ? 0 : (present + 0.5 * partial) / considered;
  return { score, counts: { present, partial, missing, na } };
}

export function runMaturity(rootPath: string): MaturityReport {
  const ctx: CheckContext = { root: resolve(rootPath) };
  const dimensions: Record<Dimension, DimensionReport> = {} as Record<Dimension, DimensionReport>;
  const allChecks: CheckResult[] = [];

  for (const dim of Object.keys(DIMENSIONS) as Dimension[]) {
    const checks = DIMENSIONS[dim].map((fn) => fn(ctx));
    const { score, counts } = summarize(checks);
    dimensions[dim] = {
      dimension: dim,
      present: counts.present,
      partial: counts.partial,
      missing: counts.missing,
      na: counts.na,
      score,
      level: levelFor(score),
      checks,
    };
    allChecks.push(...checks);
  }

  const overall = summarize(allChecks);
  return {
    path: ctx.root,
    timestamp: new Date().toISOString(),
    dimensions,
    overall: { score: overall.score, level: levelFor(overall.score) },
  };
}

// --- Output formats ---

const LEVEL_NAMES: Record<MaturityLevel, string> = {
  1: "Level 1 — Foundation",
  2: "Level 2 — Governed",
  3: "Level 3 — Hardened",
  4: "Level 4 — Exemplary",
};

const STATUS_SYMBOL: Record<CheckResult["status"], string> = {
  present: "✓",
  partial: "~",
  missing: "✗",
  "n/a": "-",
};

export function formatJson(report: MaturityReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatMarkdown(report: MaturityReport): string {
  const pct = (n: number): string => `${(n * 100).toFixed(0)}%`;
  const lines: string[] = [];

  // SPDX header keeps generated reports REUSE-compliant when they're committed
  // (e.g., docs/maturity/self-report.md). String fragments concatenated below
  // so REUSE doesn't try to parse THIS source file's template literals as
  // an inline SPDX header pointing at the maturity-engine's own license.
  const spdx = "SPDX";
  lines.push(`<!-- ${spdx}-FileCopyrightText: 2026 The AIDA Marketplace Authors -->`);
  lines.push(`<!-- ${spdx}-License-Identifier: MPL-2.0 -->`);
  lines.push("");
  lines.push(`# Plugin Maturity Report`);
  lines.push("");
  lines.push(`- **Path:** \`${report.path}\``);
  lines.push(`- **Scanned:** ${report.timestamp}`);
  lines.push("");
  lines.push(
    `## Overall: ${LEVEL_NAMES[report.overall.level]} (${pct(report.overall.score)})`,
  );
  lines.push("");

  for (const dim of Object.keys(report.dimensions) as Dimension[]) {
    const d = report.dimensions[dim];
    lines.push(
      `## ${capitalize(dim)} — ${LEVEL_NAMES[d.level]} (${pct(d.score)})`,
    );
    lines.push("");
    lines.push(
      `Counts: ${d.present} present, ${d.partial} partial, ${d.missing} missing, ${d.na} n/a`,
    );
    lines.push("");
    lines.push(`| | Check | Evidence |`);
    lines.push(`| --- | --- | --- |`);
    for (const c of d.checks) {
      lines.push(
        `| ${STATUS_SYMBOL[c.status]} | ${c.title} | ${c.evidence.replace(/\|/g, "\\|")} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- CLI ---

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      format: { type: "string", default: "json" },
      "fail-under": { type: "string", default: "" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    process.stdout.write(
      "usage: tsx scripts/maturity.ts [path] [--format json|markdown] [--fail-under <level>]\n",
    );
    return 0;
  }

  const rootArg = positionals[0] ?? ".";
  const format = values.format === "markdown" ? "markdown" : "json";
  const failUnderRaw = (values["fail-under"] ?? "").toString();

  let report: MaturityReport;
  try {
    report = runMaturity(rootArg);
  } catch (err) {
    process.stderr.write(`[ERROR] ${(err as Error).message}\n`);
    return 2;
  }

  const out = format === "markdown" ? formatMarkdown(report) : formatJson(report);
  // formatMarkdown returns content with a single trailing newline. Avoid
  // appending a second.
  process.stdout.write(format === "markdown" ? out : out + "\n");

  if (failUnderRaw) {
    const failUnder = Number(failUnderRaw);
    if (!Number.isInteger(failUnder) || failUnder < 1 || failUnder > 4) {
      process.stderr.write(`[ERROR] --fail-under must be 1..4; got "${failUnderRaw}"\n`);
      return 2;
    }
    if (report.overall.level < failUnder) {
      process.stderr.write(
        `Overall maturity ${report.overall.level} is below --fail-under=${failUnder}.\n`,
      );
      return 1;
    }
  }

  return 0;
}

// Run if invoked directly
import { fileURLToPath } from "node:url";
const invoked =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) {
  process.exit(main(process.argv.slice(2)));
}
