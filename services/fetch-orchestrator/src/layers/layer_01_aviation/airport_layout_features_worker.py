"""Airport Layout Features Worker — runtime fetch orchestration.

This worker processes runway data from aviation_runways and persists
layout features to airport_layout_features table.

Usage:
    python -m services.fetch_orchestrator.src.layers.layer_01_aviation.airport_layout_features_worker \\
        --airport-id 5209e070-54e7-45af-a2ef-afa20905085c --dry-run --show-raw

    python -m services.fetch_orchestrator.src.layers.layer_01_aviation.airport_layout_features_worker \\
        --icao KBDL --database-url "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev" \\
        --persist --show-raw

Canonical rules enforced:
  - When aviation_runways.closed is true, set is_active = false
  - When aviation_runways.closed is false/null, set is_active = true
  - Preserve closed value in raw_metadata and feature_subtype
  - Do not create fake geometry
  - Existing active runway behavior must remain unchanged
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

sys.path.insert(0, str(REPO_ROOT / "packages" / "schemas"))
sys.path.insert(0, str(REPO_ROOT / "services" / "normalizer" / "src" / "layers" / "layer_01_aviation"))
sys.path.insert(0, str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation"))

from airport_layout_features_normalizer import (
    normalize_runway_to_layout_feature,
    normalize_runways,
    feature_to_db_record,
    SOURCE_TYPE,
    LAYER_ID,
)
from airport_layout_features_db import (
    DEFAULT_DATABASE_URL,
    connect_db,
    resolve_airport_identity,
    resolve_airport_by_ident,
    get_runway_data_for_layout,
    upsert_layout_feature,
    get_layout_features_for_api,
    get_layout_feature_summary,
)


def run_worker(
    airport_id: str | None = None,
    airport_ident: str | None = None,
    show_raw: bool = False,
    dry_run: bool = True,
    database_url: str | None = None,
) -> dict[str, Any]:
    """Run the layout features worker.

    Args:
        airport_id: UUID of the airport
        airport_ident: ICAO code of the airport
        show_raw: Print raw debug output
        dry_run: If True, don't write to database
        database_url: PostgreSQL connection URL

    Returns:
        Dict with results summary
    """
    db_url = database_url or os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)

    if dry_run:
        print("[WORKER] DRY-RUN MODE: No database writes will be performed")

    result: dict[str, Any] = {
        "airport_id": airport_id,
        "airport_ident": airport_ident,
        "runways_found": 0,
        "runways_processed": 0,
        "features_written": 0,
        "features_with_closed": 0,
        "errors": [],
    }

    conn = None if dry_run else connect_db(db_url)
    try:
        identity = None
        if airport_id and not dry_run:
            identity = resolve_airport_identity(conn, airport_id)
        elif airport_ident and not dry_run:
            identity = resolve_airport_by_ident(conn, airport_ident)

        if not identity:
            icao_fallback = airport_ident or "KBDL"
            identity = {
                "id": airport_id or "00000000-0000-0000-0000-000000000000",
                "ident": icao_fallback,
                "iata_code": None,
                "name": f"Test Airport {icao_fallback}",
            }
            print(f"[WORKER] WARNING: Using fallback identity for {icao_fallback}")

        airport_uuid = str(identity["id"])
        icao = identity.get("ident")

        print(f"[WORKER] Processing: {icao} (airport_id: {airport_uuid})")

        runway_data = []
        if not dry_run:
            runway_data = get_runway_data_for_layout(conn, icao)

        result["runways_found"] = len(runway_data)

        if show_raw and runway_data:
            print(f"[WORKER] Raw runway data:")
            for r in runway_data:
                closed = r.get("closed", False)
                le_ident = r.get("le_ident") or "?"
                he_ident = r.get("he_ident") or "?"
                print(f"  - {le_ident}/{he_ident}: closed={closed}, length_ft={r.get('length_ft')}")

        normalized_features = normalize_runways(runway_data, airport_uuid)

        result["runways_processed"] = len(normalized_features)
        result["features_with_closed"] = sum(
            1 for f in normalized_features if not f.is_active
        )

        if show_raw and normalized_features:
            print(f"[WORKER] Normalized features:")
            for f in normalized_features:
                print(f"  - {f.feature_name}: is_active={f.is_active}, subtype={f.feature_subtype}")

        if dry_run:
            print("[WORKER] DRY-RUN: Skipping all database writes")
            return result

        written_ids = []
        for feature in normalized_features:
            record = feature_to_db_record(feature)
            fid = upsert_layout_feature(conn, record)
            if fid:
                written_ids.append(fid)

        result["features_written"] = len(written_ids)
        print(f"[WORKER] Features written: {result['features_written']}")
        print(f"[WORKER] Closed runways marked inactive: {result['features_with_closed']}")
        print("[WORKER] Done.")

        return result

    except Exception as e:
        error_msg = str(e)
        print(f"[WORKER] ERROR: {error_msg}")
        result["errors"].append(error_msg)
        raise
    finally:
        if conn:
            conn.close()

    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Airport Layout Features Worker — runway layout feature persistence"
    )
    parser.add_argument(
        "--airport-id",
        type=str,
        default=None,
        help="Airport UUID to process",
    )
    parser.add_argument(
        "--icao",
        type=str,
        default=None,
        help="ICAO code to process (alternative to --airport-id)",
    )
    parser.add_argument(
        "--show-raw",
        action="store_true",
        help="Print raw debug output",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Do not write to database (default)",
    )
    parser.add_argument(
        "--persist",
        action="store_true",
        help="Write to database (required for persistence)",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=None,
        help="PostgreSQL connection URL",
    )
    args = parser.parse_args()

    if not args.persist:
        print("[WORKER] Defaulting to dry-run mode (use --persist to write to DB)")
        args.dry_run = True
    else:
        args.dry_run = False

    if not args.airport_id and not args.icao:
        print("[WORKER] ERROR: Must provide --airport-id or --icao")
        sys.exit(1)

    run_worker(
        airport_id=args.airport_id,
        airport_ident=args.icao,
        show_raw=args.show_raw,
        dry_run=args.dry_run,
        database_url=args.database_url,
    )


if __name__ == "__main__":
    main()