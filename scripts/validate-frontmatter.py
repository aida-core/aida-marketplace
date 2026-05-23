#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 The AIDA Marketplace Authors
# SPDX-License-Identifier: MPL-2.0

"""Validate YAML frontmatter in markdown files against the AIDA frontmatter schema.

By default the schema is fetched from its canonical upstream location at
`aida-core/aida-core-plugin/.frontmatter-schema.json` (per ADR-0008 — reference,
don't vendor). For offline runs or local development against a sibling clone,
set the environment variable `AIDA_FRONTMATTER_SCHEMA` to a local file path.

Files without YAML frontmatter are skipped (logged, not failed). Once the
contributor experience around frontmatter is firmly established across this
repo's own markdown, a future PR can flip the script to require frontmatter
on every file.

Exit codes:
  0 — all files validated cleanly (or had no frontmatter to validate)
  1 — at least one file failed validation
  2 — schema could not be loaded
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Iterable

try:
    import jsonschema  # type: ignore[import-untyped]
    import yaml
except ImportError as exc:  # pragma: no cover
    sys.stderr.write(
        f"[ERROR] missing Python dependency: {exc.name}.\n"
        f"        Install with: pip install -r requirements-dev.txt\n",
    )
    sys.exit(2)

DEFAULT_SCHEMA_URL = (
    "https://raw.githubusercontent.com/aida-core/aida-core-plugin/main/.frontmatter-schema.json"
)
SCHEMA_ENV_VAR = "AIDA_FRONTMATTER_SCHEMA"

# Directories we never recurse into when discovering markdown files.
IGNORE_DIRS = frozenset(
    {
        ".git",
        ".venv",
        "venv",
        "node_modules",
        "__pycache__",
        ".pytest_cache",
        ".ruff_cache",
        ".mypy_cache",
        "dist",
        "build",
        "LICENSES",
    },
)


def load_schema(schema_arg: str | None) -> Any:
    """Resolve and load the frontmatter schema.

    Resolution order:
      1. --schema CLI flag (file path)
      2. AIDA_FRONTMATTER_SCHEMA env var (file path)
      3. DEFAULT_SCHEMA_URL (network fetch)
    """
    if schema_arg:
        path = Path(schema_arg)
        return json.loads(path.read_text(encoding="utf-8"))

    env_path = os.environ.get(SCHEMA_ENV_VAR)
    if env_path:
        return json.loads(Path(env_path).read_text(encoding="utf-8"))

    try:
        with urllib.request.urlopen(DEFAULT_SCHEMA_URL, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"could not fetch frontmatter schema from {DEFAULT_SCHEMA_URL}: {exc}. "
            f"For offline runs, point ${SCHEMA_ENV_VAR} at a local copy.",
        ) from exc


def extract_frontmatter(path: Path) -> dict[str, Any] | None:
    """Return the parsed YAML frontmatter, or None if absent / malformed.

    Caller distinguishes 'no frontmatter' (return value None, no error written)
    from 'malformed frontmatter' by re-checking whether the file starts with
    `---`. Malformed YAML is logged here.
    """
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    raw = text[3:end]
    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError as exc:
        sys.stderr.write(f"  YAML parse error in {path}: {exc}\n")
        return None
    if not isinstance(data, dict):
        return None
    return data


def find_markdown_files(root: Path) -> Iterable[Path]:
    """Yield every .md file under `root`, skipping IGNORE_DIRS."""
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        for fname in filenames:
            if fname.endswith(".md"):
                yield Path(dirpath) / fname


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", default=".", help="Directory to scan (default: cwd).")
    parser.add_argument(
        "--schema",
        default=None,
        help=f"Path to a local frontmatter schema. Overrides ${SCHEMA_ENV_VAR} and the default URL.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print every file's outcome (default: only failures + summary).",
    )
    args = parser.parse_args(argv)

    try:
        schema = load_schema(args.schema)
    except (OSError, RuntimeError, json.JSONDecodeError) as exc:
        sys.stderr.write(f"[ERROR] {exc}\n")
        return 2

    root = Path(args.root).resolve()
    files = sorted(find_markdown_files(root))
    if not files:
        print("No markdown files found.")
        return 0

    skipped = 0
    failed = 0
    passed = 0

    for path in files:
        rel = path.relative_to(root) if path.is_relative_to(root) else path
        frontmatter = extract_frontmatter(path)

        if frontmatter is None:
            skipped += 1
            if args.verbose:
                print(f"SKIP {rel} (no frontmatter)")
            continue

        try:
            jsonschema.validate(instance=frontmatter, schema=schema)
        except jsonschema.ValidationError as exc:
            path_parts = " -> ".join(str(p) for p in exc.absolute_path) if exc.absolute_path else "(root)"
            sys.stderr.write(f"FAIL {rel}: {path_parts}: {exc.message}\n")
            failed += 1
            continue

        passed += 1
        if args.verbose:
            print(f"OK   {rel}")

    print(
        f"\nFrontmatter validation: {passed} passing, {failed} failing, {skipped} skipped.",
    )

    if failed:
        sys.stderr.write(
            "\nFailing files must add or correct YAML frontmatter to match "
            "the AIDA frontmatter schema. See: "
            f"{DEFAULT_SCHEMA_URL}\n",
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
