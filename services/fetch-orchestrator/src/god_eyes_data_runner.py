#!/usr/bin/env python
"""GOD EYES Data Runner — single entry point.

Keeps all enabled data pipelines running continuously or on scheduled
intervals. Supervises existing Python fetch/normalize/ingest scripts
without rewriting layer workers.

Usage:
    python services/fetch-orchestrator/src/god_eyes_data_runner.py
    python services/fetch-orchestrator/src/god_eyes_data_runner.py --list-jobs
    python services/fetch-orchestrator/src/god_eyes_data_runner.py --dry-run
    python services/fetch-orchestrator/src/god_eyes_data_runner.py --run-once
    python services/fetch-orchestrator/src/god_eyes_data_runner.py --jobs aviation_live_aircraft,weather
"""

from __future__ import annotations

import sys
from pathlib import Path

_src = Path(__file__).resolve().parent
if str(_src) not in sys.path:
    sys.path.insert(0, str(_src))

from data_runner.main import main

if __name__ == "__main__":
    sys.exit(main())
