// SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors
// SPDX-License-Identifier: MPL-2.0

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { extractChangelogSection } from "./extract-changelog.js";

const SAMPLE = `# Changelog

Some intro text that should not be returned.

## [Unreleased]

### Added

- A new thing.

### Changed

- A changed thing.

## [0.2.0] - 2026-04-28

Governance section.

### Added

- 0.2.0 added.

## [0.1.0] - 2026-04-28

### Added

- 0.1.0 added.
`;

describe("extractChangelogSection", () => {
  it("extracts the Unreleased section", () => {
    const out = extractChangelogSection(SAMPLE, "Unreleased");
    assert.match(out, /A new thing/);
    assert.match(out, /A changed thing/);
    // Should NOT include the next section's content
    assert.doesNotMatch(out, /Governance section/);
  });

  it("extracts a versioned section by version string", () => {
    const out = extractChangelogSection(SAMPLE, "0.2.0");
    assert.match(out, /Governance section/);
    assert.match(out, /0\.2\.0 added/);
    // Should NOT include adjacent sections
    assert.doesNotMatch(out, /A new thing/);
    assert.doesNotMatch(out, /0\.1\.0 added/);
  });

  it("extracts the final section in the file", () => {
    const out = extractChangelogSection(SAMPLE, "0.1.0");
    assert.match(out, /0\.1\.0 added/);
  });

  it("throws on a missing section", () => {
    assert.throws(
      () => extractChangelogSection(SAMPLE, "9.9.9"),
      /CHANGELOG section for \[9\.9\.9\] not found/,
    );
  });

  it("escapes regex metacharacters in the version string", () => {
    // A literal `.` in 0.2.0 should not also match `0X2Y0`. Construct a sample
    // where a non-escaped version would accidentally match.
    const tricky = `## [0X2Y0]\n\nshould NOT match.\n\n## [0.2.0]\n\nshould match.\n`;
    const out = extractChangelogSection(tricky, "0.2.0");
    assert.match(out, /should match/);
    assert.doesNotMatch(out, /should NOT match/);
  });
});
