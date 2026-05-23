// SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors
// SPDX-License-Identifier: MPL-2.0

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  formatJson,
  formatMarkdown,
  levelFor,
  runMaturity,
  type MaturityLevel,
} from "./maturity.js";
import {
  checkActionsSHAPinned,
  checkGitignoreSecrets,
  checkLicense,
  checkReadmeHasUsage,
  checkTaskRunner,
  checkWorkflowPermissions,
  type CheckContext,
} from "./maturity-checks.js";

function newTmp(): string {
  return mkdtempSync(join(tmpdir(), "maturity-test-"));
}

function ctx(root: string): CheckContext {
  return { root };
}

describe("levelFor", () => {
  const cases: Array<[number, MaturityLevel]> = [
    [0, 1],
    [0.49, 1],
    [0.5, 2],
    [0.69, 2],
    [0.7, 3],
    [0.89, 3],
    [0.9, 4],
    [1.0, 4],
  ];
  for (const [score, expected] of cases) {
    it(`maps ${score} → Level ${expected}`, () => {
      assert.equal(levelFor(score), expected);
    });
  }
});

describe("check: LICENSE", () => {
  it("present when LICENSE exists", () => {
    const root = newTmp();
    writeFileSync(join(root, "LICENSE"), "MPL-2.0 text\n");
    assert.equal(checkLicense(ctx(root)).status, "present");
    rmSync(root, { recursive: true, force: true });
  });

  it("missing when no LICENSE", () => {
    const root = newTmp();
    assert.equal(checkLicense(ctx(root)).status, "missing");
    rmSync(root, { recursive: true, force: true });
  });

  it("present when LICENSE.md instead", () => {
    const root = newTmp();
    writeFileSync(join(root, "LICENSE.md"), "MIT\n");
    assert.equal(checkLicense(ctx(root)).status, "present");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("check: .gitignore secrets", () => {
  it("missing when no .gitignore", () => {
    const root = newTmp();
    assert.equal(checkGitignoreSecrets(ctx(root)).status, "missing");
    rmSync(root, { recursive: true, force: true });
  });

  it("partial when only some patterns covered", () => {
    const root = newTmp();
    writeFileSync(join(root, ".gitignore"), ".env\n");
    assert.equal(checkGitignoreSecrets(ctx(root)).status, "partial");
    rmSync(root, { recursive: true, force: true });
  });

  it("present when many patterns covered", () => {
    const root = newTmp();
    writeFileSync(
      join(root, ".gitignore"),
      ".env\n*.pem\n*.key\ncredentials*\nid_rsa\nsecrets.yaml\n",
    );
    assert.equal(checkGitignoreSecrets(ctx(root)).status, "present");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("check: workflow permissions", () => {
  it("n/a when no workflows", () => {
    const root = newTmp();
    assert.equal(checkWorkflowPermissions(ctx(root)).status, "n/a");
    rmSync(root, { recursive: true, force: true });
  });

  it("present when all workflows declare permissions", () => {
    const root = newTmp();
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(
      join(root, ".github", "workflows", "ci.yml"),
      "name: CI\non: push\npermissions:\n  contents: read\njobs: {}\n",
    );
    assert.equal(checkWorkflowPermissions(ctx(root)).status, "present");
    rmSync(root, { recursive: true, force: true });
  });

  it("partial when some workflows declare permissions", () => {
    const root = newTmp();
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(
      join(root, ".github", "workflows", "a.yml"),
      "name: A\non: push\npermissions:\n  contents: read\njobs: {}\n",
    );
    writeFileSync(
      join(root, ".github", "workflows", "b.yml"),
      "name: B\non: push\njobs: {}\n",
    );
    assert.equal(checkWorkflowPermissions(ctx(root)).status, "partial");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("check: actions SHA-pinned", () => {
  it("present when all uses are SHA-pinned", () => {
    const root = newTmp();
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(
      join(root, ".github", "workflows", "ci.yml"),
      "name: CI\non: push\njobs:\n  build:\n    steps:\n      - uses: actions/checkout@" +
        "0".repeat(40) +
        " # v4\n",
    );
    assert.equal(checkActionsSHAPinned(ctx(root)).status, "present");
    rmSync(root, { recursive: true, force: true });
  });

  it("missing when all uses are tag-pinned", () => {
    const root = newTmp();
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(
      join(root, ".github", "workflows", "ci.yml"),
      "name: CI\non: push\njobs:\n  build:\n    steps:\n      - uses: actions/checkout@v4\n",
    );
    assert.equal(checkActionsSHAPinned(ctx(root)).status, "missing");
    rmSync(root, { recursive: true, force: true });
  });

  it("partial when mix of SHA + tag", () => {
    const root = newTmp();
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(
      join(root, ".github", "workflows", "ci.yml"),
      "name: CI\non: push\njobs:\n  build:\n    steps:\n      - uses: actions/checkout@" +
        "0".repeat(40) +
        "\n      - uses: actions/setup-node@v4\n",
    );
    assert.equal(checkActionsSHAPinned(ctx(root)).status, "partial");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("check: task runner", () => {
  it("present when Makefile exists", () => {
    const root = newTmp();
    writeFileSync(join(root, "Makefile"), "default:\n\techo hi\n");
    assert.equal(checkTaskRunner(ctx(root)).status, "present");
    rmSync(root, { recursive: true, force: true });
  });

  it("missing when no task runner", () => {
    const root = newTmp();
    assert.equal(checkTaskRunner(ctx(root)).status, "missing");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("check: README has usage", () => {
  it("present when README contains a fenced code block", () => {
    const root = newTmp();
    writeFileSync(
      join(root, "README.md"),
      "# Foo\n\n```bash\nfoo --help\n```\n",
    );
    assert.equal(checkReadmeHasUsage(ctx(root)).status, "present");
    rmSync(root, { recursive: true, force: true });
  });

  it("partial when README has no fenced code", () => {
    const root = newTmp();
    writeFileSync(join(root, "README.md"), "# Foo\n\nJust prose.\n");
    assert.equal(checkReadmeHasUsage(ctx(root)).status, "partial");
    rmSync(root, { recursive: true, force: true });
  });

  it("missing when no README", () => {
    const root = newTmp();
    assert.equal(checkReadmeHasUsage(ctx(root)).status, "missing");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("runMaturity integration", () => {
  it("produces 4 dimensions with the expected shape", () => {
    const root = newTmp();
    const report = runMaturity(root);
    assert.ok(report.dimensions.compliance);
    assert.ok(report.dimensions.security);
    assert.ok(report.dimensions.devops);
    assert.ok(report.dimensions.quality);
    assert.ok(typeof report.overall.score === "number");
    assert.ok([1, 2, 3, 4].includes(report.overall.level));
    rmSync(root, { recursive: true, force: true });
  });

  it("an empty repo scores Level 1", () => {
    const root = newTmp();
    const report = runMaturity(root);
    assert.equal(report.overall.level, 1);
    rmSync(root, { recursive: true, force: true });
  });

  it("a well-tooled repo scores Level 4", () => {
    // Run against THIS repo — guards regression of the marketplace itself.
    const report = runMaturity(".");
    assert.ok(
      report.overall.level >= 3,
      `expected marketplace itself to be Level 3+, got ${report.overall.level} (score ${report.overall.score})`,
    );
  });
});

describe("output formatters", () => {
  it("JSON output is valid JSON", () => {
    const root = newTmp();
    const report = runMaturity(root);
    const out = formatJson(report);
    const parsed = JSON.parse(out);
    assert.equal(parsed.path, report.path);
    rmSync(root, { recursive: true, force: true });
  });

  it("Markdown output contains overall + dimension headings", () => {
    const root = newTmp();
    const report = runMaturity(root);
    const out = formatMarkdown(report);
    assert.match(out, /^# Plugin Maturity Report/m);
    assert.match(out, /## Overall:/);
    assert.match(out, /## Compliance/);
    assert.match(out, /## Security/);
    assert.match(out, /## Devops/);
    assert.match(out, /## Quality/);
    rmSync(root, { recursive: true, force: true });
  });
});
