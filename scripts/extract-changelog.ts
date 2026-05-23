// SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors
// SPDX-License-Identifier: MPL-2.0

// Extract a section of CHANGELOG.md for a given version. Used by the
// release workflow to populate the GitHub Release body from the
// matching CHANGELOG section.
//
// Usage:
//   tsx scripts/extract-changelog.ts <version>
//
// Examples:
//   tsx scripts/extract-changelog.ts 0.3.0
//   tsx scripts/extract-changelog.ts Unreleased
//
// Exits 0 and prints the section body to stdout on success.
// Exits 2 with a clear error if the section is missing.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function extractChangelogSection(changelog: string, version: string): string {
  // Section headers look like:
  //   ## [Unreleased]
  //   ## [0.2.0] - 2026-04-28
  // Find the requested header line, then collect everything until the next
  // `## [` header line or end of file. Line-based scan avoids JS regex's
  // lack of a "true end of string" anchor.
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headerRegex = new RegExp(String.raw`^## \[${escaped}\]`);
  const nextHeaderRegex = /^## \[/;

  const lines = changelog.split("\n");

  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerRegex.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) {
    throw new Error(`CHANGELOG section for [${version}] not found`);
  }

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (nextHeaderRegex.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  return lines.slice(startIdx + 1, endIdx).join("\n").trim();
}

function main(): void {
  const version = process.argv[2];
  if (!version) {
    console.error("usage: tsx scripts/extract-changelog.ts <version>");
    process.exit(2);
  }
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const root = resolve(__dirname, "..");
  const changelog = readFileSync(resolve(root, "CHANGELOG.md"), "utf-8");
  try {
    const section = extractChangelogSection(changelog, version);
    process.stdout.write(section + "\n");
  } catch (err) {
    console.error(`[ERROR] ${(err as Error).message}`);
    process.exit(2);
  }
}

const invoked =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) {
  main();
}
