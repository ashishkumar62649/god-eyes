"""Allow running Layer 07 Weather local seed as a module.

Usage (from services/fetch-orchestrator/src):
    python -m layers.layer_07_weather.weather_local_seed --proof --forecast-days 1
"""

from __future__ import annotations

import sys

from layers.layer_07_weather.weather_local_seed import main

if __name__ == "__main__":
    sys.exit(main())
