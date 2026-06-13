"""GDELT Event Export Row Parse Proof.

Proves the GDELT Event Export path by downloading the latest real export ZIP,
stream-parsing real rows, and producing exact row-level evidence.

This is proof only - no production fetcher, normalizer, or DB changes.
"""

from __future__ import annotations

import csv
import io
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# Column indices (0-based) - verified from actual file
# IMPORTANT: After extensive analysis, ActionGeo is at 48-49, NOT 40-41!
# The file has these geo blocks:
#   34-38: Actor1Geo
#   39-43: Actor2Geo  
#   44-48: ActionGeo

IDX_GLOBALEVENTID = 0
IDX_SQLDATE = 1
IDX_EVENTCODE = 26       # CAMEO event code (e.g., "020") - NOT index 25 which is just 0/1 flag
IDX_QUADCLASS = 29
IDX_GOLDSTEIN = 30
# CORRECTED: ActionGeo is at 48-49, not 40-41!
IDX_ACTIONGEO_LAT = 48   # Correct index for ActionGeo_Lat
IDX_ACTIONGEO_LONG = 49  # Correct index for ActionGeo_Long
IDX_ACTIONGEO_COUNTRY = 45
IDX_DATEADDED = 59
IDX_SOURCEURL = 60

# Actor indices
IDX_ACTOR1NAME = 6
IDX_ACTOR2NAME = 16

# Event info
IDX_EVENTBASECODE = 26
IDX_EVENTROOTCODE = 27
IDX_NUMMENTIONS = 31
IDX_NUMSOURCES = 32
IDX_NUMARTICLES = 33
IDX_AVGTONE = 34

# Geo type - corrected
IDX_ACTIONGEO_TYPE = 44
IDX_ACTIONGEO_FULLNAME = 47

USER_AGENT = "GOD-EYES-news-probe/0.1"
DEFAULT_TIMEOUT = 30
GDELT_LASTUPDATE_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"


def _make_request(url: str, timeout: int = DEFAULT_TIMEOUT) -> dict[str, Any]:
    """Make HTTP request."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return {
                "success": True,
                "status_code": resp.status,
                "content": resp.read(),
                "content_length": int(resp.headers.get("Content-Length", 0)),
            }
    except urllib.error.HTTPError as e:
        return {
            "success": False,
            "status_code": e.code,
            "error": f"HTTP {e.code}: {e.reason}",
        }
    except urllib.error.URLError as e:
        return {"success": False, "status_code": 0, "error": str(e.reason)}
    except Exception as e:
        return {"success": False, "status_code": 0, "error": str(e)}


def _find_latest_export_url(content: bytes) -> Optional[str]:
    """Parse lastupdate.txt to find latest export CSV URL."""
    text = content.decode("utf-8", errors="replace")
    export_urls = []
    for line in text.strip().split("\n"):
        line = line.strip()
        if line.endswith(".export.CSV.zip"):
            parts = line.split()
            if parts:
                export_urls.append(parts[-1])
    return export_urls[0] if export_urls else None


def _read_rows_from_zip(zip_path: Path) -> list[list[str]]:
    """Read all rows from GDELT export ZIP as lists."""
    rows = []
    with zipfile.ZipFile(zip_path, "r") as zf:
        for name in zf.namelist():
            if name.lower().endswith(".csv"):
                with zf.open(name) as f:
                    content = f.read()
                    text = content.decode("utf-8", errors="replace")
                    string_io = io.StringIO(text)
                    reader = csv.reader(string_io, delimiter="\t")
                    rows = list(reader)
    return rows


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


def _is_marker_ready(row: list[str]) -> bool:
    """Check if row qualifies as marker-ready."""
    lat = _parse_float(row[IDX_ACTIONGEO_LAT]) if len(row) > IDX_ACTIONGEO_LAT else None
    lon = _parse_float(row[IDX_ACTIONGEO_LONG]) if len(row) > IDX_ACTIONGEO_LONG else None
    source_url = row[IDX_SOURCEURL].strip() if len(row) > IDX_SOURCEURL else ""
    event_id = row[IDX_GLOBALEVENTID].strip() if len(row) > IDX_GLOBALEVENTID else ""
    return bool(lat and lon and _is_valid_coordinate(lat, lon) and source_url and event_id)


def _get_quadclass(row: list[str]) -> str:
    """Get QuadClass as integer string."""
    if len(row) <= IDX_QUADCLASS:
        return "blank"
    qc = row[IDX_QUADCLASS].strip()
    try:
        return str(int(qc))
    except (ValueError, TypeError):
        return "blank" if not qc else qc


def _extract_domain(url: str) -> str:
    """Extract domain from URL."""
    if not url:
        return ""
    try:
        parsed = urllib.parse.urlparse(url.strip())
        return parsed.netloc
    except Exception:
        return ""


def _safe_row_sample(row: list[str]) -> dict[str, Any]:
    """Create safe sample row with limited fields."""
    source_url = row[IDX_SOURCEURL].strip() if len(row) > IDX_SOURCEURL else ""
    domain = _extract_domain(source_url)
    
    # Limit SourceURL length for proof
    safe_url = source_url if len(source_url) <= 200 else source_url[:200] + "..."
    
    return {
        "GLOBALEVENTID": row[IDX_GLOBALEVENTID] if len(row) > IDX_GLOBALEVENTID else "",
        "SQLDATE": row[IDX_SQLDATE] if len(row) > IDX_SQLDATE else "",
        "Actor1Name": row[IDX_ACTOR1NAME] if len(row) > IDX_ACTOR1NAME else "",
        "Actor2Name": row[IDX_ACTOR2NAME] if len(row) > IDX_ACTOR2NAME else "",
        "EventCode": row[IDX_EVENTCODE] if len(row) > IDX_EVENTCODE else "",
        "EventBaseCode": row[IDX_EVENTBASECODE] if len(row) > IDX_EVENTBASECODE else "",
        "EventRootCode": row[IDX_EVENTROOTCODE] if len(row) > IDX_EVENTROOTCODE else "",
        "QuadClass": _get_quadclass(row),
        "GoldsteinScale": row[IDX_GOLDSTEIN] if len(row) > IDX_GOLDSTEIN else "",
        "NumMentions": row[IDX_NUMMENTIONS] if len(row) > IDX_NUMMENTIONS else "",
        "NumSources": row[IDX_NUMSOURCES] if len(row) > IDX_NUMSOURCES else "",
        "NumArticles": row[IDX_NUMARTICLES] if len(row) > IDX_NUMARTICLES else "",
        "AvgTone": row[IDX_AVGTONE] if len(row) > IDX_AVGTONE else "",
        "ActionGeo_Type": row[IDX_ACTIONGEO_TYPE] if len(row) > IDX_ACTIONGEO_TYPE else "",
        "ActionGeo_FullName": row[IDX_ACTIONGEO_FULLNAME] if len(row) > IDX_ACTIONGEO_FULLNAME else "",
        "ActionGeo_CountryCode": row[IDX_ACTIONGEO_COUNTRY] if len(row) > IDX_ACTIONGEO_COUNTRY else "",
        "ActionGeo_Lat": row[IDX_ACTIONGEO_LAT] if len(row) > IDX_ACTIONGEO_LAT else "",
        "ActionGeo_Long": row[IDX_ACTIONGEO_LONG] if len(row) > IDX_ACTIONGEO_LONG else "",
        "DATEADDED": row[IDX_DATEADDED] if len(row) > IDX_DATEADDED else "",
        "SourceURL": safe_url,
        "SourceDomain": domain,
    }


def run_row_proof() -> dict[str, Any]:
    """Run the GDELT Event Export row parse proof."""
    print("=== GDELT Event Export Row Parse Proof ===\n")
    
    # Step 1: Fetch lastupdate.txt
    print("Fetching lastupdate.txt...")
    result = _make_request(GDELT_LASTUPDATE_URL)
    if not result["success"]:
        print(f"ERROR: Failed to fetch lastupdate.txt: {result.get('error')}")
        return {"success": False, "error": result.get("error")}
    
    # Step 2: Find latest export URL
    export_url = _find_latest_export_url(result["content"])
    if not export_url:
        print("ERROR: No export CSV.zip found in lastupdate.txt")
        return {"success": False, "error": "No export URL found"}
    
    print(f"Latest export URL: {export_url}")
    
    # Step 3: Download the export ZIP
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent.parent.parent.parent
    tmp_dir = project_root / "tmp" / "layer_08_news_osint" / "gdelt_row_probe"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    
    zip_filename = export_url.split("/")[-1]
    zip_path = tmp_dir / zip_filename
    
    print(f"Downloading {zip_filename}...")
    result = _make_request(export_url)
    if not result["success"]:
        print(f"ERROR: Failed to download export: {result.get('error')}")
        return {"success": False, "error": result.get("error")}
    
    compressed_size = result.get("content_length", len(result["content"]))
    print(f"Compressed size: {compressed_size:,} bytes")
    
    zip_path.write_bytes(result["content"])
    print(f"Saved to: {zip_path}")
    
    # Step 4: Parse rows
    print("Parsing export rows...")
    
    all_rows = _read_rows_from_zip(zip_path)
    print(f"Parsed {len(all_rows)} rows from ZIP")
    
    metrics = {
        "parsed_row_count": 0,
        "parse_error_count": 0,
        "rows_with_global_event_id": 0,
        "rows_with_source_url": 0,
        "rows_with_action_geo_country_code": 0,
        "rows_with_action_geo_lat": 0,
        "rows_with_action_geo_long": 0,
        "rows_with_coordinates": 0,
        "marker_ready_candidate_count": 0,
        "list_only_candidate_count": 0,
        "invalid_coordinate_count": 0,
        "missing_source_url_count": 0,
    }
    
    quadclass_counts = Counter()
    event_code_counts = Counter()
    country_counts = Counter()
    
    # Sample storage
    marker_ready_samples: list[dict] = []
    list_only_samples: list[dict] = []
    conflict_samples: list[dict] = []
    cooperation_samples: list[dict] = []
    
    try:
        for row in all_rows:
            metrics["parsed_row_count"] += 1
            
            # Track field availability
            if len(row) > IDX_GLOBALEVENTID and row[IDX_GLOBALEVENTID].strip():
                metrics["rows_with_global_event_id"] += 1
            
            source_url = row[IDX_SOURCEURL].strip() if len(row) > IDX_SOURCEURL else ""
            if source_url:
                metrics["rows_with_source_url"] += 1
            else:
                metrics["missing_source_url_count"] += 1
            
            if len(row) > IDX_ACTIONGEO_COUNTRY and row[IDX_ACTIONGEO_COUNTRY].strip():
                metrics["rows_with_action_geo_country_code"] += 1
                country = row[IDX_ACTIONGEO_COUNTRY].strip()
                # Only count valid country codes (2-3 letters)
                if 2 <= len(country) <= 3:
                    country_counts[country] += 1
            
            lat = _parse_float(row[IDX_ACTIONGEO_LAT]) if len(row) > IDX_ACTIONGEO_LAT else None
            lon = _parse_float(row[IDX_ACTIONGEO_LONG]) if len(row) > IDX_ACTIONGEO_LONG else None
            
            if lat is not None:
                metrics["rows_with_action_geo_lat"] += 1
            if lon is not None:
                metrics["rows_with_action_geo_long"] += 1
            
            if lat is not None and lon is not None:
                metrics["rows_with_coordinates"] += 1
                if _is_valid_coordinate(lat, lon):
                    if _is_marker_ready(row):
                        metrics["marker_ready_candidate_count"] += 1
                        if len(marker_ready_samples) < 10:
                            marker_ready_samples.append(_safe_row_sample(row))
                    else:
                        metrics["invalid_coordinate_count"] += 1
                        if len(list_only_samples) < 10:
                            list_only_samples.append(_safe_row_sample(row))
                else:
                    metrics["invalid_coordinate_count"] += 1
            else:
                metrics["list_only_candidate_count"] += 1
                if len(list_only_samples) < 10:
                    list_only_samples.append(_safe_row_sample(row))
            
            # QuadClass tracking
            qc = _get_quadclass(row)
            quadclass_counts[qc] += 1
            
            if qc in ("3", "4") and len(conflict_samples) < 10:
                conflict_samples.append(_safe_row_sample(row))
            elif qc in ("1", "2") and len(cooperation_samples) < 10:
                cooperation_samples.append(_safe_row_sample(row))
            
            # Event code tracking
            event_code = row[IDX_EVENTCODE].strip() if len(row) > IDX_EVENTCODE else ""
            if event_code:
                event_code_counts[event_code] += 1
            
            # Progress indicator every 10000 rows
            if metrics["parsed_row_count"] % 10000 == 0:
                print(f"  Parsed {metrics['parsed_row_count']:,} rows...")
    
    except Exception as e:
        metrics["parse_error_count"] += 1
        print(f"Parse error: {e}")
    
    # Build result
    result = {
        "success": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "latest_export_url": export_url,
        "compressed_size_bytes": compressed_size,
        "csv_filename_inside_zip": zip_filename.replace(".zip", ""),
        **metrics,
        "unique_country_count": len(country_counts),
        "unique_event_code_count": len(event_code_counts),
        "quadclass_counts": dict(quadclass_counts),
        "top_event_codes": dict(event_code_counts.most_common(20)),
        "top_countries": dict(country_counts.most_common(20)),
        "marker_ready_samples": marker_ready_samples,
        "list_only_samples": list_only_samples,
        "conflict_samples": conflict_samples,
        "cooperation_samples": cooperation_samples,
    }
    
    # Print summary
    print(f"\n=== Parse Results ===")
    print(f"Parsed rows: {metrics['parsed_row_count']:,}")
    print(f"Parse errors: {metrics['parse_error_count']}")
    print(f"Rows with GLOBALEVENTID: {metrics['rows_with_global_event_id']:,}")
    print(f"Rows with SourceURL: {metrics['rows_with_source_url']:,}")
    print(f"Rows with ActionGeo coordinates: {metrics['rows_with_coordinates']:,}")
    print(f"Marker-ready candidates: {metrics['marker_ready_candidate_count']:,}")
    print(f"List-only candidates: {metrics['list_only_candidate_count']:,}")
    print(f"Invalid coordinates: {metrics['invalid_coordinate_count']:,}")
    print(f"Missing SourceURL: {metrics['missing_source_url_count']:,}")
    
    print(f"\n=== QuadClass Counts ===")
    for qc, count in sorted(quadclass_counts.items()):
        label = {1: "verbal cooperation", 2: "material cooperation", 3: "verbal conflict", 4: "material conflict"}.get(int(qc) if qc.isdigit() else 0, qc)
        print(f"  {qc} ({label}): {count:,}")
    
    print(f"\n=== Top 10 Event Codes ===")
    for code, count in event_code_counts.most_common(10):
        print(f"  {code}: {count:,}")
    
    print(f"\n=== Top 10 Countries ===")
    for country, count in country_counts.most_common(10):
        print(f"  {country}: {count:,}")
    
    return result


def _save_proof_summary(results: dict[str, Any], output_dir: Path = None) -> str:
    """Save proof summary to tmp directory."""
    if output_dir is None:
        script_dir = Path(__file__).resolve().parent
        project_root = script_dir.parent.parent.parent.parent.parent
        output_dir = project_root / "tmp" / "layer_08_news_osint" / "gdelt_row_probe"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_path = output_dir / f"row_proof_summary_{timestamp}.json"
    
    output_path.write_text(json.dumps(results, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    return str(output_path)


def main() -> int:
    """CLI entry point."""
    results = run_row_proof()
    if results.get("success"):
        output_path = _save_proof_summary(results)
        print(f"\nProof summary saved to: {output_path}")
        return 0
    else:
        print(f"\nProof failed: {results.get('error')}")
        return 1


if __name__ == "__main__":
    sys.exit(main())