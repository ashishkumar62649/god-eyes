"""Unit tests for the shared scope-guard helper (WO-002).

These cover the Orchestrator docs/spec allowance used by every
``test_*_work_order_changes_stay_in_allowed_paths`` guard:

* approved Orchestrator docs/spec paths are recognized,
* docs/archive, docs/audits and all code roots stay forbidden,
* the "all paths" allowance only fires when every dirty path qualifies (so a
  mixed tree still fails the layer allowlist downstream).
"""

import pytest

from scope_guard import (
    all_changed_paths_are_orchestrator_docs_scope,
    is_orchestrator_docs_scope_path,
)


# ---------------------------------------------------------------------------
# is_orchestrator_docs_scope_path - approved paths
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "AGENTS.md",
        ".specify/memory/constitution.md",
        "docs/control/PROJECT_CONTROL.md",
        "docs/control/something.md",
        "docs/state/RECENT_CONTEXT.md",
        "docs/state/HANDOFF_LOG.md",
        "docs/work-orders/WO-002-example.md",
        "specs/009-future-scaling-architecture/README.md",
        "specs/008-structure-remediation-roadmap/tasks.md",
        "docs/decisions/ADR-001-example.md",
    ],
)
def test_approved_orchestrator_paths_are_in_scope(path):
    assert is_orchestrator_docs_scope_path(path) is True


# ---------------------------------------------------------------------------
# is_orchestrator_docs_scope_path - forbidden paths
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        # docs that are explicitly excluded
        "docs/archive/example.md",
        "docs/archive/deeply/nested/report.md",
        "docs/audits/health-2026.md",
        # code roots
        "apps/web/src/App.tsx",
        "apps/api/src/index.ts",
        "services/fetch-orchestrator/src/layers/layer_01_aviation/fetcher.py",
        "services/something.py",
        "database/migrations/layers/layer_07_weather/001.sql",
        "packages/contracts/src/index.ts",
        "packages/schemas/data.py",
        # other typical worker outputs
        "tests/data/layer_07_weather/test_x.py",
        "data/raw/layer_01_aviation/x.json",
        "raw/something.csv",
        # bare filenames that are not the exact AGENTS.md entry
        "other.md",
        ".env",
        ".env.example",
    ],
)
def test_forbidden_paths_are_not_in_scope(path):
    assert is_orchestrator_docs_scope_path(path) is False


def test_windows_backslash_paths_are_normalized():
    # The helper normalizes separators so a Windows-style path still matches.
    assert is_orchestrator_docs_scope_path("docs\\control\\PROJECT_CONTROL.md") is True
    assert is_orchestrator_docs_scope_path("apps\\web\\src\\App.tsx") is False


# ---------------------------------------------------------------------------
# all_changed_paths_are_orchestrator_docs_scope - aggregate behavior
# ---------------------------------------------------------------------------


def test_all_approved_set_is_in_scope():
    changed = [
        "AGENTS.md",
        "docs/control/PROJECT_CONTROL.md",
        "specs/009-future-scaling-architecture/README.md",
    ]
    assert all_changed_paths_are_orchestrator_docs_scope(changed) is True


def test_mixed_set_is_not_in_scope():
    # Orchestrator docs plus a single forbidden app file must NOT get the
    # allowance; this is the key safety property.
    changed = [
        "AGENTS.md",
        "apps/web/src/App.tsx",
    ]
    assert all_changed_paths_are_orchestrator_docs_scope(changed) is False


def test_docs_state_plus_archive_is_not_in_scope():
    changed = [
        "docs/state/RECENT_CONTEXT.md",
        "docs/archive/old-report.md",
    ]
    assert all_changed_paths_are_orchestrator_docs_scope(changed) is False


def test_empty_set_is_not_in_scope():
    # An empty dirty tree is the caller's signal to skip; the aggregate helper
    # must not claim it is "all orchestrator".
    assert all_changed_paths_are_orchestrator_docs_scope([]) is False


def test_single_forbidden_path_is_not_in_scope():
    assert all_changed_paths_are_orchestrator_docs_scope(["services/x.py"]) is False
