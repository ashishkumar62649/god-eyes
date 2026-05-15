"""Choose read-only airport detail QA samples from local aviation data."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Callable
from typing import Any, NamedTuple


DEFAULT_DATABASE_URL = (
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)
LAYER_ID = "layer_01_aviation"
SOURCE_ID = "ourairports"
NAVAID_RADIUS_METERS = 100000
PREFERRED_RICH_IDENTS = ("OMDB", "KDFW", "KORD", "EGLL", "KJFK", "EHAM")

OUTPUT_FIELDS = (
    "label",
    "source_id",
    "source_object_id",
    "ident",
    "iataCode",
    "name",
    "municipality",
    "iso_country",
    "category",
    "latitude",
    "longitude",
    "runway_count",
    "frequency_count",
    "nearby_navaid_count_100km",
    "notes",
)


class Query(NamedTuple):
    sql: str
    params: tuple[Any, ...] = ()


class SampleCase(NamedTuple):
    label: str
    notes: str
    query: Query


class SampleCaseDefinition(NamedTuple):
    label: str
    notes: str
    builder: Callable[[list[str], int], Query]


def clamp_limit(limit: int) -> int:
    return max(1, min(limit, 25))


def excluded_param(excluded_source_airport_ids: list[str]) -> list[str]:
    return [str(value) for value in excluded_source_airport_ids]


def build_candidate_query(
    where_sql: str,
    order_sql: str,
    params: tuple[Any, ...],
    excluded_source_airport_ids: list[str],
    limit: int,
) -> Query:
    checked_limit = clamp_limit(limit)
    return Query(
        f"""
        SELECT
          a.layer_id,
          a.source_id,
          a.source_airport_id,
          a.ident,
          a.iata_code,
          a.name,
          a.municipality,
          a.iso_country,
          a.type_source,
          a.category_normalized,
          a.latitude_deg,
          a.longitude_deg,
          COALESCE(r.runway_count, 0)::integer AS runway_count,
          COALESCE(r.missing_endpoint_count, 0)::integer AS missing_endpoint_count,
          COALESCE(r.complete_endpoint_count, 0)::integer AS complete_endpoint_count,
          COALESCE(f.frequency_count, 0)::integer AS frequency_count,
          COALESCE(n.nearby_navaid_count_100km, 0)::integer
            AS nearby_navaid_count_100km
        FROM aviation_airports a
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) AS runway_count,
            COUNT(*) FILTER (
              WHERE le_latitude_deg IS NULL
                 OR le_longitude_deg IS NULL
                 OR he_latitude_deg IS NULL
                 OR he_longitude_deg IS NULL
            ) AS missing_endpoint_count,
            COUNT(*) FILTER (
              WHERE le_latitude_deg IS NOT NULL
                AND le_longitude_deg IS NOT NULL
                AND he_latitude_deg IS NOT NULL
                AND he_longitude_deg IS NOT NULL
            ) AS complete_endpoint_count
          FROM aviation_runways r
          WHERE r.layer_id = a.layer_id
            AND r.source_id = a.source_id
            AND r.airport_ident = a.ident
        ) r ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS frequency_count
          FROM aviation_airport_frequencies f
          WHERE f.layer_id = a.layer_id
            AND f.source_id = a.source_id
            AND f.airport_ident = a.ident
        ) f ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS nearby_navaid_count_100km
          FROM aviation_navaids nav
          WHERE nav.layer_id = a.layer_id
            AND a.geom IS NOT NULL
            AND nav.geom IS NOT NULL
            AND nav.geom && ST_Expand(a.geom, %s / 111000.0)
            AND ST_DWithin(a.geom::geography, nav.geom::geography, %s)
        ) n ON true
        WHERE a.layer_id = %s
          AND a.source_id = %s
          AND a.source_airport_id <> ALL(%s::text[])
          AND {where_sql}
        ORDER BY {order_sql}
        LIMIT %s
        """,
        (
            NAVAID_RADIUS_METERS,
            NAVAID_RADIUS_METERS,
            LAYER_ID,
            SOURCE_ID,
            excluded_param(excluded_source_airport_ids),
            *params,
            checked_limit,
        ),
    )


def build_preferred_rich_detail_query(
    excluded_source_airport_ids: list[str],
    limit: int,
) -> Query:
    preferred = list(PREFERRED_RICH_IDENTS)
    return build_candidate_query(
        "a.ident = ANY(%s::text[]) AND r.runway_count > 0 AND f.frequency_count > 0",
        "array_position(%s::text[], a.ident), r.runway_count DESC, f.frequency_count DESC",
        (preferred, preferred),
        excluded_source_airport_ids,
        limit,
    )


def build_runways_no_frequencies_query(
    excluded_source_airport_ids: list[str],
    limit: int,
) -> Query:
    return build_candidate_query(
        "r.runway_count > 0 AND f.frequency_count = 0",
        "r.runway_count DESC, a.ident",
        (),
        excluded_source_airport_ids,
        limit,
    )


def build_frequencies_query(
    excluded_source_airport_ids: list[str],
    limit: int,
) -> Query:
    return build_candidate_query(
        "f.frequency_count > 0",
        "f.frequency_count DESC, r.runway_count DESC, a.ident",
        (),
        excluded_source_airport_ids,
        limit,
    )


def build_sparse_detail_query(
    excluded_source_airport_ids: list[str],
    limit: int,
) -> Query:
    return build_candidate_query(
        "r.runway_count = 0 AND f.frequency_count = 0",
        "a.ident",
        (),
        excluded_source_airport_ids,
        limit,
    )


def build_category_query(
    category_normalized: str,
    excluded_source_airport_ids: list[str],
    limit: int,
) -> Query:
    return build_candidate_query(
        "a.category_normalized = %s",
        "r.runway_count DESC, f.frequency_count DESC, a.ident",
        (category_normalized,),
        excluded_source_airport_ids,
        limit,
    )


def build_many_navaids_query(
    excluded_source_airport_ids: list[str],
    limit: int,
) -> Query:
    return build_candidate_query(
        "a.geom IS NOT NULL",
        "n.nearby_navaid_count_100km DESC, r.runway_count DESC, a.ident",
        (),
        excluded_source_airport_ids,
        limit,
    )


def build_few_navaids_query(
    excluded_source_airport_ids: list[str],
    limit: int,
) -> Query:
    return build_candidate_query(
        "a.geom IS NOT NULL",
        "n.nearby_navaid_count_100km ASC, a.ident",
        (),
        excluded_source_airport_ids,
        limit,
    )


def build_missing_runway_endpoint_query(
    excluded_source_airport_ids: list[str],
    limit: int,
) -> Query:
    return build_candidate_query(
        "r.missing_endpoint_count > 0",
        "r.missing_endpoint_count DESC, r.runway_count DESC, a.ident",
        (),
        excluded_source_airport_ids,
        limit,
    )


def build_complete_runway_endpoint_query(
    excluded_source_airport_ids: list[str],
    limit: int,
) -> Query:
    return build_candidate_query(
        "r.complete_endpoint_count > 0",
        "r.complete_endpoint_count DESC, r.runway_count DESC, a.ident",
        (),
        excluded_source_airport_ids,
        limit,
    )


def fetch_rows(connection: Any, query: Query) -> list[dict[str, Any]]:
    with connection.cursor() as cur:
        cur.execute(query.sql, query.params)
        columns = [column.name for column in cur.description]
        return [dict(zip(columns, row, strict=True)) for row in cur.fetchall()]


def normalize_sample(label: str, notes: str, row: dict[str, Any]) -> dict[str, Any]:
    return {
        "label": label,
        "source_id": row["source_id"],
        "source_object_id": str(row["source_airport_id"]),
        "ident": row["ident"],
        "iataCode": row["iata_code"],
        "name": row["name"],
        "municipality": row["municipality"],
        "iso_country": row["iso_country"],
        "category": row["category_normalized"],
        "type_source": row["type_source"],
        "latitude": row["latitude_deg"],
        "longitude": row["longitude_deg"],
        "runway_count": int(row["runway_count"]),
        "frequency_count": int(row["frequency_count"]),
        "nearby_navaid_count_100km": int(row["nearby_navaid_count_100km"]),
        "missing_runway_endpoint_count": int(row["missing_endpoint_count"]),
        "complete_runway_endpoint_count": int(row["complete_endpoint_count"]),
        "notes": notes,
    }


def sample_case_definitions() -> list[SampleCaseDefinition]:
    return [
        SampleCaseDefinition(
            "major_international_rich_detail",
            "Major airport expected to exercise overview, runways, frequencies, and nearby navaids.",
            build_preferred_rich_detail_query,
        ),
        SampleCaseDefinition(
            "runways_no_frequencies",
            "Airport with runway records but no frequency rows; useful for empty frequency section QA.",
            build_runways_no_frequencies_query,
        ),
        SampleCaseDefinition(
            "has_frequencies",
            "Airport with frequency rows; useful for Object Intel frequency display QA.",
            build_frequencies_query,
        ),
        SampleCaseDefinition(
            "sparse_no_runway_or_frequency",
            "Airport with sparse detail data; detail sections should render as empty states.",
            build_sparse_detail_query,
        ),
        SampleCaseDefinition(
            "heliport",
            "Heliport category sample for non-airport marker and Object Intel behavior.",
            lambda excluded, limit: build_category_query("heliport", excluded, limit),
        ),
        SampleCaseDefinition(
            "small_airfield",
            "Small airfield sample for lower-detail airport behavior.",
            lambda excluded, limit: build_category_query("small_airfield", excluded, limit),
        ),
        SampleCaseDefinition(
            "many_nearby_navaids",
            "Airport with many nearby navaids within 100 km; validates bounded navaid list behavior.",
            build_many_navaids_query,
        ),
        SampleCaseDefinition(
            "few_or_no_nearby_navaids",
            "Airport with few or no nearby navaids within 100 km; validates sparse navaid behavior.",
            build_few_navaids_query,
        ),
        SampleCaseDefinition(
            "missing_runway_endpoint_coordinates",
            "Airport with at least one runway missing endpoint coordinates; UI should not depend on them.",
            build_missing_runway_endpoint_query,
        ),
        SampleCaseDefinition(
            "complete_runway_endpoint_coordinates",
            "Airport with runway endpoint coordinates present for at least one runway.",
            build_complete_runway_endpoint_query,
        ),
    ]


def sample_cases(excluded_source_airport_ids: list[str], limit: int) -> list[SampleCase]:
    return [
        SampleCase(definition.label, definition.notes, definition.builder(excluded_source_airport_ids, limit))
        for definition in sample_case_definitions()
    ]


def choose_samples(connection: Any, limit: int) -> list[dict[str, Any]]:
    samples: list[dict[str, Any]] = []
    excluded: list[str] = []
    remaining = clamp_limit(limit)
    for definition in sample_case_definitions():
        if len(samples) >= remaining:
            return samples
        rows = fetch_rows(connection, definition.builder(excluded, remaining))
        if not rows:
            continue
        row = rows[0]
        excluded.append(str(row["source_airport_id"]))
        samples.append(normalize_sample(definition.label, definition.notes, row))
    return samples


def run_report(database_url: str, limit: int) -> dict[str, Any]:
    import psycopg

    with psycopg.connect(database_url) as connection:
        samples = choose_samples(connection, limit)
    return {
        "database": database_url.rsplit("/", 1)[-1],
        "layer_id": LAYER_ID,
        "source_id": SOURCE_ID,
        "nearby_navaid_radius_km": int(NAVAID_RADIUS_METERS / 1000),
        "sample_count": len(samples),
        "output_fields": list(OUTPUT_FIELDS),
        "samples": samples,
        "limitations": [
            "Samples are selected from the local Docker database state.",
            "They are QA fixtures by source identity, not guaranteed permanent business rules.",
            "No API route or frontend display is implemented by this script.",
            "No live operational data is included.",
        ],
    }


def print_text_report(report: dict[str, Any]) -> None:
    print("Airport Detail QA Samples")
    print(f"Database: {report['database']}")
    print(f"Samples: {report['sample_count']}")
    print(f"Nearby navaid radius: {report['nearby_navaid_radius_km']} km")
    print()
    for sample in report["samples"]:
        place = ", ".join(
            str(part)
            for part in (sample.get("municipality"), sample.get("iso_country"))
            if part
        )
        print(f"- {sample['label']}: {sample['ident']} {sample['name']}")
        print(f"  source_object_id: {sample['source_object_id']}")
        print(f"  place/category: {place or '<unknown>'} / {sample['category']}")
        print(
            "  counts: "
            f"runways={sample['runway_count']}, "
            f"frequencies={sample['frequency_count']}, "
            f"navaids_100km={sample['nearby_navaid_count_100km']}"
        )
        print(f"  notes: {sample['notes']}")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Select read-only airport detail QA samples.",
    )
    parser.add_argument("--json", action="store_true", help="Emit structured JSON.")
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Maximum samples to return, clamped to 1..25.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    database_url = os.getenv("GOD_EYES_DATABASE_URL", DEFAULT_DATABASE_URL)
    try:
        report = run_report(database_url, args.limit)
    except Exception as exc:
        print(f"Unable to query aviation QA samples: {exc}", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True, default=str))
    else:
        print_text_report(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
