"""Report aviation coordinate quality and manual override readiness."""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, NamedTuple


DEFAULT_DATABASE_URL = (
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)
LAYER_ID = "layer_01_aviation"
OPTIONAL_TABLES = {
    "aviation_coordinate_quality_reviews",
    "aviation_coordinate_overrides",
}
LOW_PRECISION_TOLERANCE = 0.0000001


class Query(NamedTuple):
    sql: str
    params: tuple[Any, ...] = ()


def table_exists_query(table_name: str) -> Query:
    return Query(
        """
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = %s
        )
        """,
        (table_name,),
    )


def table_count_query(table_name: str) -> Query:
    if table_name not in OPTIONAL_TABLES:
        raise ValueError(f"unsupported optional table: {table_name}")
    return Query(f"SELECT COUNT(*) FROM {table_name}")


def active_overrides_count_query() -> Query:
    return Query(
        "SELECT COUNT(*) FROM aviation_coordinate_overrides WHERE active = %s",
        (True,),
    )


def scalar_count_query(sql: str, params: tuple[Any, ...] = ()) -> Query:
    return Query(sql, params)


def build_low_precision_candidates_query() -> Query:
    return Query(
        """
        SELECT COUNT(*)
        FROM aviation_airports
        WHERE layer_id = %s
          AND latitude_deg IS NOT NULL
          AND longitude_deg IS NOT NULL
          AND NOT (latitude_deg = 0 AND longitude_deg = 0)
          AND abs(latitude_deg - round(latitude_deg::numeric, 2)::double precision) <= %s
          AND abs(longitude_deg - round(longitude_deg::numeric, 2)::double precision) <= %s
        """,
        (LAYER_ID, LOW_PRECISION_TOLERANCE, LOW_PRECISION_TOLERANCE),
    )


def build_visual_review_candidates_query(limit: int) -> Query:
    checked_limit = max(1, min(limit, 100))
    return Query(
        """
        SELECT
          source_id,
          source_airport_id AS source_object_id,
          ident,
          name,
          type_source,
          category_normalized,
          latitude_deg,
          longitude_deg,
          iso_country,
          municipality
        FROM aviation_airports
        WHERE layer_id = %s
          AND (
            (latitude_deg = 0 AND longitude_deg = 0)
            OR category_normalized IN (%s, %s)
            OR municipality IS NULL
            OR btrim(municipality) = ''
            OR iso_country IS NULL
            OR btrim(iso_country) = ''
            OR (
              latitude_deg IS NOT NULL
              AND longitude_deg IS NOT NULL
              AND abs(latitude_deg - round(latitude_deg::numeric, 2)::double precision) <= %s
              AND abs(longitude_deg - round(longitude_deg::numeric, 2)::double precision) <= %s
            )
          )
        ORDER BY
          CASE WHEN latitude_deg = 0 AND longitude_deg = 0 THEN 0 ELSE 1 END,
          CASE WHEN category_normalized = %s THEN 0 ELSE 1 END,
          ident
        LIMIT %s
        """,
        (
            LAYER_ID,
            "heliport",
            "closed_or_abandoned",
            LOW_PRECISION_TOLERANCE,
            LOW_PRECISION_TOLERANCE,
            "heliport",
            checked_limit,
        ),
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


def table_exists(connection: Any, table_name: str) -> bool:
    return bool(fetch_scalar(connection, table_exists_query(table_name)))


def optional_count(connection: Any, table_name: str) -> int | None:
    if not table_exists(connection, table_name):
        return None
    return fetch_scalar(connection, table_count_query(table_name))


def optional_active_overrides_count(connection: Any) -> int | None:
    if not table_exists(connection, "aviation_coordinate_overrides"):
        return None
    return fetch_scalar(connection, active_overrides_count_query())


def run_report(database_url: str, limit: int) -> dict[str, Any]:
    import psycopg

    with psycopg.connect(database_url) as connection:
        return {
            "total_airports": fetch_scalar(
                connection,
                scalar_count_query(
                    "SELECT COUNT(*) FROM aviation_airports WHERE layer_id = %s",
                    (LAYER_ID,),
                ),
            ),
            "heliport_count": fetch_scalar(
                connection,
                scalar_count_query(
                    """
                    SELECT COUNT(*)
                    FROM aviation_airports
                    WHERE layer_id = %s
                      AND category_normalized = %s
                    """,
                    (LAYER_ID, "heliport"),
                ),
            ),
            "closed_airport_count": fetch_scalar(
                connection,
                scalar_count_query(
                    """
                    SELECT COUNT(*)
                    FROM aviation_airports
                    WHERE layer_id = %s
                      AND category_normalized = %s
                    """,
                    (LAYER_ID, "closed_or_abandoned"),
                ),
            ),
            "suspicious_zero_coordinates": fetch_scalar(
                connection,
                scalar_count_query(
                    """
                    SELECT COUNT(*)
                    FROM aviation_airports
                    WHERE layer_id = %s
                      AND latitude_deg = 0
                      AND longitude_deg = 0
                    """,
                    (LAYER_ID,),
                ),
            ),
            "low_coordinate_precision_candidates": fetch_scalar(
                connection,
                build_low_precision_candidates_query(),
            ),
            "missing_municipality_or_country": fetch_scalar(
                connection,
                scalar_count_query(
                    """
                    SELECT COUNT(*)
                    FROM aviation_airports
                    WHERE layer_id = %s
                      AND (
                        municipality IS NULL
                        OR btrim(municipality) = ''
                        OR iso_country IS NULL
                        OR btrim(iso_country) = ''
                      )
                    """,
                    (LAYER_ID,),
                ),
            ),
            "quality_review_count": optional_count(
                connection,
                "aviation_coordinate_quality_reviews",
            ),
            "active_override_count": optional_active_overrides_count(connection),
            "visual_review_candidates": fetch_rows(
                connection,
                build_visual_review_candidates_query(limit),
            ),
            "notes": [
                "The script is read-only and does not apply coordinate overrides.",
                "Low precision is inferred from normalized numeric values and is only a candidate signal.",
            ],
        }


def print_markdown(report: dict[str, Any]) -> None:
    print("# Aviation Coordinate Quality Report")
    print()
    print(f"- total_airports: {report['total_airports']}")
    print(f"- heliport_count: {report['heliport_count']}")
    print(f"- closed_airport_count: {report['closed_airport_count']}")
    print(f"- suspicious_zero_coordinates: {report['suspicious_zero_coordinates']}")
    print(
        "- low_coordinate_precision_candidates: "
        f"{report['low_coordinate_precision_candidates']}"
    )
    print(
        "- missing_municipality_or_country: "
        f"{report['missing_municipality_or_country']}"
    )
    print(f"- quality_review_count: {report['quality_review_count']}")
    print(f"- active_override_count: {report['active_override_count']}")
    print()
    print("## Sample Candidates For Visual Review")
    for item in report["visual_review_candidates"]:
        print(
            "- "
            f"{item['ident']} | {item['name']} | {item['category_normalized']} | "
            f"{item['latitude_deg']}, {item['longitude_deg']} | "
            f"{item['iso_country'] or '<blank>'} | "
            f"{item['municipality'] or '<blank>'}"
        )
    print()
    print("## Notes")
    for note in report["notes"]:
        print(f"- {note}")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Report aviation coordinate quality and override readiness"
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum sample candidate rows to print, capped at 100",
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
