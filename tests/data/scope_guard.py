"""Shared scope-guard helpers for data work-order tests.

The data test suite contains one ``test_*_work_order_changes_stay_in_allowed_paths``
per layer. Each derives the dirty working-tree paths from ``git status --porcelain``
and asserts they all fall within that layer's allowed path prefixes. That is
correct for layer-scoped worker work orders (fetcher / normalizer / database),
but it would *falsely fail* when the dirty tree only contains approved
Orchestrator-owned docs/spec edits (e.g. AGENTS.md, docs/control/, specs/).

This module centralizes:

* the git status path extraction (so every guard reads the same source of truth), and
* the "approved Orchestrator docs/spec scope" rule, so a guard can allow an
  entirely-orchestrator dirty tree without weakening layer-specific protection.

Design rules (do not weaken):

* Orchestrator docs/spec allowance only fires when **every** dirty path is an
  approved Orchestrator docs/spec path. A mixed tree (orchestrator docs plus
  any non-approved path) is NOT granted the allowance and is still checked
  against the layer allowlist, so forbidden paths still fail.
* ``docs/archive/`` and ``docs/audits/`` are explicitly NOT Orchestrator docs
  scope here. They remain forbidden.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Iterable, List

# Approved Orchestrator docs/spec path prefixes.
#
# This mirrors the Orchestrator-owned paths from AGENTS.md and
# docs/control/PROJECT_CONTROL.md (ownership matrix). It intentionally excludes
# docs/archive/ and docs/audits/ (see FORBIDDEN_PREFIXES below) and all code
# roots (apps/, services/, database/, packages/).
ORCHESTRATOR_DOCS_SCOPE_PREFIXES: tuple[str, ...] = (
    "AGENTS.md",
    ".specify/memory/constitution.md",
    "docs/control/",
    "docs/state/",
    "docs/work-orders/",
    "specs/",
    "docs/decisions/",
)

# Paths that are explicitly forbidden even when the dirty tree otherwise looks
# like Orchestrator docs/spec work. Keeping these in a separate deny list makes
# the intent explicit and guards against a future prefix accidentally matching
# one of them.
FORBIDDEN_PREFIXES: tuple[str, ...] = (
    "docs/archive/",
    "docs/audits/",
    "apps/",
    "services/",
    "database/",
    "packages/",
)


def is_orchestrator_docs_scope_path(path: str) -> bool:
    """Return True iff *path* is an approved Orchestrator docs/spec path.

    A path qualifies only when it lives under an approved orchestrator prefix
    AND is not under a forbidden prefix (docs/archive/, docs/audits/, or any
    code root). The deny list is checked first so a forbidden prefix can never
    be masked by an approved one.

    Path separators are normalized to "/" before matching; the input must be
    relative to the repo root (as produced by ``git status --porcelain``).
    """
    normalized = path.replace("\\", "/")
    if any(normalized.startswith(forbidden) for forbidden in FORBIDDEN_PREFIXES):
        return False
    return any(
        normalized.startswith(approved)
        for approved in ORCHESTRATOR_DOCS_SCOPE_PREFIXES
    )


def all_changed_paths_are_orchestrator_docs_scope(changed_paths: Iterable[str]) -> bool:
    """Return True iff *every* path is an approved Orchestrator docs/spec path.

    Returns False for an empty iterable (callers must decide their own skip
    behavior for a clean tree) and False if any single path is not approved.
    This guarantees a mixed dirty tree (orchestrator docs plus an unrelated
    forbidden file) does NOT get the allowance.
    """
    paths = list(changed_paths)
    if not paths:
        return False
    return all(is_orchestrator_docs_scope_path(path) for path in paths)


def get_work_order_changed_paths(repo_root: Path) -> List[str]:
    """Return dirty working-tree paths (relative, "/"-separated) for *repo_root*.

    Mirrors the parsing historically duplicated in every layer guard:
    ``git status --porcelain`` with the ``XY <path>`` prefix (3 chars) stripped
    and Windows backslashes normalized, ignoring the local ``.pytest_cache/``.
    """
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=str(repo_root),
        check=True,
        capture_output=True,
        text=True,
    )
    return [
        line[3:].replace("\\", "/")
        for line in result.stdout.splitlines()
        if line and not line.startswith("?? .pytest_cache/")
    ]
