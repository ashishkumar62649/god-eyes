from pathlib import Path
import importlib
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
FETCH_SRC = REPO_ROOT / "services" / "fetch-orchestrator" / "src"

for path in (REPO_ROOT, FETCH_SRC):
    path_str = str(path)
    while path_str in sys.path:
        sys.path.remove(path_str)
    sys.path.insert(0, path_str)

importlib.import_module("layers")
