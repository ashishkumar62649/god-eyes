"""Layer 10 Energy Infrastructure Fetcher.

Fetches and normalizes public energy infrastructure data from:
  - WRI Global Power Plant Database (CSV)
  - OpenStreetMap via the Overpass API
  - Global Energy Monitor (live download blocked pending license
    verification; normalizer and DB writer support mock records so
    the rest of the pipeline is ready).

The pipeline is staged: download-only, normalize-only, persist-from-cache.
A CLI worker (``energy_infrastructure_worker.py``) ties them together.
"""

__version__ = "1.0.0"
