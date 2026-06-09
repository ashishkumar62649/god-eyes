from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[2]
FETCH_SRC = REPO_ROOT / "services" / "fetch-orchestrator" / "src"


def pytest_runtest_setup(item):
    """Ensure fetch-orchestrator/src is at position 0 in sys.path before each test."""
    if FETCH_SRC.exists():
        fetch_src_str = str(FETCH_SRC)
        while fetch_src_str in sys.path:
            sys.path.remove(fetch_src_str)
        sys.path.insert(0, fetch_src_str)

        # Remove packages/schemas from sys.path - it contains a conflicting 'layers' package
        schemas_path = str(REPO_ROOT / "packages" / "schemas")
        while schemas_path in sys.path:
            sys.path.remove(schemas_path)

        # Clear any cached 'layers' module pointing to wrong package
        keys_to_remove = [k for k in sys.modules if k == "layers" or k.startswith("layers.")]
        for k in keys_to_remove:
            mod = sys.modules[k]
            mod_path = str(getattr(mod, "__path__", getattr(mod, "__file__", "")))
            if "schemas" in mod_path or fetch_src_str not in mod_path:
                del sys.modules[k]
