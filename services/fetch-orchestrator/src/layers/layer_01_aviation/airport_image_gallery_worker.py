"""Airport Image Gallery Worker — WO-051.

Fetches airport images from Wikimedia/Wikipedia/Wikidata, normalizes them,
ranks them, and optionally persists them into airport_image_assets.

Usage:
    # Dry-run (default)
    python airport_image_gallery_worker.py --icao KBDL --database-url "..." --show-raw

    # Persist to DB
    python airport_image_gallery_worker.py --icao KBDL --database-url "..." --persist

    # Batch test airports
    python airport_image_gallery_worker.py --batch-test-airports --max-airports 10 --database-url "..."

    # By airport ID
    python airport_image_gallery_worker.py --airport-id <uuid> --database-url "..." --persist

Data quality rules enforced:
  - Dry-run is default; --persist required for DB writes
  - No fake images inserted when no candidates found
  - Only one is_hero=true per airport
  - Deduplication by image_url
  - Rate-limited external requests (default 1.5s sleep)
  - 429/503 backoff with diagnostics
  - Current build limited to small batch only

Sources used:
  1. Local DB: aviation_airports, airport_source_links
  2. Wikipedia REST API: page image list
  3. Wikimedia Commons: imageinfo for file metadata
  4. Wikimedia Commons category: category members
  5. Wikidata: P18 (main image), Commons category hints

Sources NOT used yet:
  - Official airport websites
  - Flickr/Instagram/social media
  - Aviation photography sites
  - All-airport backfill
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

sys.path.insert(0, str(REPO_ROOT / "services" / "normalizer" / "src" / "layers" / "layer_01_aviation"))
sys.path.insert(0, str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation"))

from airport_image_gallery_db import (
    DEFAULT_DATABASE_URL,
    LAYER_ID,
    check_image_assets_table_exists,
    clear_hero_for_airport,
    connect_db,
    find_source_links_for_airport,
    get_existing_images_for_airport,
    resolve_airport_by_ident,
    resolve_airport_by_iata,
    resolve_airport_identity,
    set_hero_image,
    upsert_image_asset,
)
from airport_image_gallery_normalizer import (
    ImageCandidate,
    NormalizationResult,
    candidate_to_db_dict,
    classify_image_kind,
    normalize_candidates,
    normalize_commons_category_members,
    normalize_wikidata_image,
    normalize_wikimedia_imageinfo,
    normalize_wikipedia_image_list,
    select_hero,
)

DEFAULT_USER_AGENT = "GodEyes/0.1 (dev/test; https://github.com/anomalyco/god-eyes)"
DEFAULT_SLEEP_SECONDS = 1.5
MAX_RETRIES = 2
BACKOFF_BASE = 2.0

TEST_AIRPORTS = ["KBDL", "KBOS", "KPVD", "KJFK", "KLAX", "EGLL", "OMDB", "VIDP", "WSSS", "RJTT"]

WIKIPEDIA_IMAGES_BASE = "https://en.wikipedia.org/w/api.php"
COMMONS_IMAGEINFO_BASE = "https://commons.wikimedia.org/w/api.php"
WIKIDATA_ENTITY_BASE = "https://www.wikidata.org/wiki/Special:EntityData"


class WorkerError(Exception):
    pass


class RateLimitError(WorkerError):
    pass


_last_request_time: float = 0.0


def _throttle(sleep_seconds: float = DEFAULT_SLEEP_SECONDS) -> None:
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < sleep_seconds:
        time.sleep(sleep_seconds - elapsed)
    _last_request_time = time.time()


def _fetch_json(url: str, sleep_seconds: float = DEFAULT_SLEEP_SECONDS,
                 show_raw: bool = False) -> tuple[dict[str, Any] | None, int | None, str | None]:
    _throttle(sleep_seconds)
    req = urllib.request.Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    last_error: str | None = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read()
                data = json.loads(raw)
                if show_raw:
                    print(f"  [RAW] {url[:80]}... status={resp.status}")
                return data, resp.status, None
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                retry_after = exc.headers.get("Retry-After")
                wait = float(retry_after) if retry_after else sleep_seconds * (BACKOFF_BASE ** attempt)
                last_error = f"429 rate limited, backing off {wait}s"
                print(f"  [WARN] {last_error}")
                time.sleep(wait)
                continue
            if exc.code == 503:
                wait = sleep_seconds * (BACKOFF_BASE ** attempt)
                last_error = f"503 service unavailable, backing off {wait}s"
                print(f"  [WARN] {last_error}")
                time.sleep(wait)
                continue
            return None, exc.code, f"HTTP {exc.code}"
        except Exception as exc:
            last_error = str(exc)
            if attempt < MAX_RETRIES:
                wait = sleep_seconds * (BACKOFF_BASE ** attempt)
                time.sleep(wait)
                continue
            return None, None, last_error
    return None, None, last_error


def fetch_wikipedia_images(page_title: str, sleep_seconds: float = DEFAULT_SLEEP_SECONDS,
                            show_raw: bool = False) -> tuple[list[dict[str, str]], list[str]]:
    params = {
        "action": "query",
        "prop": "images",
        "titles": page_title,
        "imlimit": "50",
        "format": "json",
    }
    url = f"{WIKIPEDIA_IMAGES_BASE}?{urllib.parse.urlencode(params)}"
    data, status, error = _fetch_json(url, sleep_seconds, show_raw)

    diagnostics = []
    if error:
        diagnostics.append(f"wikipedia_images_fetch_error:{error}")
        return [], diagnostics
    if status != 200:
        diagnostics.append(f"wikipedia_images_status:{status}")
        return [], diagnostics

    images = normalize_wikipedia_image_list(page_title, data or {})
    return images, diagnostics


def fetch_commons_imageinfo(file_title: str, sleep_seconds: float = DEFAULT_SLEEP_SECONDS,
                              show_raw: bool = False) -> tuple[dict[str, Any] | None, list[str]]:
    params = {
        "action": "query",
        "titles": file_title,
        "prop": "imageinfo",
        "iiprop": "url|mime|size|extmetadata",
        "iiurlwidth": "900",
        "format": "json",
    }
    url = f"{COMMONS_IMAGEINFO_BASE}?{urllib.parse.urlencode(params)}"
    data, status, error = _fetch_json(url, sleep_seconds, show_raw)

    diagnostics = []
    if error:
        diagnostics.append(f"commons_imageinfo_fetch_error:{error}")
        return None, diagnostics
    if status != 200:
        diagnostics.append(f"commons_imageinfo_status:{status}")
        return None, diagnostics

    return data, diagnostics


def fetch_commons_category(category_name: str, sleep_seconds: float = DEFAULT_SLEEP_SECONDS,
                            show_raw: bool = False) -> tuple[list[dict[str, str]], list[str]]:
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": f"Category:{category_name}",
        "cmnamespace": "6",
        "cmlimit": "50",
        "format": "json",
    }
    url = f"{COMMONS_IMAGEINFO_BASE}?{urllib.parse.urlencode(params)}"
    data, status, error = _fetch_json(url, sleep_seconds, show_raw)

    diagnostics = []
    if error:
        diagnostics.append(f"commons_category_fetch_error:{error}")
        return [], diagnostics
    if status != 200:
        diagnostics.append(f"commons_category_status:{status}")
        return [], diagnostics

    members = normalize_commons_category_members(category_name, data or {})
    return members, diagnostics


def fetch_wikidata_entity(qid: str, sleep_seconds: float = DEFAULT_SLEEP_SECONDS,
                           show_raw: bool = False) -> tuple[dict[str, Any] | None, list[str]]:
    url = f"{WIKIDATA_ENTITY_BASE}/{qid}.json"
    data, status, error = _fetch_json(url, sleep_seconds, show_raw)

    diagnostics = []
    if error:
        diagnostics.append(f"wikidata_entity_fetch_error:{error}")
        return None, diagnostics
    if status != 200:
        diagnostics.append(f"wikidata_entity_status:{status}")
        return None, diagnostics

    return data, diagnostics


def resolve_wikipedia_title_from_link(wikipedia_link: str | None) -> str | None:
    if wikipedia_link and "/wiki/" in wikipedia_link:
        return wikipedia_link.split("/wiki/")[-1].replace("_", " ")
    return None


def find_wikidata_qid_from_source_links(source_links: list[dict[str, Any]]) -> str | None:
    for link in source_links:
        if link.get("source_type") == "wikidata" and link.get("source_entity_id"):
            return link["source_entity_id"]
        if link.get("metadata"):
            try:
                meta = link["metadata"]
                if isinstance(meta, str):
                    meta = json.loads(meta)
                if meta.get("qid"):
                    return meta["qid"]
            except Exception:
                pass
    return None


def find_commons_category_from_wikidata(entity_data: dict[str, Any]) -> str | None:
    entities = entity_data.get("entities", {})
    if not entities:
        return None
    entity = next(iter(entities.values()))
    claims = entity.get("claims", {})
    p373_entries = claims.get("P373", [])
    if p373_entries:
        return p373_entries[0].get("mainsnak", {}).get("datavalue", {}).get("value")
    return None


def process_airport_images(
    airport_id: str,
    icao: str | None = None,
    iata: str | None = None,
    name: str | None = None,
    wikipedia_title: str | None = None,
    wikidata_qid: str | None = None,
    source_links: list[dict[str, Any]] | None = None,
    max_images: int = 8,
    sleep_seconds: float = DEFAULT_SLEEP_SECONDS,
    show_raw: bool = False,
) -> dict[str, Any]:
    all_diagnostics: list[str] = []
    all_candidates: list[ImageCandidate] = []
    all_skipped: list[dict[str, Any]] = []

    if wikidata_qid:
        if show_raw:
            print(f"  Fetching Wikidata entity: {wikidata_qid}")
        wd_data, wd_diag = fetch_wikidata_entity(wikidata_qid, sleep_seconds, show_raw)
        all_diagnostics.extend(wd_diag)

        if wd_data:
            wd_candidate = normalize_wikidata_image(wd_data)
            if wd_candidate:
                all_candidates.append(wd_candidate)
                if show_raw:
                    print(f"  Wikidata P18 image: {wd_candidate.image_url[:80]}")

            commons_cat = find_commons_category_from_wikidata(wd_data)
            if commons_cat:
                if show_raw:
                    print(f"  Found Commons category: {commons_cat}")
                cat_members, cat_diag = fetch_commons_category(commons_cat, sleep_seconds, show_raw)
                all_diagnostics.extend(cat_diag)

                for member in cat_members[:15]:
                    file_title = member["file_title"]
                    if show_raw:
                        print(f"  Fetching Commons imageinfo: {file_title}")
                    ii_data, ii_diag = fetch_commons_imageinfo(file_title, sleep_seconds, show_raw)
                    all_diagnostics.extend(ii_diag)

                    if ii_data:
                        candidate = normalize_wikimedia_imageinfo(file_title, ii_data)
                        if candidate:
                            all_candidates.append(candidate)

    if wikipedia_title:
        if show_raw:
            print(f"  Fetching Wikipedia images: {wikipedia_title}")
        wiki_images, wiki_diag = fetch_wikipedia_images(wikipedia_title, sleep_seconds, show_raw)
        all_diagnostics.extend(wiki_diag)

        for img in wiki_images[:20]:
            file_title = img["file_title"]
            if show_raw:
                print(f"  Fetching Commons imageinfo for wiki image: {file_title}")
            ii_data, ii_diag = fetch_commons_imageinfo(file_title, sleep_seconds, show_raw)
            all_diagnostics.extend(ii_diag)

            if ii_data:
                candidate = normalize_wikimedia_imageinfo(file_title, ii_data, source_type="wikipedia")
                if candidate:
                    all_candidates.append(candidate)

    norm_result = normalize_candidates(all_candidates, max_images=max_images)

    hero = select_hero(norm_result.candidates)
    for c in norm_result.candidates:
        c.is_hero = (c == hero)

    return {
        "airport_id": airport_id,
        "icao": icao,
        "iata": iata,
        "name": name,
        "candidates": norm_result.candidates,
        "skipped": norm_result.skipped + all_skipped,
        "diagnostics": all_diagnostics + norm_result.diagnostics,
        "hero": hero,
        "total_candidates": len(norm_result.candidates),
        "total_skipped": len(norm_result.skipped) + len(all_skipped),
    }


def run_worker(
    airport_id: str | None = None,
    icao: str | None = None,
    iata: str | None = None,
    batch_test_airports: bool = False,
    max_airports: int = 10,
    max_images_per_airport: int = 8,
    sleep_seconds: float = DEFAULT_SLEEP_SECONDS,
    database_url: str | None = None,
    persist: bool = False,
    show_raw: bool = False,
) -> dict[str, Any]:
    db_url = database_url or os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    dry_run = not persist

    if dry_run:
        print("[WORKER] DRY-RUN MODE: No database writes will be performed")

    airports_to_process: list[dict[str, Any]] = []

    if batch_test_airports:
        for code in TEST_AIRPORTS[:max_airports]:
            airports_to_process.append({"icao": code, "iata": None, "airport_id": None})
        print(f"[WORKER] Batch mode: {len(airports_to_process)} airports")
    elif airport_id:
        airports_to_process.append({"airport_id": airport_id, "icao": None, "iata": None})
    elif icao:
        airports_to_process.append({"icao": icao, "iata": None, "airport_id": None})
    elif iata:
        airports_to_process.append({"iata": iata, "icao": None, "airport_id": None})
    else:
        raise WorkerError("Must provide --airport-id, --icao, --iata, or --batch-test-airports")

    results: list[dict[str, Any]] = []
    total_images = 0
    total_errors = 0

    conn = connect_db(db_url)
    try:
        if not check_image_assets_table_exists(conn):
            raise WorkerError(
                "airport_image_assets table does not exist. "
                "Run WO-050 migration first: database/migrations/layers/layer_01_aviation/010_airport_image_assets.sql"
            )

        for airport_spec in airports_to_process:
            spec_icao = airport_spec.get("icao")
            spec_iata = airport_spec.get("iata")
            spec_id = airport_spec.get("airport_id")

            identity = None
            if spec_id:
                identity = resolve_airport_identity(conn, spec_id)
            elif spec_icao:
                identity = resolve_airport_by_ident(conn, spec_icao)
            elif spec_iata:
                identity = resolve_airport_by_iata(conn, spec_iata)

            if not identity:
                print(f"[WORKER] WARNING: Airport not found for {spec_icao or spec_iata or spec_id}")
                total_errors += 1
                results.append({
                    "airport_id": spec_id,
                    "icao": spec_icao,
                    "iata": spec_iata,
                    "error": "airport_not_found",
                    "images_count": 0,
                })
                continue

            airport_uuid = str(identity["id"])
            a_icao = identity.get("ident")
            a_iata = identity.get("iata_code")
            a_name = identity.get("name")
            a_wikipedia_link = identity.get("wikipedia_link")

            print(f"[WORKER] Processing: {a_icao} / {a_iata} — {a_name}")

            source_links = find_source_links_for_airport(conn, airport_uuid)

            wikipedia_title = resolve_wikipedia_title_from_link(a_wikipedia_link)
            if not wikipedia_title and a_name:
                wikipedia_title = a_name

            wikidata_qid = find_wikidata_qid_from_source_links(source_links)

            airport_result = process_airport_images(
                airport_id=airport_uuid,
                icao=a_icao,
                iata=a_iata,
                name=a_name,
                wikipedia_title=wikipedia_title,
                wikidata_qid=wikidata_qid,
                source_links=source_links,
                max_images=max_images_per_airport,
                sleep_seconds=sleep_seconds,
                show_raw=show_raw,
            )

            if show_raw:
                print(f"  Candidates: {airport_result['total_candidates']}")
                print(f"  Skipped: {airport_result['total_skipped']}")
                for c in airport_result["candidates"]:
                    hero_marker = " [HERO]" if c.is_hero else ""
                    print(f"    [{c.rank:3d}] {c.image_kind:12s} {c.image_url[:80]}{hero_marker}")

            if dry_run:
                print(f"[WORKER] DRY-RUN: Would upsert {airport_result['total_candidates']} images for {a_icao}")
            else:
                if airport_result["total_candidates"] == 0:
                    print(f"[WORKER] No images found for {a_icao}, skipping DB write")
                else:
                    clear_hero_for_airport(conn, airport_uuid)

                    for c in airport_result["candidates"]:
                        db_dict = candidate_to_db_dict(c)
                        db_dict["is_hero"] = c.is_hero
                        upsert_image_asset(conn, airport_uuid, **db_dict)

                    if airport_result["hero"]:
                        print(f"[WORKER] Hero set: {airport_result['hero'].image_url[:80]}")

                    print(f"[WORKER] Persisted {airport_result['total_candidates']} images for {a_icao}")

            total_images += airport_result["total_candidates"]
            results.append({
                "airport_id": airport_uuid,
                "icao": a_icao,
                "iata": a_iata,
                "name": a_name,
                "images_count": airport_result["total_candidates"],
                "hero_url": airport_result["hero"].image_url if airport_result["hero"] else None,
                "diagnostics": airport_result["diagnostics"],
            })

        print(f"[WORKER] Done. Total images: {total_images}, Errors: {total_errors}")

    except WorkerError:
        raise
    except Exception as e:
        print(f"[WORKER] ERROR: {e}")
        raise
    finally:
        if conn:
            conn.close()

    return {
        "dry_run": dry_run,
        "airports_processed": len(results),
        "total_images": total_images,
        "total_errors": total_errors,
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Airport Image Gallery Worker — WO-051"
    )
    parser.add_argument("--airport-id", type=str, default=None, help="Airport UUID")
    parser.add_argument("--icao", type=str, default=None, help="ICAO code")
    parser.add_argument("--iata", type=str, default=None, help="IATA code")
    parser.add_argument("--batch-test-airports", action="store_true", help="Process test batch airports")
    parser.add_argument("--max-airports", type=int, default=10, help="Max airports in batch")
    parser.add_argument("--max-images-per-airport", type=int, default=8, help="Max images per airport")
    parser.add_argument("--sleep-seconds", type=float, default=DEFAULT_SLEEP_SECONDS, help="Sleep between requests")
    parser.add_argument("--database-url", type=str, default=None, help="PostgreSQL URL")
    parser.add_argument("--persist", action="store_true", help="Write to database (required for persistence)")
    parser.add_argument("--show-raw", action="store_true", help="Print raw debug output")
    args = parser.parse_args()

    if not args.persist:
        print("[WORKER] Defaulting to dry-run mode (use --persist to write to DB)")

    if not args.airport_id and not args.icao and not args.iata and not args.batch_test_airports:
        print("[WORKER] ERROR: Must provide --airport-id, --icao, --iata, or --batch-test-airports")
        sys.exit(1)

    run_worker(
        airport_id=args.airport_id,
        icao=args.icao,
        iata=args.iata,
        batch_test_airports=args.batch_test_airports,
        max_airports=args.max_airports,
        max_images_per_airport=args.max_images_per_airport,
        sleep_seconds=args.sleep_seconds,
        database_url=args.database_url,
        persist=args.persist,
        show_raw=args.show_raw,
    )


if __name__ == "__main__":
    main()
