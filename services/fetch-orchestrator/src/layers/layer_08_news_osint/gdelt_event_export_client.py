"""GDELT Event Export client for Layer 08 News & OSINT.

Fetches GDELT Event Export files from http://data.gdeltproject.org/gdeltv2/
"""

from __future__ import annotations

import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

USER_AGENT = "GOD-EYES-news-fetcher/0.1"
DEFAULT_TIMEOUT = 30
GDELT_LASTUPDATE_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"


@dataclass
class GdeltExportInfo:
    """Information about a GDELT export file."""
    url: str
    filename: str
    timestamp: str  # From filename like 20260613111500
    compressed_size: int


@dataclass 
class GdeltFetchResult:
    """Result of fetching GDELT export."""
    success: bool
    export_info: Optional[GdeltExportInfo] = None
    zip_path: Optional[Path] = None
    error: Optional[str] = None
    status_code: int = 0


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


def fetch_lastupdate() -> dict[str, Any]:
    """Fetch the lastupdate.txt file from GDELT."""
    return _make_request(GDELT_LASTUPDATE_URL)


def parse_export_urls(content: bytes) -> list[GdeltExportInfo]:
    """Parse lastupdate.txt content and extract export file URLs."""
    text = content.decode("utf-8", errors="replace")
    exports = []
    
    for line in text.strip().split("\n"):
        line = line.strip()
        # Find lines containing .export.CSV.zip and extract URL
        if ".export.CSV.zip" in line:
            parts = line.split()
            # URL is typically the first part or contains the .zip
            url = None
            for part in parts:
                if ".export.CSV.zip" in part:
                    url = part
                    break
            if url:
                filename = url.split("/")[-1]
                # Extract timestamp from filename like 20260613111500.export.CSV.zip
                timestamp = filename.split(".")[0]
                exports.append(GdeltExportInfo(
                    url=url,
                    filename=filename,
                    timestamp=timestamp,
                    compressed_size=0,  # Will be set when fetched
                ))
    
    return exports


def get_latest_export(exports: list[GdeltExportInfo]) -> Optional[GdeltExportInfo]:
    """Get the most recent export by timestamp."""
    if not exports:
        return None
    # Sort by timestamp descending (most recent first)
    sorted_exports = sorted(exports, key=lambda x: x.timestamp, reverse=True)
    return sorted_exports[0]


def download_export(export_info: GdeltExportInfo, output_dir: Path, timeout: int = DEFAULT_TIMEOUT) -> GdeltFetchResult:
    """Download a GDELT export ZIP file."""
    result = _make_request(export_info.url, timeout=timeout)
    
    if not result["success"]:
        return GdeltFetchResult(
            success=False,
            error=result.get("error"),
            status_code=result.get("status_code", 0),
        )
    
    compressed_size = result.get("content_length", len(result["content"]))
    export_info.compressed_size = compressed_size
    
    output_dir.mkdir(parents=True, exist_ok=True)
    zip_path = output_dir / export_info.filename
    
    zip_path.write_bytes(result["content"])
    
    return GdeltFetchResult(
        success=True,
        export_info=export_info,
        zip_path=zip_path,
        status_code=result.get("status_code", 200),
    )


def check_local_export_exists(export_info: GdeltExportInfo, output_dir: Path) -> bool:
    """Check if export already exists locally."""
    zip_path = output_dir / export_info.filename
    return zip_path.exists()