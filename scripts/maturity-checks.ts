// SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors
// SPDX-License-Identifier: MPL-2.0

// Pure check functions for the Plugin Maturity Model (ADR-0014).
//
// Each check takes a CheckContext (the repo root path) and returns a
// CheckResult. Checks are pure functions of the filesystem state — no
// network, no parsing beyond simple regex. Each check is a single tight
// function so it can be unit-tested in isolation against tmpdir
// fixtures.
//
// Adding a check:
//   1. Write a function `check<Whatever>(ctx: CheckContext): CheckResult`.
//   2. Add it to the appropriate dimension array in `DIMENSIONS` below.
//   3. Add a test in `maturity.test.ts`.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type CheckStatus = "present" | "missing" | "partial" | "n/a";

export interface CheckResult {
  /** Stable identifier, e.g. "compliance.license". */
  id: string;
  /** Human-readable title shown in markdown output. */
  title: string;
  status: CheckStatus;
  /** One-line factual evidence (file path, count, snippet match). */
  evidence: string;
}

export interface CheckContext {
  /** Absolute path to the repo being scanned. */
  root: string;
}

// --- Helpers ---

function fileExists(root: string, name: string): boolean {
  try {
    statSync(join(root, name));
    return true;
  } catch {
    return false;
  }
}

function readIfExists(root: string, name: string): string | null {
  try {
    return readFileSync(join(root, name), "utf-8");
  } catch {
    return null;
  }
}

function firstExisting(root: string, names: readonly string[]): string | null {
  for (const n of names) {
    if (fileExists(root, n)) return n;
  }
  return null;
}

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".venv",
  "venv",
  "__pycache__",
  "dist",
  "build",
  ".lycheecache",
  ".pytest_cache",
  ".ruff_cache",
  ".mypy_cache",
]);

function findFiles(root: string, pattern: RegExp): string[] {
  try {
    const entries = readdirSync(root, { recursive: true }) as string[];
    return entries.filter((rel) => {
      if (!pattern.test(rel)) return false;
      const parts = rel.split(/[\\/]/);
      return !parts.some((p) => IGNORE_DIRS.has(p));
    });
  } catch {
    return [];
  }
}

function readWorkflowYamlContents(root: string): string[] {
  const wfDir = join(root, ".github", "workflows");
  try {
    const names = readdirSync(wfDir);
    return names
      .filter((n) => n.endsWith(".yml") || n.endsWith(".yaml"))
      .map((n) => readFileSync(join(wfDir, n), "utf-8"));
  } catch {
    return [];
  }
}

// --- COMPLIANCE ---

export function checkLicense(ctx: CheckContext): CheckResult {
  const name = firstExisting(ctx.root, ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"]);
  return {
    id: "compliance.license",
    title: "LICENSE file at the repo root",
    status: name ? "present" : "missing",
    evidence: name ? `found ${name}` : "no LICENSE/COPYING file at repo root",
  };
}

export function checkSecurityMd(ctx: CheckContext): CheckResult {
  const name = firstExisting(ctx.root, ["SECURITY.md", ".github/SECURITY.md"]);
  return {
    id: "compliance.security_md",
    title: "SECURITY.md",
    status: name ? "present" : "missing",
    evidence: name
      ? `found ${name}`
      : "no SECURITY.md (org-level fallback at <org>/.github/SECURITY.md is not detected here)",
  };
}

export function checkContributingMd(ctx: CheckContext): CheckResult {
  const name = firstExisting(ctx.root, ["CONTRIBUTING.md", ".github/CONTRIBUTING.md"]);
  return {
    id: "compliance.contributing_md",
    title: "CONTRIBUTING.md",
    status: name ? "present" : "missing",
    evidence: name ? `found ${name}` : "no CONTRIBUTING.md",
  };
}

export function checkCodeOfConductMd(ctx: CheckContext): CheckResult {
  const name = firstExisting(ctx.root, ["CODE_OF_CONDUCT.md", ".github/CODE_OF_CONDUCT.md"]);
  return {
    id: "compliance.code_of_conduct_md",
    title: "CODE_OF_CONDUCT.md",
    status: name ? "present" : "missing",
    evidence: name ? `found ${name}` : "no CODE_OF_CONDUCT.md",
  };
}

export function checkChangelogMd(ctx: CheckContext): CheckResult {
  const name = firstExisting(ctx.root, ["CHANGELOG.md", "CHANGELOG"]);
  if (!name) {
    return {
      id: "compliance.changelog_md",
      title: "CHANGELOG.md (Keep a Changelog format)",
      status: "missing",
      evidence: "no CHANGELOG.md or CHANGELOG file",
    };
  }
  const content = readIfExists(ctx.root, name) ?? "";
  const hasKac = /keep\s*a\s*changelog/i.test(content);
  return {
    id: "compliance.changelog_md",
    title: "CHANGELOG.md (Keep a Changelog format)",
    status: hasKac ? "present" : "partial",
    evidence: hasKac
      ? `found ${name} with Keep a Changelog reference`
      : `found ${name} but no Keep a Changelog marker — may not follow the format`,
  };
}

export function checkAuthorshipMetadata(ctx: CheckContext): CheckResult {
  if (fileExists(ctx.root, "AUTHORS")) {
    return {
      id: "compliance.authorship",
      title: "Authorship metadata (AUTHORS or package.json#author)",
      status: "present",
      evidence: "found AUTHORS file",
    };
  }
  const pkg = readIfExists(ctx.root, "package.json");
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg) as { author?: unknown };
      if (parsed.author && typeof parsed.author === "string" && parsed.author.length > 0) {
        return {
          id: "compliance.authorship",
          title: "Authorship metadata (AUTHORS or package.json#author)",
          status: "present",
          evidence: "package.json#author set",
        };
      }
      if (parsed.author && typeof parsed.author === "object") {
        return {
          id: "compliance.authorship",
          title: "Authorship metadata (AUTHORS or package.json#author)",
          status: "present",
          evidence: "package.json#author object set",
        };
      }
    } catch {
      // fall through
    }
  }
  return {
    id: "compliance.authorship",
    title: "Authorship metadata (AUTHORS or package.json#author)",
    status: "missing",
    evidence: "no AUTHORS file and no package.json#author",
  };
}

// --- SECURITY ---

export function checkGitignoreSecrets(ctx: CheckContext): CheckResult {
  const content = readIfExists(ctx.root, ".gitignore");
  if (content === null) {
    return {
      id: "security.gitignore_secrets",
      title: ".gitignore covers secret patterns",
      status: "missing",
      evidence: "no .gitignore",
    };
  }
  const patterns = [/\.env\b/, /\*\.pem/, /\*\.key/, /credentials/, /secrets?\.ya?ml/, /id_(rsa|ed25519|ecdsa|dsa)/];
  const matches = patterns.filter((p) => p.test(content)).length;
  if (matches >= 4) {
    return {
      id: "security.gitignore_secrets",
      title: ".gitignore covers secret patterns",
      status: "present",
      evidence: `${matches}/${patterns.length} secret patterns ignored`,
    };
  }
  if (matches >= 1) {
    return {
      id: "security.gitignore_secrets",
      title: ".gitignore covers secret patterns",
      status: "partial",
      evidence: `only ${matches}/${patterns.length} secret patterns ignored — add more (e.g. *.pem, credentials*, id_*)`,
    };
  }
  return {
    id: "security.gitignore_secrets",
    title: ".gitignore covers secret patterns",
    status: "missing",
    evidence: ".gitignore exists but covers no secret patterns",
  };
}

export function checkDepUpdater(ctx: CheckContext): CheckResult {
  const renovate = firstExisting(ctx.root, ["renovate.json", ".github/renovate.json"]);
  if (renovate) {
    return {
      id: "security.dep_updater",
      title: "Dependency updater configured (Renovate or Dependabot)",
      status: "present",
      evidence: `found ${renovate}`,
    };
  }
  if (fileExists(ctx.root, ".github/dependabot.yml")) {
    return {
      id: "security.dep_updater",
      title: "Dependency updater configured (Renovate or Dependabot)",
      status: "present",
      evidence: "found .github/dependabot.yml",
    };
  }
  return {
    id: "security.dep_updater",
    title: "Dependency updater configured (Renovate or Dependabot)",
    status: "missing",
    evidence: "no renovate.json or .github/dependabot.yml",
  };
}

export function checkAuditInCI(ctx: CheckContext): CheckResult {
  const workflows = readWorkflowYamlContents(ctx.root);
  const auditRe = /\b(npm audit|pip-audit|cargo audit|yarn audit|pnpm audit)\b/;
  for (const yaml of workflows) {
    if (auditRe.test(yaml)) {
      return {
        id: "security.audit_in_ci",
        title: "Dependency audit tool in CI",
        status: "present",
        evidence: "an audit command is referenced in a CI workflow",
      };
    }
  }
  return {
    id: "security.audit_in_ci",
    title: "Dependency audit tool in CI",
    status: "missing",
    evidence: "no audit command found in any workflow",
  };
}

export function checkReuseCompliance(ctx: CheckContext): CheckResult {
  if (fileExists(ctx.root, "REUSE.toml") || fileExists(ctx.root, ".reuse/dep5")) {
    return {
      id: "security.reuse_compliance",
      title: "REUSE / SPDX compliance config",
      status: "present",
      evidence: fileExists(ctx.root, "REUSE.toml") ? "REUSE.toml at root" : ".reuse/dep5 present",
    };
  }
  return {
    id: "security.reuse_compliance",
    title: "REUSE / SPDX compliance config",
    status: "missing",
    evidence: "no REUSE.toml or .reuse/dep5",
  };
}

export function checkNoLeakedSecretFiles(ctx: CheckContext): CheckResult {
  const dangerous = ["id_rsa", "id_ed25519", "credentials", ".env"];
  const found = dangerous.filter((n) => fileExists(ctx.root, n));
  if (found.length === 0) {
    return {
      id: "security.no_leaked_secrets",
      title: "No obvious secret files at repo root",
      status: "present",
      evidence: "no id_rsa / id_ed25519 / credentials / .env at repo root",
    };
  }
  return {
    id: "security.no_leaked_secrets",
    title: "No obvious secret files at repo root",
    status: "missing",
    evidence: `dangerous files at root: ${found.join(", ")}`,
  };
}

export function checkSecurityContact(ctx: CheckContext): CheckResult {
  const sec =
    readIfExists(ctx.root, "SECURITY.md") ?? readIfExists(ctx.root, ".github/SECURITY.md");
  if (sec === null) {
    return {
      id: "security.security_contact",
      title: "SECURITY.md names a contact (mailto: or security@)",
      status: "n/a",
      evidence: "no SECURITY.md to check",
    };
  }
  if (/mailto:|security@|github\.com.*security\/advisories/i.test(sec)) {
    return {
      id: "security.security_contact",
      title: "SECURITY.md names a contact (mailto: or security@)",
      status: "present",
      evidence: "contact channel referenced",
    };
  }
  return {
    id: "security.security_contact",
    title: "SECURITY.md names a contact (mailto: or security@)",
    status: "partial",
    evidence: "SECURITY.md exists but no obvious contact channel detected",
  };
}

// --- DEVOPS ---

export function checkCIWorkflowExists(ctx: CheckContext): CheckResult {
  const workflows = readWorkflowYamlContents(ctx.root);
  if (workflows.length === 0) {
    return {
      id: "devops.ci_workflow",
      title: "CI workflow(s) present",
      status: "missing",
      evidence: "no workflow files in .github/workflows/",
    };
  }
  return {
    id: "devops.ci_workflow",
    title: "CI workflow(s) present",
    status: "present",
    evidence: `${workflows.length} workflow file(s) in .github/workflows/`,
  };
}

export function checkWorkflowPermissions(ctx: CheckContext): CheckResult {
  const workflows = readWorkflowYamlContents(ctx.root);
  if (workflows.length === 0) {
    return {
      id: "devops.workflow_permissions",
      title: "Workflows declare permissions:",
      status: "n/a",
      evidence: "no workflows to check",
    };
  }
  // A workflow declares permissions: if it has a top-level `permissions:` block
  // (line starting at column 0, not within a job).
  const matchCount = workflows.filter((y) => /^permissions:/m.test(y)).length;
  if (matchCount === workflows.length) {
    return {
      id: "devops.workflow_permissions",
      title: "Workflows declare permissions:",
      status: "present",
      evidence: `all ${workflows.length} workflows declare top-level permissions`,
    };
  }
  if (matchCount > 0) {
    return {
      id: "devops.workflow_permissions",
      title: "Workflows declare permissions:",
      status: "partial",
      evidence: `${matchCount}/${workflows.length} workflows declare top-level permissions`,
    };
  }
  return {
    id: "devops.workflow_permissions",
    title: "Workflows declare permissions:",
    status: "missing",
    evidence: "no workflow declares a top-level permissions block",
  };
}

export function checkActionsSHAPinned(ctx: CheckContext): CheckResult {
  const workflows = readWorkflowYamlContents(ctx.root);
  if (workflows.length === 0) {
    return {
      id: "devops.actions_sha_pinned",
      title: "Third-party Actions SHA-pinned",
      status: "n/a",
      evidence: "no workflows to check",
    };
  }
  const usesRe = /uses:\s*([^\s@]+)@([^\s#]+)/g;
  let total = 0;
  let pinned = 0;
  for (const yaml of workflows) {
    let m: RegExpExecArray | null;
    while ((m = usesRe.exec(yaml)) !== null) {
      total += 1;
      // SHA = 40 hex chars
      if (/^[a-f0-9]{40}$/.test(m[2])) {
        pinned += 1;
      }
    }
  }
  if (total === 0) {
    return {
      id: "devops.actions_sha_pinned",
      title: "Third-party Actions SHA-pinned",
      status: "n/a",
      evidence: "no `uses:` action references found",
    };
  }
  const ratio = pinned / total;
  if (ratio === 1) {
    return {
      id: "devops.actions_sha_pinned",
      title: "Third-party Actions SHA-pinned",
      status: "present",
      evidence: `${pinned}/${total} action references SHA-pinned`,
    };
  }
  if (ratio >= 0.5) {
    return {
      id: "devops.actions_sha_pinned",
      title: "Third-party Actions SHA-pinned",
      status: "partial",
      evidence: `${pinned}/${total} action references SHA-pinned (mix of tag + SHA)`,
    };
  }
  return {
    id: "devops.actions_sha_pinned",
    title: "Third-party Actions SHA-pinned",
    status: "missing",
    evidence: `only ${pinned}/${total} action references SHA-pinned`,
  };
}

export function checkCodeowners(ctx: CheckContext): CheckResult {
  const name = firstExisting(ctx.root, [
    "CODEOWNERS",
    ".github/CODEOWNERS",
    "docs/CODEOWNERS",
  ]);
  return {
    id: "devops.codeowners",
    title: "CODEOWNERS file",
    status: name ? "present" : "missing",
    evidence: name ? `found ${name}` : "no CODEOWNERS file in repo root, .github/, or docs/",
  };
}

export function checkIssueOrPRTemplates(ctx: CheckContext): CheckResult {
  // Either ISSUE_TEMPLATE/ directory OR a single PULL_REQUEST_TEMPLATE.md.
  let hasIssue = false;
  try {
    const entries = readdirSync(join(ctx.root, ".github", "ISSUE_TEMPLATE"));
    hasIssue = entries.length > 0;
  } catch {
    // dir doesn't exist
  }
  const hasPR =
    fileExists(ctx.root, ".github/PULL_REQUEST_TEMPLATE.md") ||
    fileExists(ctx.root, ".github/pull_request_template.md") ||
    fileExists(ctx.root, "PULL_REQUEST_TEMPLATE.md") ||
    fileExists(ctx.root, "docs/PULL_REQUEST_TEMPLATE.md");
  if (hasIssue && hasPR) {
    return {
      id: "devops.templates",
      title: "Issue and/or PR templates",
      status: "present",
      evidence: "ISSUE_TEMPLATE/ and PULL_REQUEST_TEMPLATE present",
    };
  }
  if (hasIssue || hasPR) {
    return {
      id: "devops.templates",
      title: "Issue and/or PR templates",
      status: "partial",
      evidence: hasIssue
        ? "ISSUE_TEMPLATE/ present; no PULL_REQUEST_TEMPLATE"
        : "PULL_REQUEST_TEMPLATE present; no ISSUE_TEMPLATE/",
    };
  }
  return {
    id: "devops.templates",
    title: "Issue and/or PR templates",
    status: "missing",
    evidence: "no .github/ISSUE_TEMPLATE/ or PULL_REQUEST_TEMPLATE",
  };
}

export function checkPreCommitOrHooks(ctx: CheckContext): CheckResult {
  const candidates = [".pre-commit-config.yaml", ".pre-commit-config.yml", "lefthook.yml", ".husky"];
  for (const c of candidates) {
    if (fileExists(ctx.root, c)) {
      return {
        id: "devops.pre_commit",
        title: "Pre-commit hooks configured",
        status: "present",
        evidence: `found ${c}`,
      };
    }
  }
  return {
    id: "devops.pre_commit",
    title: "Pre-commit hooks configured",
    status: "missing",
    evidence: "no pre-commit / lefthook / husky configuration",
  };
}

// --- QUALITY ---

export function checkTaskRunner(ctx: CheckContext): CheckResult {
  const name = firstExisting(ctx.root, ["Makefile", "Taskfile.yml", "Taskfile.yaml", "justfile"]);
  return {
    id: "quality.task_runner",
    title: "Task runner (Makefile / Taskfile / justfile)",
    status: name ? "present" : "missing",
    evidence: name ? `found ${name}` : "no Makefile or equivalent",
  };
}

export function checkTestScript(ctx: CheckContext): CheckResult {
  const pkg = readIfExists(ctx.root, "package.json");
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg) as { scripts?: Record<string, string> };
      if (parsed.scripts && typeof parsed.scripts.test === "string") {
        return {
          id: "quality.test_script",
          title: "Test runner configured (package.json#scripts.test or pytest config)",
          status: "present",
          evidence: "package.json#scripts.test set",
        };
      }
    } catch {
      // fall through
    }
  }
  if (
    fileExists(ctx.root, "pyproject.toml") ||
    fileExists(ctx.root, "pytest.ini") ||
    fileExists(ctx.root, "tox.ini")
  ) {
    return {
      id: "quality.test_script",
      title: "Test runner configured (package.json#scripts.test or pytest config)",
      status: "present",
      evidence: "pyproject.toml / pytest.ini / tox.ini present",
    };
  }
  return {
    id: "quality.test_script",
    title: "Test runner configured (package.json#scripts.test or pytest config)",
    status: "missing",
    evidence: "no test script in package.json and no pytest config",
  };
}

export function checkLintConfig(ctx: CheckContext): CheckResult {
  const candidates = [
    ".eslintrc",
    ".eslintrc.json",
    ".eslintrc.yml",
    ".eslintrc.cjs",
    "eslint.config.js",
    "eslint.config.mjs",
    "ruff.toml",
    ".ruff.toml",
    ".flake8",
    ".yamllint.yml",
    ".markdownlint.yml",
    ".markdownlint.json",
  ];
  const name = firstExisting(ctx.root, candidates);
  return {
    id: "quality.lint_config",
    title: "Lint config present",
    status: name ? "present" : "missing",
    evidence: name ? `found ${name}` : "no lint configuration file",
  };
}

export function checkTypeConfig(ctx: CheckContext): CheckResult {
  const candidates = ["tsconfig.json", "mypy.ini", "pyrightconfig.json"];
  const name = firstExisting(ctx.root, candidates);
  if (!name && fileExists(ctx.root, "pyproject.toml")) {
    const pyproject = readIfExists(ctx.root, "pyproject.toml") ?? "";
    if (/\[tool\.(mypy|pyright)\]/.test(pyproject)) {
      return {
        id: "quality.type_config",
        title: "Type-check configuration",
        status: "present",
        evidence: "pyproject.toml contains [tool.mypy] or [tool.pyright]",
      };
    }
  }
  return {
    id: "quality.type_config",
    title: "Type-check configuration",
    status: name ? "present" : "missing",
    evidence: name ? `found ${name}` : "no tsconfig.json / mypy.ini / pyrightconfig.json",
  };
}

export function checkTestFilesExist(ctx: CheckContext): CheckResult {
  // Look for *.test.ts/js/tsx, test_*.py, or *_test.go files anywhere
  const found = findFiles(
    ctx.root,
    /(\.test\.(ts|js|tsx|jsx)$)|((^|\/)test_[^/]+\.py$)|(_test\.go$)/,
  );
  if (found.length === 0) {
    return {
      id: "quality.test_files",
      title: "Test files exist",
      status: "missing",
      evidence: "no *.test.* or test_*.py files found",
    };
  }
  return {
    id: "quality.test_files",
    title: "Test files exist",
    status: "present",
    evidence: `${found.length} test file(s) found`,
  };
}

export function checkReadmeHasUsage(ctx: CheckContext): CheckResult {
  const readme =
    readIfExists(ctx.root, "README.md") ?? readIfExists(ctx.root, "README") ?? readIfExists(ctx.root, "Readme.md");
  if (readme === null) {
    return {
      id: "quality.readme_usage",
      title: "README has a usage section (fenced code block)",
      status: "missing",
      evidence: "no README found",
    };
  }
  // Look for a fenced code block as a proxy for usage content
  if (/```[\s\S]*?```/.test(readme)) {
    return {
      id: "quality.readme_usage",
      title: "README has a usage section (fenced code block)",
      status: "present",
      evidence: "README contains at least one fenced code block",
    };
  }
  return {
    id: "quality.readme_usage",
    title: "README has a usage section (fenced code block)",
    status: "partial",
    evidence: "README exists but no fenced code blocks (usage may be plain prose)",
  };
}

// --- Registry ---

export type Dimension = "compliance" | "security" | "devops" | "quality";

export const DIMENSIONS: Record<Dimension, ReadonlyArray<(ctx: CheckContext) => CheckResult>> = {
  compliance: [
    checkLicense,
    checkSecurityMd,
    checkContributingMd,
    checkCodeOfConductMd,
    checkChangelogMd,
    checkAuthorshipMetadata,
  ],
  security: [
    checkGitignoreSecrets,
    checkDepUpdater,
    checkAuditInCI,
    checkReuseCompliance,
    checkNoLeakedSecretFiles,
    checkSecurityContact,
  ],
  devops: [
    checkCIWorkflowExists,
    checkWorkflowPermissions,
    checkActionsSHAPinned,
    checkCodeowners,
    checkIssueOrPRTemplates,
    checkPreCommitOrHooks,
  ],
  quality: [
    checkTaskRunner,
    checkTestScript,
    checkLintConfig,
    checkTypeConfig,
    checkTestFilesExist,
    checkReadmeHasUsage,
  ],
};
