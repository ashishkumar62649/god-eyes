"""Benchmark read-only airport detail SQL patterns for Layer 1 aviation."""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, NamedTuple


DEFAULT_DATABASE_URL = (
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)
LAYER_ID = "layer_01_aviation"
SOURCE_ID = "ourairports"
PREFERRED_AIRPORT_IDENTS = (
    "OMDB",
    "KORD",
    "00A",
    "00AA",
    "KDFW",
    "KJFK",
    "EHAM",
)
NAVAID_CASES = (
    (100000, 20),
    (100000, 50),
    (250000, 20),
    (250000, 50),
)


class Query(NamedTuple):
    sql: str
    params: tuple[Any, ...] = ()


class QueryCase(NamedTuple):
    name: str
    query: Query
    expectation: str


def clamp_limit(limit: int) -> int:
    return max(1, min(limit, 100))


def clamp_radius_meters(radius_meters: int) -> int:
    return max(1, min(radius_meters, 250000))


def build_airport_by_source_object_query(
    source_id: str,
    source_airport_id: str,
) -> Query:
    return Query(
        """
        SELECT
          id,
          layer_id,
          source_id,
          source_airport_id,
          ident,
          type_source,
          category_normalized,
          name,
          latitude_deg,
          longitude_deg,
          elevation_ft,
          iso_country,
          iso_region,
          municipality,
          scheduled_service,
          gps_code,
          iata_code,
          local_code,
          raw_object_id,
          geom,
          ST_X(geom) AS geom_longitude,
          ST_Y(geom) AS geom_latitude
        FROM aviation_airports
        WHERE layer_id = %s
          AND source_id = %s
          AND source_airport_id = %s
        LIMIT 1
        """,
        (LAYER_ID, source_id, source_airport_id),
    )


def build_airport_by_ident_query(airport_ident: str) -> Query:
    return Query(
        """
        SELECT
          id,
          layer_id,
          source_id,
          source_airport_id,
          ident,
          type_source,
          category_normalized,
          name,
          latitude_deg,
          longitude_deg,
          geom
        FROM aviation_airports
        WHERE layer_id = %s
          AND ident = %s
        ORDER BY source_id, source_airport_id
        LIMIT 1
        """,
        (LAYER_ID, airport_ident),
    )


def build_runways_query(airport: dict[str, Any], limit: int) -> Query:
    checked_limit = clamp_limit(limit)
    return Query(
        """
        SELECT
          source_runway_id,
          airport_ident,
          length_ft,
          width_ft,
          surface,
          lighted,
          closed,
          le_ident,
          he_ident,
          le_latitude_deg,
          le_longitude_deg,
          he_latitude_deg,
          he_longitude_deg
        FROM aviation_runways
        WHERE layer_id = %s
          AND source_id = %s
          AND airport_ident = %s
        ORDER BY length_ft DESC NULLS LAST, le_ident, he_ident, source_runway_id
        LIMIT %s
        """,
        (
            str(airport["layer_id"]),
            str(airport["source_id"]),
            str(airport["ident"]),
            checked_limit,
        ),
    )


def build_frequencies_query(airport: dict[str, Any], limit: int) -> Query:
    checked_limit = clamp_limit(limit)
    return Query(
        """
        SELECT
          source_frequency_id,
          airport_ident,
          type,
          description,
          frequency_mhz
        FROM aviation_airport_frequencies
        WHERE layer_id = %s
          AND source_id = %s
          AND airport_ident = %s
        ORDER BY type, frequency_mhz NULLS LAST, source_frequency_id
        LIMIT %s
        """,
        (
            str(airport["layer_id"]),
            str(airport["source_id"]),
            str(airport["ident"]),
            checked_limit,
        ),
    )


def build_nearby_navaids_query(
    airport: dict[str, Any],
    radius_meters: int,
    limit: int,
) -> Query:
    checked_limit = clamp_limit(limit)
    checked_radius = clamp_radius_meters(radius_meters)
    return Query(
        """
        WITH selected_airport AS (
          SELECT geom
          FROM aviation_airports
          WHERE layer_id = %s
            AND source_id = %s
            AND source_airport_id = %s
            AND geom IS NOT NULL
          LIMIT 1
        )
        SELECT
          n.source_navaid_id,
          n.ident,
          n.name,
          n.type,
          n.frequency_khz,
          n.iso_country,
          round((ST_Distance(sa.geom::geography, n.geom::geography) / 1000.0)::numeric, 3)
            AS distance_km
        FROM selected_airport sa
        JOIN aviation_navaids n
          ON n.layer_id = %s
         AND n.geom IS NOT NULL
         AND n.geom && ST_Expand(sa.geom, %s / 111000.0)
         AND ST_DWithin(sa.geom::geography, n.geom::geography, %s)
        ORDER BY distance_km, n.ident
        LIMIT %s
        """,
        (
            str(airport["layer_id"]),
            str(airport["source_id"]),
            str(airport["source_airport_id"]),
            LAYER_ID,
            checked_radius,
            checked_radius,
            checked_limit,
        ),
    )


def build_effective_coordinate_query(
    airport: dict[str, Any],
    override_table_exists: bool,
) -> Query:
    params = (
        str(airport["layer_id"]),
        str(airport["source_id"]),
        str(airport["source_airport_id"]),
    )
    if not override_table_exists:
        return Query(
            """
            SELECT
              a.source_id,
              a.source_airport_id,
              a.ident,
              a.latitude_deg AS source_latitude,
              a.longitude_deg AS source_longitude,
              a.latitude_deg AS effective_latitude,
              a.longitude_deg AS effective_longitude,
              false AS coordinate_overridden
            FROM aviation_airports a
            WHERE a.layer_id = %s
              AND a.source_id = %s
              AND a.source_airport_id = %s
            LIMIT 1
            """,
            params,
        )
    return Query(
        """
        SELECT
          a.source_id,
          a.source_airport_id,
          a.ident,
          a.latitude_deg AS source_latitude,
          a.longitude_deg AS source_longitude,
          COALESCE(o.override_latitude::double precision, a.latitude_deg)
            AS effective_latitude,
          COALESCE(o.override_longitude::double precision, a.longitude_deg)
            AS effective_longitude,
          (o.id IS NOT NULL) AS coordinate_overridden,
          o.confidence_score,
          o.reviewed_by,
          o.approved_by
        FROM aviation_airports a
        LEFT JOIN aviation_coordinate_overrides o
          ON o.layer_id = a.layer_id
         AND o.source_id = a.source_id
         AND o.source_object_id = a.source_airport_id
         AND o.object_type = 'airport'
         AND o.active = true
        WHERE a.layer_id = %s
          AND a.source_id = %s
          AND a.source_airport_id = %s
        LIMIT 1
        """,
        params,
    )


def build_index_query() -> Query:
    return Query(
        """
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = %s
          AND tablename IN (
            'aviation_airports',
            'aviation_runways',
            'aviation_airport_frequencies',
            'aviation_navaids',
            'aviation_coordinate_overrides',
            'aviation_coordinate_quality_reviews'
          )
        ORDER BY tablename, indexname
        """,
        ("public",),
    )


def build_table_exists_query(table_name: str) -> Query:
    return Query(
        """
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = %s
            AND table_name = %s
        )
        """,
        ("public", table_name),
    )


def build_category_sample_query(category: str, require_missing_detail: bool) -> Query:
    if require_missing_detail:
        detail_filter = """
          AND NOT EXISTS (
            SELECT 1 FROM aviation_runways r
            WHERE r.layer_id = a.layer_id
              AND r.source_id = a.source_id
              AND r.airport_ident = a.ident
          )
          AND NOT EXISTS (
            SELECT 1 FROM aviation_airport_frequencies f
            WHERE f.layer_id = a.layer_id
              AND f.source_id = a.source_id
              AND f.airport_ident = a.ident
          )
        """
    else:
        detail_filter = """
          AND EXISTS (
            SELECT 1 FROM aviation_runways r
            WHERE r.layer_id = a.layer_id
              AND r.source_id = a.source_id
              AND r.airport_ident = a.ident
          )
        """
    return Query(
        f"""
        SELECT layer_id, source_id, source_airport_id, ident, name,
               type_source, category_normalized, latitude_deg, longitude_deg, geom
        FROM aviation_airports a
        WHERE a.layer_id = %s
          AND a.category_normalized = %s
          {detail_filter}
        ORDER BY ident
        LIMIT 1
        """,
        (LAYER_ID, category),
    )


def fetch_rows(connection: Any, query: Query) -> list[dict[str, Any]]:
    with connection.cursor() as cur:
        cur.execute(query.sql, query.params)
        columns = [column.name for column in cur.description]
        return [dict(zip(columns, row, strict=True)) for row in cur.fetchall()]


def fetch_scalar(connection: Any, query: Query) -> bool:
    with connection.cursor() as cur:
        cur.execute(query.sql, query.params)
        return bool(cur.fetchone()[0])


def collect_node_types(plan_node: dict[str, Any]) -> list[str]:
    nodes = [str(plan_node.get("Node Type", ""))]
    for child in plan_node.get("Plans", []):
        nodes.extend(collect_node_types(child))
    return [node for node in nodes if node]


def collect_index_names(plan_node: dict[str, Any]) -> list[str]:
    names: list[str] = []
    if plan_node.get("Index Name"):
        names.append(str(plan_node["Index Name"]))
    for child in plan_node.get("Plans", []):
        names.extend(collect_index_names(child))
    return names


def summarize_plan(explain_json: list[dict[str, Any]]) -> dict[str, Any]:
    top = explain_json[0]
    plan = top["Plan"]
    node_types = collect_node_types(plan)
    return {
        "planning_time_ms": round(float(top.get("Planning Time", 0.0)), 3),
        "execution_time_ms": round(float(top.get("Execution Time", 0.0)), 3),
        "actual_rows": int(plan.get("Actual Rows", 0)),
        "node_types": node_types,
        "index_names": sorted(set(collect_index_names(plan))),
        "uses_index": any("Index" in node or "Bitmap" in node for node in node_types),
        "uses_sequential_scan": any(node == "Seq Scan" for node in node_types),
    }


def run_explain(connection: Any, query: Query) -> dict[str, Any]:
    with connection.cursor() as cur:
        cur.execute(
            "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query.sql,
            query.params,
        )
        return summarize_plan(cur.fetchone()[0])


def benchmark_query(connection: Any, case: QueryCase) -> dict[str, Any]:
    rows = fetch_rows(connection, case.query)
    return {
        "name": case.name,
        "expectation": case.expectation,
        "row_count": len(rows),
        "plan": run_explain(connection, case.query),
    }


def normalize_airport(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "layer_id": row["layer_id"],
        "source_id": row["source_id"],
        "source_airport_id": str(row["source_airport_id"]),
        "ident": row["ident"],
        "name": row["name"],
        "type_source": row["type_source"],
        "category_normalized": row["category_normalized"],
    }


def add_airport_sample(samples: list[dict[str, Any]], airport: dict[str, Any] | None) -> None:
    if airport is None:
        return
    if airport["source_airport_id"] in {item["source_airport_id"] for item in samples}:
        return
    samples.append(normalize_airport(airport))


def choose_sample_airports(
    connection: Any,
    limit: int,
    airport_ident: str | None,
) -> list[dict[str, Any]]:
    samples: list[dict[str, Any]] = []
    preferred = ((airport_ident,) if airport_ident else ()) + PREFERRED_AIRPORT_IDENTS
    for ident in preferred:
        rows = fetch_rows(connection, build_airport_by_ident_query(ident))
        add_airport_sample(samples, rows[0] if rows else None)
        if len(samples) >= clamp_limit(limit):
            return samples

    for query in (
        build_category_sample_query("international_or_major_airport", False),
        build_category_sample_query("heliport", True),
        build_category_sample_query("small_airfield", True),
    ):
        rows = fetch_rows(connection, query)
        add_airport_sample(samples, rows[0] if rows else None)
        if len(samples) >= clamp_limit(limit):
            return samples
    return samples


def airport_cases(
    airport: dict[str, Any],
    limit: int,
    override_table_exists: bool,
) -> list[QueryCase]:
    checked_limit = clamp_limit(limit)
    cases = [
        QueryCase(
            "airport_overview_by_source_object",
            build_airport_by_source_object_query(
                str(airport["source_id"]),
                str(airport["source_airport_id"]),
            ),
            "exact lookup by source_id and source_airport_id",
        ),
        QueryCase(
            "airport_overview_by_ident",
            build_airport_by_ident_query(str(airport["ident"])),
            "exact lookup by airport ident",
        ),
        QueryCase(
            "runways_for_airport",
            build_runways_query(airport, checked_limit),
            "runways by layer_id, source_id, airport_ident",
        ),
        QueryCase(
            "frequencies_for_airport",
            build_frequencies_query(airport, checked_limit),
            "airport frequencies by layer_id, source_id, airport_ident",
        ),
        QueryCase(
            "effective_coordinate_optional_override",
            build_effective_coordinate_query(airport, override_table_exists),
            "source coordinates with optional active override join",
        ),
    ]
    for radius_meters, navaid_limit in NAVAID_CASES:
        cases.append(
            QueryCase(
                f"nearby_navaids_{radius_meters // 1000}km_limit_{navaid_limit}",
                build_nearby_navaids_query(airport, radius_meters, navaid_limit),
                "bounded nearby navaid spatial lookup",
            )
        )
    return cases


def run_report(database_url: str, limit: int, airport_ident: str | None) -> dict[str, Any]:
    import psycopg

    with psycopg.connect(database_url) as connection:
        override_table_exists = fetch_scalar(
            connection,
            build_table_exists_query("aviation_coordinate_overrides"),
        )
        samples = choose_sample_airports(connection, limit, airport_ident)
        benchmarked_airports = []
        for airport in samples:
            benchmarked_airports.append(
                {
                    "airport": airport,
                    "cases": [
                        benchmark_query(connection, case)
                        for case in airport_cases(airport, limit, override_table_exists)
                    ],
                }
            )
        return {
            "database": "god_eyes_dev",
            "sample_airports": samples,
            "benchmarked_airports": benchmarked_airports,
            "indexes": fetch_rows(connection, build_index_query()),
            "coordinate_override_table_exists": override_table_exists,
            "index_recommendation": (
                "No new index migration is recommended from this benchmark. "
                "Existing source identity, ident, airport_ident, and navaid geom indexes "
                "support the measured first-pass endpoint SQL."
            ),
            "limitations": [
                "Local Docker timings are not production hardware measurements.",
                "Benchmark results are not production SLAs.",
                "Runway endpoint coordinates are often missing due to source data.",
                "No live operational NOTAM, METAR, TAF, or aircraft data is included.",
                "API endpoint implementation is outside this work order.",
            ],
        }


def print_summary(report: dict[str, Any]) -> None:
    print("# Airport Detail SQL Readiness")
    print()
    print(f"- coordinate_override_table_exists: {report['coordinate_override_table_exists']}")
    print(f"- sample_airports: {len(report['sample_airports'])}")
    print(f"- index_recommendation: {report['index_recommendation']}")
    print()
    for airport_result in report["benchmarked_airports"]:
        airport = airport_result["airport"]
        print(f"## {airport['ident']} - {airport['name']}")
        for case in airport_result["cases"]:
            plan = case["plan"]
            print(
                f"- {case['name']}: rows={case['row_count']}; "
                f"execution_ms={plan['execution_time_ms']}; "
                f"indexes={', '.join(plan['index_names']) or 'none'}"
            )


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Benchmark airport detail SQL readiness for Layer 1 aviation"
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Maximum sample airports and detail rows to benchmark, capped at 100",
    )
    parser.add_argument(
        "--airport-ident",
        help="Preferred airport ident to include first when present",
    )
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    try:
        report = run_report(args.database_url, args.limit, args.airport_ident)
    except Exception as exc:
        print(f"Airport detail SQL readiness failed: {exc}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True, default=str))
    else:
        print_summary(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
