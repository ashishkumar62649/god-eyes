"""Natural Earth Admin-0 Boundary Lines Fetcher — WO-078E8.

Downloads boundary *lines* (not polygons) from Natural Earth 50m cultural dataset.

Usage:
    python services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/natural_earth_boundary_lines_worker.py
    python services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/natural_earth_boundary_lines_worker.py --persist

Source: https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_boundary_lines_land.zip

Caveat: MVP/local/dev only. Not production-approved. Not India-compliant.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import tempfile
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

NATURAL_EARTH_URL = "https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_boundary_lines_land.zip"
LAYER_ID = "layer_02_borders_boundaries"
SOURCE_ID = "natural_earth_admin0_boundary_lines_50m"
SOURCE_NAME = "Natural Earth Admin-0 Boundary Lines 1:50m"
CAVEAT = "MVP/local/dev only; not production-approved; not India-compliant."

DEFAULT_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev",
)


def fetch_shapefile_zip(url: str = NATURAL_EARTH_URL, timeout: int = 60) -> bytes | None:
    """Download ZIP from Natural Earth CDN."""
    req = urllib.request.Request(url, headers={"User-Agent": "GodEyes/0.1 (boundary-lines-fetcher)"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except Exception as exc:
        print(f"[FETCH] Error downloading: {exc}")
        return None


def parse_boundary_lines(zip_bytes: bytes) -> list[dict[str, Any]]:
    """Parse LineString/MultiLineString geometries from shapefile ZIP."""
    try:
        import shapefile
    except ImportError:
        print("[ERROR] Missing dependency: pyshp. Install with: pip install pyshp==2.3.1")
        print("[ERROR] Or run: pip install -r requirements-data.txt")
        sys.exit(1)

    records: list[dict[str, Any]] = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        # Find .shp file
        shp_name = next((n for n in zf.namelist() if n.endswith(".shp")), None)
        if not shp_name:
            print("[PARSE] No .shp file found in ZIP")
            return records

        prefix = shp_name[:-4]
        with tempfile.TemporaryDirectory() as tmpdir:
            for ext in (".shp", ".shx", ".dbf", ".prj"):
                fname = prefix + ext
                if fname in zf.namelist():
                    zf.extract(fname, tmpdir)

            sf = shapefile.Reader(str(Path(tmpdir) / shp_name))
            try:
                for i, shape_rec in enumerate(sf.iterShapeRecords()):
                    geom = shape_rec.shape.__geo_interface__
                    geom_type = geom.get("type", "")
                    if geom_type not in ("LineString", "MultiLineString"):
                        continue

                    props = {}
                    for j, field in enumerate(sf.fields[1:]):
                        props[field[0]] = shape_rec.record[j]

                    records.append({
                        "source_object_id": f"ne_50m_bdry_line_{i:05d}",
                        "line_type": "land",
                        "geometry": geom,
                        "properties": props,
                    })
            finally:
                sf.close()  # Explicit close required on Windows to release file locks

    return records


def geometry_to_wkt(geom: dict) -> str:
    """Convert GeoJSON geometry to WKT."""
    gtype = geom["type"]
    coords = geom["coordinates"]

    if gtype == "LineString":
        pts = ", ".join(f"{c[0]} {c[1]}" for c in coords)
        return f"LINESTRING({pts})"
    elif gtype == "MultiLineString":
        lines = []
        for line in coords:
            pts = ", ".join(f"{c[0]} {c[1]}" for c in line)
            lines.append(f"({pts})")
        return f"MULTILINESTRING({', '.join(lines)})"
    return f"GEOMETRYCOLLECTION EMPTY"


def persist_records(records: list[dict[str, Any]], database_url: str) -> dict[str, int]:
    """Upsert boundary line records into borders_boundary_lines table."""
    import psycopg
    from psycopg.rows import dict_row

    stats = {"upserted": 0, "errors": 0}
    conn = psycopg.connect(database_url, row_factory=dict_row)

    try:
        with conn.cursor() as cur:
            for rec in records:
                try:
                    wkt = geometry_to_wkt(rec["geometry"])
                    cur.execute(
                        """
                        INSERT INTO borders_boundary_lines (
                            layer_id, source_id, source_object_id, line_type,
                            geometry, properties
                        ) VALUES (
                            %s, %s, %s, %s,
                            ST_GeomFromText(%s, 4326), %s
                        )
                        ON CONFLICT (source_id, source_object_id) DO UPDATE SET
                            line_type = EXCLUDED.line_type,
                            geometry = EXCLUDED.geometry,
                            properties = EXCLUDED.properties,
                            updated_at = NOW()
                        """,
                        [
                            LAYER_ID, SOURCE_ID, rec["source_object_id"],
                            rec["line_type"], wkt, json.dumps(rec["properties"], default=str),
                        ],
                    )
                    stats["upserted"] += 1
                except Exception as exc:
                    stats["errors"] += 1
                    print(f"[PERSIST] Error on {rec['source_object_id']}: {exc}")
            conn.commit()
    finally:
        conn.close()

    return stats


def run_fetcher(dry_run: bool = True, database_url: str | None = None) -> dict[str, Any]:
    """Run the Natural Earth boundary lines fetcher."""
    result = {"source": NATURAL_EARTH_URL, "records_parsed": 0, "upserted": 0, "errors": []}

    print(f"[FETCH] Downloading from:\n  {NATURAL_EARTH_URL}")
    zip_bytes = fetch_shapefile_zip()
    if zip_bytes is None:
        result["errors"].append("Download failed")
        return result

    print(f"[FETCH] Downloaded {len(zip_bytes)} bytes, parsing shapefile...")
    records = parse_boundary_lines(zip_bytes)
    result["records_parsed"] = len(records)
    print(f"[FETCH] Parsed {len(records)} boundary line features")

    if dry_run:
        print(f"\n[DRY-RUN] Would upsert {len(records)} records into borders_boundary_lines")
        print("[DRY-RUN] Use --persist to write to database")
        return result

    db_url = database_url or DEFAULT_DATABASE_URL
    print(f"[PERSIST] Writing {len(records)} records...")
    stats = persist_records(records, db_url)
    result["upserted"] = stats["upserted"]
    if stats["errors"]:
        result["errors"].append(f"{stats['errors']} DB errors")
    print(f"[PERSIST] Done: upserted={stats['upserted']}, errors={stats['errors']}")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Natural Earth Admin-0 Boundary Lines Fetcher")
    parser.add_argument("--persist", action="store_true", help="Write to database")
    parser.add_argument("--database-url", type=str, default=None)
    args = parser.parse_args()

    dry_run = not args.persist
    if dry_run:
        print("[WORKER] Dry-run mode (use --persist to write to DB)")

    result = run_fetcher(dry_run=dry_run, database_url=args.database_url)

    print(f"\n[SUMMARY] Records parsed: {result['records_parsed']}, Upserted: {result['upserted']}")
    if result["errors"]:
        print(f"  Errors: {result['errors']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
