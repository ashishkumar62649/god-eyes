"""Report aviation detail data readiness for future Object Intel work."""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, NamedTuple


DEFAULT_DATABASE_URL = (
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)
LAYER_ID = "layer_01_aviation"
DEFAULT_NAVAID_RADIUS_METERS = 50000

ALLOWED_DISTRIBUTIONS = {
    ("aviation_runways", "surface"),
    ("aviation_airport_frequencies", "type"),
    ("aviation_navaids", "type"),
}

AVIATION_DETAIL_TABLES = (
    "aviation_airports",
    "aviation_runways",
    "aviation_airport_frequencies",
    "aviation_navaids",
    "aviation_countries",
    "aviation_regions",
)


class Query(NamedTuple):
    sql: str
    params: tuple[Any, ...] = ()


def clamp_limit(limit: int) -> int:
    return max(1, min(limit, 100))


def scalar_query(sql: str, params: tuple[Any, ...] = ()) -> Query:
    return Query(sql, params)


def build_distribution_query(table_name: str, field_name: str, limit: int = 20) -> Query:
    if (table_name, field_name) not in ALLOWED_DISTRIBUTIONS:
        raise ValueError("unsupported distribution table or field")
    return Query(
        f"""
        SELECT COALESCE(NULLIF(btrim({field_name}::text), ''), '<blank>') AS value,
               COUNT(*) AS count
        FROM {table_name}
        WHERE layer_id = %s
        GROUP BY value
        ORDER BY count DESC, value
        LIMIT %s
        """,
        (LAYER_ID, clamp_limit(limit)),
    )


def build_runway_length_distribution_query() -> Query:
    return Query(
        """
        SELECT
          CASE
            WHEN length_ft IS NULL THEN '<blank>'
            WHEN length_ft < 2000 THEN '<2000_ft'
            WHEN length_ft < 4000 THEN '2000_3999_ft'
            WHEN length_ft < 7000 THEN '4000_6999_ft'
            WHEN length_ft < 10000 THEN '7000_9999_ft'
            ELSE '10000_ft_plus'
          END AS value,
          COUNT(*) AS count
        FROM aviation_runways
        WHERE layer_id = %s
        GROUP BY value
        ORDER BY count DESC, value
        """,
        (LAYER_ID,),
    )


def build_rich_airport_sample_query(limit: int) -> Query:
    checked_limit = clamp_limit(limit)
    return Query(
        """
        SELECT
          a.source_id,
          a.source_airport_id,
          a.ident,
          a.name,
          a.type_source,
          a.iso_country,
          a.municipality,
          COUNT(DISTINCT r.id) AS runway_count,
          COUNT(DISTINCT f.id) AS frequency_count
        FROM aviation_airports a
        LEFT JOIN aviation_runways r
          ON r.layer_id = a.layer_id
         AND r.source_id = a.source_id
         AND r.airport_ident = a.ident
        LEFT JOIN aviation_airport_frequencies f
          ON f.layer_id = a.layer_id
         AND f.source_id = a.source_id
         AND f.airport_ident = a.ident
        WHERE a.layer_id = %s
        GROUP BY a.source_id, a.source_airport_id, a.ident, a.name,
                 a.type_source, a.iso_country, a.municipality
        HAVING COUNT(DISTINCT r.id) > 0
           AND COUNT(DISTINCT f.id) > 0
        ORDER BY runway_count DESC, frequency_count DESC, a.ident
        LIMIT %s
        """,
        (LAYER_ID, checked_limit),
    )


def build_missing_detail_sample_query(limit: int) -> Query:
    checked_limit = clamp_limit(limit)
    return Query(
        """
        SELECT
          a.source_id,
          a.source_airport_id,
          a.ident,
          a.name,
          a.type_source,
          a.iso_country,
          a.municipality
        FROM aviation_airports a
        WHERE a.layer_id = %s
          AND NOT EXISTS (
            SELECT 1
            FROM aviation_runways r
            WHERE r.layer_id = a.layer_id
              AND r.source_id = a.source_id
              AND r.airport_ident = a.ident
          )
          AND NOT EXISTS (
            SELECT 1
            FROM aviation_airport_frequencies f
            WHERE f.layer_id = a.layer_id
              AND f.source_id = a.source_id
              AND f.airport_ident = a.ident
          )
        ORDER BY a.ident
        LIMIT %s
        """,
        (LAYER_ID, checked_limit),
    )


def build_nearby_navaid_sample_query(
    limit: int,
    radius_meters: int = DEFAULT_NAVAID_RADIUS_METERS,
) -> Query:
    checked_limit = clamp_limit(limit)
    checked_radius = max(1, min(radius_meters, 500000))
    return Query(
        """
        WITH airport_seed AS (
          SELECT ident, name, geom
          FROM aviation_airports
          WHERE layer_id = %s
            AND geom IS NOT NULL
          ORDER BY ident
          LIMIT %s
        )
        SELECT
          airport_seed.ident AS airport_ident,
          airport_seed.name AS airport_name,
          n.ident AS navaid_ident,
          n.name AS navaid_name,
          n.type AS navaid_type,
          round((ST_Distance(airport_seed.geom::geography, n.geom::geography))::numeric, 1)
            AS distance_meters
        FROM airport_seed
        JOIN LATERAL (
          SELECT ident, name, type, geom
          FROM aviation_navaids
          WHERE layer_id = %s
            AND geom IS NOT NULL
            AND ST_DWithin(airport_seed.geom::geography, geom::geography, %s)
          ORDER BY airport_seed.geom <-> geom
          LIMIT %s
        ) n ON true
        ORDER BY distance_meters, airport_seed.ident, n.ident
        LIMIT %s
        """,
        (LAYER_ID, checked_limit, LAYER_ID, checked_radius, checked_limit, checked_limit),
    )


def fetch_scalar(connection: Any, query: Query) -> int:
    with connection.cursor() as cur:
        cur.execute(query.sql, query.params)
        return int(cur.fetchone()[0])


def fetch_rows(connection: Any, query: Query) -> list[dict[str, Any]]:
    with connection.cursor() as cur:
        cur.execute(query.sql, query.params)
        columns = [column.name for column in cur.description]
        return [dict(zip(columns, row, strict=True)) for row in cur.fetchall()]


def fetch_distribution(connection: Any, query: Query) -> list[dict[str, Any]]:
    return [
        {"value": row["value"], "count": int(row["count"])}
        for row in fetch_rows(connection, query)
    ]


def run_report(database_url: str, limit: int) -> dict[str, Any]:
    import psycopg

    with psycopg.connect(database_url) as connection:
        counts = {
            "total_airports": fetch_scalar(
                connection,
                scalar_query(
                    "SELECT COUNT(*) FROM aviation_airports WHERE layer_id = %s",
                    (LAYER_ID,),
                ),
            ),
            "total_runways": fetch_scalar(
                connection,
                scalar_query(
                    "SELECT COUNT(*) FROM aviation_runways WHERE layer_id = %s",
                    (LAYER_ID,),
                ),
            ),
            "total_airport_frequencies": fetch_scalar(
                connection,
                scalar_query(
                    """
                    SELECT COUNT(*)
                    FROM aviation_airport_frequencies
                    WHERE layer_id = %s
                    """,
                    (LAYER_ID,),
                ),
            ),
            "total_navaids": fetch_scalar(
                connection,
                scalar_query(
                    "SELECT COUNT(*) FROM aviation_navaids WHERE layer_id = %s",
                    (LAYER_ID,),
                ),
            ),
        }

        runway_airport_count = fetch_scalar(
            connection,
            scalar_query(
                """
                SELECT COUNT(*)
                FROM aviation_airports a
                WHERE a.layer_id = %s
                  AND EXISTS (
                    SELECT 1
                    FROM aviation_runways r
                    WHERE r.layer_id = a.layer_id
                      AND r.source_id = a.source_id
                      AND r.airport_ident = a.ident
                  )
                """,
                (LAYER_ID,),
            ),
        )
        frequency_airport_count = fetch_scalar(
            connection,
            scalar_query(
                """
                SELECT COUNT(*)
                FROM aviation_airports a
                WHERE a.layer_id = %s
                  AND EXISTS (
                    SELECT 1
                    FROM aviation_airport_frequencies f
                    WHERE f.layer_id = a.layer_id
                      AND f.source_id = a.source_id
                      AND f.airport_ident = a.ident
                  )
                """,
                (LAYER_ID,),
            ),
        )

        detail_coverage = {
            "airports_with_at_least_one_runway": runway_airport_count,
            "airports_with_no_runway": counts["total_airports"] - runway_airport_count,
            "airports_with_at_least_one_frequency": frequency_airport_count,
            "airports_with_no_frequency": counts["total_airports"]
            - frequency_airport_count,
        }

        quality_checks = {
            "missing_runway_endpoint_coordinates": fetch_scalar(
                connection,
                scalar_query(
                    """
                    SELECT COUNT(*)
                    FROM aviation_runways
                    WHERE layer_id = %s
                      AND (
                        le_latitude_deg IS NULL
                        OR le_longitude_deg IS NULL
                        OR he_latitude_deg IS NULL
                        OR he_longitude_deg IS NULL
                      )
                    """,
                    (LAYER_ID,),
                ),
            ),
            "invalid_runway_endpoint_coordinates": fetch_scalar(
                connection,
                scalar_query(
                    """
                    SELECT COUNT(*)
                    FROM aviation_runways
                    WHERE layer_id = %s
                      AND (
                        le_latitude_deg < -90
                        OR le_latitude_deg > 90
                        OR he_latitude_deg < -90
                        OR he_latitude_deg > 90
                        OR le_longitude_deg < -180
                        OR le_longitude_deg > 180
                        OR he_longitude_deg < -180
                        OR he_longitude_deg > 180
                      )
                    """,
                    (LAYER_ID,),
                ),
            ),
            "missing_or_invalid_frequency_mhz": fetch_scalar(
                connection,
                scalar_query(
                    """
                    SELECT COUNT(*)
                    FROM aviation_airport_frequencies
                    WHERE layer_id = %s
                      AND (frequency_mhz IS NULL OR frequency_mhz <= 0)
                    """,
                    (LAYER_ID,),
                ),
            ),
            "orphaned_runways_by_airport_ident": fetch_scalar(
                connection,
                scalar_query(
                    """
                    SELECT COUNT(*)
                    FROM aviation_runways r
                    LEFT JOIN aviation_airports a
                      ON a.layer_id = r.layer_id
                     AND a.source_id = r.source_id
                     AND a.ident = r.airport_ident
                    WHERE r.layer_id = %s
                      AND r.airport_ident IS NOT NULL
                      AND a.id IS NULL
                    """,
                    (LAYER_ID,),
                ),
            ),
            "orphaned_frequencies_by_airport_ident": fetch_scalar(
                connection,
                scalar_query(
                    """
                    SELECT COUNT(*)
                    FROM aviation_airport_frequencies f
                    LEFT JOIN aviation_airports a
                      ON a.layer_id = f.layer_id
                     AND a.source_id = f.source_id
                     AND a.ident = f.airport_ident
                    WHERE f.layer_id = %s
                      AND f.airport_ident IS NOT NULL
                      AND a.id IS NULL
                    """,
                    (LAYER_ID,),
                ),
            ),
        }

        return {
            "counts": counts,
            "detail_coverage": detail_coverage,
            "runway_length_distribution": fetch_distribution(
                connection,
                build_runway_length_distribution_query(),
            ),
            "runway_surface_distribution": fetch_distribution(
                connection,
                build_distribution_query("aviation_runways", "surface"),
            ),
            "frequency_type_distribution": fetch_distribution(
                connection,
                build_distribution_query("aviation_airport_frequencies", "type"),
            ),
            "navaid_type_distribution": fetch_distribution(
                connection,
                build_distribution_query("aviation_navaids", "type"),
            ),
            "quality_checks": quality_checks,
            "sample_airports_with_rich_detail_data": fetch_rows(
                connection,
                build_rich_airport_sample_query(limit),
            ),
            "sample_airports_missing_detail_data": fetch_rows(
                connection,
                build_missing_detail_sample_query(limit),
            ),
            "sample_nearby_navaids": fetch_rows(
                connection,
                build_nearby_navaid_sample_query(limit),
            ),
            "relationship_model": {
                "runways": "aviation_runways.airport_ident joins aviation_airports.ident with matching source_id and layer_id.",
                "frequencies": "aviation_airport_frequencies.airport_ident joins aviation_airports.ident with matching source_id and layer_id.",
                "navaids": "Nearby navaids should be associated spatially from aviation_airports.geom to aviation_navaids.geom, optionally supplemented by associated_airport.",
                "source_identity": "Airport source identity is source_id plus source_airport_id; detail tables keep their own source ids and airport_ident references.",
            },
            "index_notes": [
                "Existing airport_ident indexes support runway and frequency detail lookup.",
                "Existing navaid geom GiST index supports nearby navaid search.",
                "Future measured work may consider composite source_id plus airport_ident indexes for detail endpoints.",
            ],
        }


def print_markdown(report: dict[str, Any]) -> None:
    print("# Aviation Detail Data Readiness")
    print()
    print("## Counts")
    for key, value in report["counts"].items():
        print(f"- {key}: {value}")
    print()
    print("## Detail Coverage")
    for key, value in report["detail_coverage"].items():
        print(f"- {key}: {value}")
    print()
    print("## Quality Checks")
    for key, value in report["quality_checks"].items():
        print(f"- {key}: {value}")
    print()
    print("## Runway Length Distribution")
    for item in report["runway_length_distribution"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Runway Surface Distribution")
    for item in report["runway_surface_distribution"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Frequency Type Distribution")
    for item in report["frequency_type_distribution"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Navaid Type Distribution")
    for item in report["navaid_type_distribution"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Rich Airport Samples")
    for item in report["sample_airports_with_rich_detail_data"]:
        print(
            "- "
            f"{item['ident']} | {item['name']} | "
            f"runways={item['runway_count']} | "
            f"frequencies={item['frequency_count']}"
        )
    print()
    print("## Missing Detail Samples")
    for item in report["sample_airports_missing_detail_data"]:
        print(f"- {item['ident']} | {item['name']} | {item['type_source']}")
    print()
    print("## Nearby Navaid Samples")
    for item in report["sample_nearby_navaids"]:
        print(
            "- "
            f"{item['airport_ident']} | {item['navaid_ident']} | "
            f"{item['navaid_type']} | {item['distance_meters']}m"
        )


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Report aviation detail data readiness for airport Object Intel"
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Maximum sample rows to print, capped at 100",
    )
    return parser


def main() -> None:
    args = build_arg_parser().parse_args()
    report = run_report(args.database_url, args.limit)
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True, default=str))
    else:
        print_markdown(report)


if __name__ == "__main__":
    main()
