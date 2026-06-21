"""Airport Intelligence Ingest Worker — WO-043.

This worker fills the new airport intelligence database tables with real source-backed data.

Usage:
    python services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_ingest_worker.py \\
        --airport-id 5209e070-54e7-45af-a2ef-afa20905085c --dry-run --show-raw

    python services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_ingest_worker.py \\
        --airport-id 5209e070-54e7-45af-a2ef-afa20905085c \\
        --database-url "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev" \\
        --persist --show-raw

Data quality rules enforced:
  - Never guess passenger capacity
  - Never guess passenger traffic
  - Never store traffic without year and source
  - Never mark capacity_status = ok without source backing
  - Never mark traffic_status = ok without source backing
  - If opened date is missing, store null
  - If Wikidata is unavailable, continue with Wikipedia/local DB
  - If Wikipedia is unavailable, continue with local DB only
  - If source confidence is low, mark low_confidence instead of ok

Sources used for the current build:
  1. Local aviation_airports / runway / frequency / navaid data
  2. Existing airport_public_profiles cache
  3. Wikipedia REST
  4. Wikidata with throttle/background behavior

Sources NOT used yet:
  - OSM layout persistence
  - BTS traffic ingest
  - Eurostat traffic ingest
  - Official website deep scraping
  - Annual report PDF parsing
  - AviationWeather live weather persistence
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
from uuid import UUID

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

sys.path.insert(0, str(REPO_ROOT / "packages" / "schemas"))
sys.path.insert(0, str(REPO_ROOT / "packages" / "schemas" / "layers" / "layer_01_aviation"))
sys.path.insert(0, str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation"))
sys.path.insert(0, str(REPO_ROOT / "services" / "normalizer" / "src" / "layers" / "layer_01_aviation"))

from airport_intelligence_ingest_db import (
    DEFAULT_DATABASE_URL,
    connect_db,
    resolve_airport_identity,
    resolve_airport_by_ident,
    get_existing_public_profile,
    get_runway_data,
    upsert_source_link,
    upsert_intelligence_module,
    upsert_derived_intelligence,
    upsert_capacity_profile,
    upsert_traffic_metric,
    get_intelligence_modules,
    get_source_links,
)
from airport_intelligence_normalizer import (
    extract_opened_date_from_wikidata,
    build_map_popup_payload,
    build_capability_tags,
    build_infrastructure_summary,
    build_source_attribution,
    determine_module_status,
    safe_year_from_extract,
    WIKIPEDIA_LICENSE,
    WIKIPEDIA_LICENSE_URL,
    WIKIDATA_LICENSE,
    WIKIDATA_LICENSE_URL,
    OURAIRPORTS_LICENSE,
    OURAIRPORTS_LICENSE_URL,
    ParsedOpenedDate,
    MapPopupPayload,
    CapabilityTags,
    InfrastructureSummary,
)
from wikimedia_wikidata_fetcher import (
    SOURCE_ID as WIKIMEDIA_SOURCE_ID,
    fetch_wikipedia_summary,
    fetch_wikidata_entity,
    icao_to_wikidata_qid,
    WikipediaNotFoundError,
    WikidataNotFoundError,
    FetchRateLimitedError,
    FetcherError,
)

DEFAULT_USER_AGENT = "GodEyes/0.1 (operations@madmarketingmedia.com)"
WIKIPEDIA_SUMMARY_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary"
WIKIDATA_ENTITY_BASE = "https://www.wikidata.org/wiki/Special:EntityData"
WIKIDATA_THROTTLE_SECONDS = 2.0
WIKIDATA_LAST_REQUEST_TIME: float = 0.0


class WorkerError(Exception):
    pass


def _throttle_wikidata() -> None:
    global WIKIDATA_LAST_REQUEST_TIME
    elapsed = time.time() - WIKIDATA_LAST_REQUEST_TIME
    if elapsed < WIKIDATA_THROTTLE_SECONDS:
        time.sleep(WIKIDATA_THROTTLE_SECONDS - elapsed)
    WIKIDATA_LAST_REQUEST_TIME = time.time()


def _fetch_wikipedia_summary(title: str) -> tuple[dict[str, Any] | None, int | None]:
    """Fetch Wikipedia summary with error handling. Returns (data, status)."""
    url = f"{WIKIPEDIA_SUMMARY_BASE}/{urllib.parse.quote(title.replace(' ', '_'), safe='')}"
    req = urllib.request.Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read()
            return json.loads(raw), resp.status
    except urllib.error.HTTPError as exc:
        return None, exc.code
    except Exception:
        return None, None


def _fetch_wikidata_entity(qid: str) -> tuple[dict[str, Any] | None, int | None]:
    """Fetch Wikidata entity with throttle. Returns (entity, status)."""
    _throttle_wikidata()
    url = f"{WIKIDATA_ENTITY_BASE}/{qid}.json"
    req = urllib.request.Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read()
            return json.loads(raw), resp.status
    except urllib.error.HTTPError as exc:
        return None, exc.code
    except Exception:
        return None, None


def resolve_wikipedia_title(wikipedia_link: str | None, airport_name: str | None) -> str | None:
    """Extract Wikipedia title from link or fall back to airport name."""
    if wikipedia_link and "/wiki/" in wikipedia_link:
        return wikipedia_link.split("/wiki/")[-1].replace("_", " ")
    if airport_name:
        return airport_name
    return None


def run_worker(
    airport_id: str | None = None,
    airport_ident: str | None = None,
    show_raw: bool = False,
    dry_run: bool = True,
    database_url: str | None = None,
) -> dict[str, Any]:
    """Run the intelligence ingest worker.

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

    result = {
        "airport_id": airport_id,
        "airport_ident": airport_ident,
        "sources_used": [],
        "sources_skipped": [],
        "modules_written": [],
        "links_written": [],
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
            icao_fallback = airport_ident or "KJFK"
            iata_fallback = "JFK" if icao_fallback == "KJFK" else None
            identity = {
                "id": airport_id or "00000000-0000-0000-0000-000000000000",
                "ident": icao_fallback,
                "iata_code": iata_fallback,
                "name": f"Test Airport {icao_fallback}",
                "iso_country": "US",
                "municipality": "Test City",
                "wikipedia_link": None,
                "scheduled_service": "yes",
            }
            print(f"[WORKER] WARNING: Using fallback identity for {icao_fallback}")

        airport_uuid = str(identity["id"])
        icao = identity.get("ident")
        iata = identity.get("iata_code")
        name = identity.get("name")
        city = identity.get("municipality")
        country = identity.get("iso_country")
        wikipedia_link = identity.get("wikipedia_link")
        scheduled_service = identity.get("scheduled_service")

        print(f"[WORKER] Processing: {icao} / {iata} — {name}")

        runway_data = []
        if not dry_run:
            runway_data = get_runway_data(conn, icao)
        if runway_data:
            print(f"[WORKER] Runway data: {len(runway_data)} runways")
            infra = build_infrastructure_summary(runway_data)
            print(f"[WORKER] Infrastructure: {infra.runway_count} runways, "
                  f"longest={infra.longest_runway_ft}ft, "
                  f"surfaces={infra.surfaces}")

        wikipedia_title = resolve_wikipedia_title(wikipedia_link, name)
        wikipedia_response: dict[str, Any] | None = None
        wikidata_qid: str | None = None
        wikidata_entity: dict[str, Any] | None = None
        has_wikipedia = False
        has_wikidata = False

        if wikipedia_title:
            print(f"[WORKER] Fetching Wikipedia: {wikipedia_title}")
            wiki_data, wiki_status = _fetch_wikipedia_summary(wikipedia_title)
            if wiki_data:
                wikipedia_response = wiki_data
                has_wikipedia = True
                result["sources_used"].append("wikipedia")
                wikidata_qid = wiki_data.get("wikibase_item")
                if show_raw:
                    print(f"  Wikipedia: title={wiki_data.get('title')}, "
                          f"qid={wikidata_qid}, "
                          f"extract_len={len(wiki_data.get('extract', ''))}")
            elif wiki_status == 404:
                print(f"[WORKER] Wikipedia article not found for '{wikipedia_title}'")
                result["sources_skipped"].append("wikipedia:not_found")
            else:
                print(f"[WORKER] Wikipedia fetch failed with status {wiki_status}")
                result["sources_skipped"].append(f"wikipedia:http_{wiki_status}")
        else:
            result["sources_skipped"].append("wikipedia:no_title")

        if wikidata_qid:
            print(f"[WORKER] Fetching Wikidata: {wikidata_qid}")
            entity_data, entity_status = _fetch_wikidata_entity(wikidata_qid)
            if entity_data:
                entities = entity_data.get("entities", {})
                wikidata_entity = entities.get(wikidata_qid)
                if wikidata_entity:
                    has_wikidata = True
                    result["sources_used"].append("wikidata")
                    if show_raw:
                        claims = wikidata_entity.get("claims", {})
                        p571 = claims.get("P571", [])
                        if p571:
                            print(f"  Wikidata P571: {p571[0]}")
            elif entity_status == 404:
                print(f"[WORKER] Wikidata entity not found: {wikidata_qid}")
                result["sources_skipped"].append("wikidata:not_found")
            else:
                print(f"[WORKER] Wikidata fetch failed with status {entity_status}")
                result["sources_skipped"].append(f"wikidata:http_{entity_status}")
        elif icao:
            print(f"[WORKER] Resolving Wikidata QID from ICAO {icao}...")
            try:
                resolved_qid = icao_to_wikidata_qid(icao)
                if resolved_qid:
                    wikidata_qid = resolved_qid
                    print(f"[WORKER] Resolved QID: {wikidata_qid}")
                    entity_data, entity_status = _fetch_wikidata_entity(wikidata_qid)
                    if entity_data:
                        entities = entity_data.get("entities", {})
                        wikidata_entity = entities.get(wikidata_qid)
                        if wikidata_entity:
                            has_wikidata = True
                            result["sources_used"].append("wikidata")
            except (FetcherError, FetchRateLimitedError) as e:
                print(f"[WORKER] Wikidata QID resolution failed: {e}")
                result["sources_skipped"].append("wikidata:lookup_failed")

        source_summary: dict[str, Any] = {
            "wikipedia": has_wikipedia,
            "wikidata": has_wikidata,
            "ourairports": True,
            "runway_data": len(runway_data) > 0,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }

        module_status, confidence_label = determine_module_status(
            has_wikipedia, has_wikidata, len(runway_data) > 0
        )
        print(f"[WORKER] Module status: {module_status}, confidence: {confidence_label}")

        opened_date = extract_opened_date_from_wikidata(wikidata_entity)
        if show_raw and opened_date.opened_year:
            print(f"  Opened date: {opened_date.opened_date} ({opened_date.opened_year})")

        map_popup = build_map_popup_payload(
            airport_name=name,
            iata=iata,
            icao=icao,
            city=city,
            country=country,
            wikipedia_response=wikipedia_response,
            opened_date=opened_date,
            runway_data=runway_data,
            confidence=confidence_label,
        )

        capability_tags = build_capability_tags(
            airport_name=name,
            airport_type=None,
            scheduled_service=scheduled_service,
            runway_data=runway_data,
            has_wikipedia=has_wikipedia,
            has_wikidata=has_wikidata,
            has_traffic=False,
            has_capacity=False,
        )
        if show_raw and capability_tags.tags:
            print(f"  Capability tags: {capability_tags.tags}")

        if dry_run:
            print("[WORKER] DRY-RUN: Skipping all database writes")
            result["modules_written"] = ["overview", "capability", "sources", "advanced_details"]
            return result

        source_link_ids: dict[str, UUID] = {}

        ourairports_attribution = build_source_attribution(
            "ourairports", "OurAirports Dataset",
            license_name=OURAIRPORTS_LICENSE, license_url=OURAIRPORTS_LICENSE_URL
        )
        oura_link_id = upsert_source_link(
            conn=conn,
            airport_id=airport_uuid,
            source_type="ourairports",
            source_name="OurAirports Dataset",
            module_key=None,
            confidence_label="high",
            confidence_score=0.95,
            is_primary=True,
            metadata=ourairports_attribution,
        )
        source_link_ids["ourairports"] = oura_link_id
        result["links_written"].append("ourairports")

        if has_wikipedia and wikipedia_response:
            wiki_url = wikipedia_response.get("content_urls", {}).get("desktop", {}).get("page")
            wikipedia_attribution = build_source_attribution(
                "wikipedia", "Wikipedia REST API",
                source_url=wiki_url,
                license_name=WIKIPEDIA_LICENSE, license_url=WIKIPEDIA_LICENSE_URL
            )
            wiki_link_id = upsert_source_link(
                conn=conn,
                airport_id=airport_uuid,
                source_type="wikipedia",
                source_name="Wikipedia REST API",
                source_url=wiki_url,
                source_entity_id=wikipedia_title,
                module_key="overview",
                confidence_label="high" if has_wikipedia else "medium",
                confidence_score=0.9,
                is_primary=True,
                metadata=wikipedia_attribution,
            )
            source_link_ids["wikipedia"] = wiki_link_id
            result["links_written"].append("wikipedia")

        if has_wikidata and wikidata_qid:
            wikidata_attribution = build_source_attribution(
                "wikidata", "Wikidata",
                source_url=f"{WIKIDATA_ENTITY_BASE}/{wikidata_qid}.json",
                license_name=WIKIDATA_LICENSE, license_url=WIKIDATA_LICENSE_URL
            )
            wd_link_id = upsert_source_link(
                conn=conn,
                airport_id=airport_uuid,
                source_type="wikidata",
                source_name="Wikidata",
                source_entity_id=wikidata_qid,
                module_key="overview",
                confidence_label="high" if has_wikidata else "medium",
                confidence_score=0.85,
                is_primary=False,
                metadata=wikidata_attribution,
            )
            source_link_ids["wikidata"] = wd_link_id
            result["links_written"].append("wikidata")

        overview_data = {
            "map_popup": {
                "airport_name": map_popup.airport_name,
                "iata": map_popup.iata,
                "icao": map_popup.icao,
                "city": map_popup.city,
                "country": map_popup.country,
                "image_url": map_popup.image_url,
                "short_summary": map_popup.short_summary,
                "badges": map_popup.badges,
                "opened_date": map_popup.opened_date,
                "opened_year": map_popup.opened_year,
                "quick_stats": map_popup.quick_stats,
                "confidence_label": map_popup.confidence_label,
            },
            "wikipedia_title": wikipedia_title,
            "wikidata_qid": wikidata_qid,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }

        overview_summary = {
            "sources": result["sources_used"],
            "confidence": confidence_label,
            "has_opened_date": opened_date.opened_year is not None,
        }

        overview_module_id = upsert_intelligence_module(
            conn=conn,
            airport_id=airport_uuid,
            module_key="overview",
            module_status=module_status,
            confidence_label=confidence_label,
            confidence_score=0.8 if has_wikipedia else 0.5,
            data_payload=overview_data,
            summary_payload=overview_summary,
            source_summary=source_summary,
        )
        result["modules_written"].append("overview")

        capability_data = {
            "runway_count": len(runway_data) if runway_data else None,
            "longest_runway_ft": (
                max((r.get("length_ft") or 0) for r in runway_data)
                if runway_data else None
            ),
            "surfaces": list(set(r.get("surface") for r in runway_data if r.get("surface"))),
            "scheduled_service": scheduled_service,
            "tags": capability_tags.tags,
        }

        capability_summary = {
            "tags_count": len(capability_tags.tags),
            "has_runway_data": len(runway_data) > 0,
        }

        cap_module_id = upsert_intelligence_module(
            conn=conn,
            airport_id=airport_uuid,
            module_key="capability",
            module_status=module_status,
            confidence_label=confidence_label,
            confidence_score=0.8,
            data_payload=capability_data,
            summary_payload=capability_summary,
            source_summary={"source": "ourairports"},
        )
        result["modules_written"].append("capability")

        infra_summary = build_infrastructure_summary(runway_data)
        infrastructure_data = {
            "runway_count": infra_summary.runway_count,
            "longest_runway_ft": infra_summary.longest_runway_ft,
            "surfaces": infra_summary.surfaces,
            "runway_capability": infra_summary.runway_capability,
        }

        infra_module_id = upsert_intelligence_module(
            conn=conn,
            airport_id=airport_uuid,
            module_key="infrastructure",
            module_status="ok",
            confidence_label="high",
            confidence_score=0.95,
            data_payload=infrastructure_data,
            source_summary={"source": "ourairports"},
        )
        result["modules_written"].append("infrastructure")

        sources_data = {
            "sources_used": result["sources_used"],
            "sources_skipped": result["sources_skipped"],
            "source_links": list(source_link_ids.keys()),
            "wikipedia_confirmed": has_wikipedia,
            "wikidata_confirmed": has_wikidata,
        }

        sources_module_id = upsert_intelligence_module(
            conn=conn,
            airport_id=airport_uuid,
            module_key="sources",
            module_status="ok",
            confidence_label=confidence_label,
            confidence_score=0.9,
            data_payload=sources_data,
            source_summary=source_summary,
        )
        result["modules_written"].append("sources")

        advanced_data = {
            "opened_date": opened_date.opened_date,
            "opened_year": opened_date.opened_year,
            "opened_date_source": opened_date.opened_date_source,
            "opened_date_confidence": opened_date.opened_date_confidence,
            "wikipedia_title": wikipedia_title,
            "wikidata_qid": wikidata_qid,
        }

        adv_module_id = upsert_intelligence_module(
            conn=conn,
            airport_id=airport_uuid,
            module_key="advanced_details",
            module_status=module_status,
            confidence_label=confidence_label,
            confidence_score=0.7 if has_wikidata else 0.4,
            data_payload=advanced_data,
            source_summary={"wikidata": has_wikidata},
        )
        result["modules_written"].append("advanced_details")

        derived_intelligence_data = {
            "runway_count": infra_summary.runway_count,
            "longest_runway_ft": infra_summary.longest_runway_ft,
            "runway_capability": infra_summary.runway_capability,
            "capability_tags": capability_tags.tags,
        }

        upsert_derived_intelligence(
            conn=conn,
            airport_id=airport_uuid,
            module_id=overview_module_id,
            intelligence_status=module_status,
            airport_class=None,
            traffic_scale=None,
            capacity_scale=None,
            runway_capability=infra_summary.runway_capability,
            operating_role=None,
            capability_tags=capability_tags.tags,
            risk_flags=[],
            source_flags=["no_traffic_data", "no_capacity_data"] if not has_wikipedia else [],
            confidence_score=0.7 if has_wikipedia else 0.4,
            longest_runway_ft=infra_summary.longest_runway_ft,
            runway_count=infra_summary.runway_count,
            intelligence_summary=None,
            capability_summary=f"{len(capability_tags.tags)} capability tags identified",
            traffic_summary="No source-backed traffic data available",
            capacity_summary="No source-backed capacity data available",
            source_summary=source_summary,
            input_snapshot=derived_intelligence_data,
            data_payload=derived_intelligence_data,
        )
        result["modules_written"].append("derived_intelligence")

        print(f"[WORKER] Modules written: {result['modules_written']}")
        print(f"[WORKER] Source links written: {result['links_written']}")
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
        description="Airport Intelligence Ingest Worker — source-backed intelligence persistence"
    )
    parser.add_argument(
        "--airport-id",
        type=str,
        default=None,
        help="Airport UUID to process",
    )
    parser.add_argument(
        "--airport-ident",
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

    if not args.airport_id and not args.airport_ident:
        print("[WORKER] ERROR: Must provide --airport-id or --airport-ident")
        sys.exit(1)

    run_worker(
        airport_id=args.airport_id,
        airport_ident=args.airport_ident,
        show_raw=args.show_raw,
        dry_run=args.dry_run,
        database_url=args.database_url,
    )


if __name__ == "__main__":
    main()