"""GDELT Event Export fetcher for Layer 08 News & OSINT.

Fetches and parses GDELT Event Export files.
"""

from __future__ import annotations

import csv
import io
import zipfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from layers.layer_08_news_osint.gdelt_event_export_client import (
    check_local_export_exists,
    download_export,
    fetch_lastupdate,
    get_latest_export,
    parse_export_urls,
)
from layers.layer_08_news_osint.gdelt_event_export_storage import (
    export_directory,
    save_fetch_metadata,
    save_proof_summary,
)

# Verified column indices from GDELT Event Export
IDX_GLOBALEVENTID = 0
IDX_SQLDATE = 1
IDX_ACTOR1NAME = 6
IDX_ACTOR2NAME = 16
IDX_ISROOTEVENT = 25
IDX_EVENTCODE = 26
IDX_EVENTBASECODE = 27
IDX_EVENTROOTCODE = 28
IDX_QUADCLASS = 29
IDX_GOLDSTEIN = 30
IDX_NUMMENTIONS = 31
IDX_NUMSOURCES = 32
IDX_NUMARTICLES = 33
IDX_AVGTONE = 34
IDX_ACTIONGEO_TYPE = 44
IDX_ACTIONGEO_FULLNAME = 47
IDX_ACTIONGEO_COUNTRY = 45
IDX_ACTIONGEO_LAT = 48
IDX_ACTIONGEO_LONG = 49
IDX_DATEADDED = 59
IDX_SOURCEURL = 60


@dataclass
class GdeltEventRow:
    """Parsed GDELT event row."""
    global_event_id: str
    sql_date: str
    actor1_name: str
    actor2_name: str
    event_code: str
    event_base_code: str
    event_root_code: str
    quad_class: str
    goldstein_scale: str
    num_mentions: str
    num_sources: str
    num_articles: str
    avg_tone: str
    action_geo_full_name: str
    action_geo_country_code: str
    action_geo_lat: str
    action_geo_long: str
    source_url: str
    source_domain: str
    date_added: str
    has_action_coordinates: bool
    marker_ready_candidate: bool


def _parse_float(value: str) -> Optional[float]:
    """Safely parse float, return None if invalid."""
    if not value or value.strip() == "":
        return None
    try:
        f = float(value.strip())
        return f if abs(f) != float("inf") else None
    except (ValueError, TypeError):
        return None


def _is_valid_coordinate(lat: Optional[float], lon: Optional[float]) -> bool:
    """Check if lat/lon form valid coordinates."""
    if lat is None or lon is None:
        return False
    return -90 <= lat <= 90 and -180 <= lon <= 180


def _extract_domain(url: str) -> str:
    """Extract domain from URL."""
    if not url:
        return ""
    try:
        from urllib.parse import urlparse
        return urlparse(url.strip()).netloc
    except Exception:
        return ""


def parse_row(columns: list[str]) -> Optional[GdeltEventRow]:
    """Parse a single row into GdeltEventRow."""
    if len(columns) < 61:
        return None
    
    global_event_id = columns[IDX_GLOBALEVENTID].strip()
    source_url = columns[IDX_SOURCEURL].strip()
    
    # Extract coordinates
    lat_str = columns[IDX_ACTIONGEO_LAT].strip()
    lon_str = columns[IDX_ACTIONGEO_LONG].strip()
    lat = _parse_float(lat_str)
    lon = _parse_float(lon_str)
    
    # Check coordinates
    has_action_coords = lat is not None and lon is not None
    is_valid_coords = _is_valid_coordinate(lat, lon)
    
    # Determine marker-ready
    marker_ready = (
        bool(global_event_id) and
        bool(source_url) and
        has_action_coords and
        is_valid_coords
    )
    
    return GdeltEventRow(
        global_event_id=global_event_id,
        sql_date=columns[IDX_SQLDATE].strip(),
        actor1_name=columns[IDX_ACTOR1NAME].strip(),
        actor2_name=columns[IDX_ACTOR2NAME].strip(),
        event_code=columns[IDX_EVENTCODE].strip(),
        event_base_code=columns[IDX_EVENTBASECODE].strip(),
        event_root_code=columns[IDX_EVENTROOTCODE].strip(),
        quad_class=columns[IDX_QUADCLASS].strip(),
        goldstein_scale=columns[IDX_GOLDSTEIN].strip(),
        num_mentions=columns[IDX_NUMMENTIONS].strip(),
        num_sources=columns[IDX_NUMSOURCES].strip(),
        num_articles=columns[IDX_NUMARTICLES].strip(),
        avg_tone=columns[IDX_AVGTONE].strip(),
        action_geo_full_name=columns[IDX_ACTIONGEO_FULLNAME].strip(),
        action_geo_country_code=columns[IDX_ACTIONGEO_COUNTRY].strip(),
        action_geo_lat=lat_str,
        action_geo_long=lon_str,
        source_url=source_url,
        source_domain=_extract_domain(source_url),
        date_added=columns[IDX_DATEADDED].strip(),
        has_action_coordinates=has_action_coords,
        marker_ready_candidate=marker_ready,
    )


def parse_rows_from_zip(zip_path: Path) -> list[GdeltEventRow]:
    """Parse all rows from a GDELT export ZIP."""
    rows = []
    with zipfile.ZipFile(zip_path, "r") as zf:
        for name in zf.namelist():
            if name.lower().endswith(".csv"):
                with zf.open(name) as f:
                    content = f.read()
                    text = content.decode("utf-8", errors="replace")
                    string_io = io.StringIO(text)
                    reader = csv.reader(string_io, delimiter="\t")
                    for columns in reader:
                        parsed = parse_row(columns)
                        if parsed:
                            rows.append(parsed)
    return rows


def summarize_rows(rows: list[GdeltEventRow]) -> dict[str, Any]:
    """Generate summary statistics from parsed rows."""
    quadclass_counts = Counter()
    event_code_counts = Counter()
    country_counts = Counter()
    
    marker_ready = 0
    list_only = 0
    has_source_url = 0
    
    for row in rows:
        # QuadClass
        qc = row.quad_class.strip()
        try:
            qc_int = int(qc)
            if 1 <= qc_int <= 4:
                quadclass_counts[str(qc_int)] += 1
        except (ValueError, TypeError):
            pass
        
        # Event codes
        if row.event_code:
            event_code_counts[row.event_code] += 1
        
        # Countries
        if row.action_geo_country_code and len(row.action_geo_country_code) <= 3:
            country_counts[row.action_geo_country_code] += 1
        
        # Marker status
        if row.marker_ready_candidate:
            marker_ready += 1
        else:
            list_only += 1
        
        # Source URL
        if row.source_url:
            has_source_url += 1
    
    return {
        "parsed_row_count": len(rows),
        "marker_ready_candidate_count": marker_ready,
        "list_only_candidate_count": list_only,
        "has_source_url_count": has_source_url,
        "quadclass_counts": dict(quadclass_counts),
        "top_event_codes": dict(event_code_counts.most_common(20)),
        "top_countries": dict(country_counts.most_common(20)),
    }


def run_fetcher(live_proof: bool = False) -> dict[str, Any]:
    """Run the GDELT Event Export fetcher."""
    print("=== GDELT Event Export Fetcher ===\n")
    
    # Step 1: Fetch lastupdate.txt
    print("Fetching lastupdate.txt...")
    result = fetch_lastupdate()
    if not result["success"]:
        return {"success": False, "error": result.get("error")}
    
    # Step 2: Find latest export
    exports = parse_export_urls(result["content"])
    latest = get_latest_export(exports)
    if not latest:
        return {"success": False, "error": "No export files found"}
    
    print(f"Latest export: {latest.url}")
    print(f"Timestamp: {latest.timestamp}")
    
    # Step 3: Create output directory
    export_dir = export_directory(latest.timestamp)
    export_dir.mkdir(parents=True, exist_ok=True)
    print(f"Output directory: {export_dir}")
    
    # Step 4: Check if already downloaded
    if check_local_export_exists(latest, export_dir):
        print("Export already exists locally, skipping download")
    else:
        print("Downloading export...")
        download_result = download_export(latest, export_dir)
        if not download_result.success:
            return {"success": False, "error": download_result.error}
        print(f"Compressed size: {download_result.export_info.compressed_size:,} bytes")
    
    # Step 5: Find the ZIP file
    zip_path = export_dir / latest.filename
    if not zip_path.exists():
        return {"success": False, "error": f"ZIP file not found: {zip_path}"}
    
    # Step 6: Parse rows
    print("Parsing rows...")
    rows = parse_rows_from_zip(zip_path)
    print(f"Parsed {len(rows)} rows")
    
    # Step 7: Generate summary
    summary = summarize_rows(rows)
    save_proof_summary(export_dir, summary)
    
    # Step 8: Save metadata
    metadata = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "export_url": latest.url,
        "export_timestamp": latest.timestamp,
        "compressed_size": latest.compressed_size,
        "parsed_row_count": len(rows),
    }
    save_fetch_metadata(export_dir, metadata)
    
    # Print summary
    print(f"\n=== Summary ===")
    print(f"Parsed rows: {summary['parsed_row_count']}")
    print(f"Marker-ready: {summary['marker_ready_candidate_count']}")
    print(f"List-only: {summary['list_only_candidate_count']}")
    print(f"With SourceURL: {summary['has_source_url_count']}")
    
    print(f"\n=== QuadClass Counts ===")
    for qc in ["1", "2", "3", "4"]:
        count = summary["quadclass_counts"].get(qc, 0)
        label = {1: "verbal cooperation", 2: "material cooperation", 3: "verbal conflict", 4: "material conflict"}.get(int(qc), qc)
        print(f"  {qc} ({label}): {count}")
    
    print(f"\n=== Top Event Codes ===")
    for code, count in list(summary["top_event_codes"].items())[:10]:
        print(f"  {code}: {count}")
    
    return {
        "success": True,
        "export_url": latest.url,
        "export_timestamp": latest.timestamp,
        "compressed_size": latest.compressed_size,
        "output_dir": str(export_dir),
        "summary": summary,
    }


if __name__ == "__main__":
    run_fetcher(live_proof=True)