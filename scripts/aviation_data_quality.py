"""Report normalized Layer 1 aviation airport data quality."""

from __future__ import annotations

import argparse
import json
import math
import os
from collections import Counter
from typing import Any, Iterable


DEFAULT_DATABASE_URL = (
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)
GEOM_TOLERANCE_DEGREES = 0.000001


def _is_blank(value: Any) -> bool:
    return value is None or str(value).strip() == ""


def _is_valid_lat_lon(latitude: Any, longitude: Any) -> bool:
    if latitude is None or longitude is None:
        return False
    return -90 <= float(latitude) <= 90 and -180 <= float(longitude) <= 180


def _geom_disagrees(row: dict[str, Any]) -> bool:
    latitude = row.get("latitude_deg")
    longitude = row.get("longitude_deg")
    geom_lat = row.get("geom_lat")
    geom_lon = row.get("geom_lon")
    if None in (latitude, longitude, geom_lat, geom_lon):
        return False
    return (
        abs(float(latitude) - float(geom_lat)) > GEOM_TOLERANCE_DEGREES
        or abs(float(longitude) - float(geom_lon)) > GEOM_TOLERANCE_DEGREES
    )


def analyze_coordinate_quality(rows: Iterable[dict[str, Any]]) -> dict[str, int]:
    report = {
        "total": 0,
        "missing_lat_lon": 0,
        "invalid_lat_lon_range": 0,
        "geom_null": 0,
        "lat_lon_geom_disagree": 0,
        "suspicious_zero_coordinates": 0,
    }
    for row in rows:
        report["total"] += 1
        latitude = row.get("latitude_deg")
        longitude = row.get("longitude_deg")

        if latitude is None or longitude is None:
            report["missing_lat_lon"] += 1
        elif not _is_valid_lat_lon(latitude, longitude):
            report["invalid_lat_lon_range"] += 1

        if row.get("geom_lat") is None or row.get("geom_lon") is None:
            report["geom_null"] += 1
        elif _geom_disagrees(row):
            report["lat_lon_geom_disagree"] += 1

        if latitude is not None and longitude is not None:
            if math.isclose(float(latitude), 0.0) and math.isclose(float(longitude), 0.0):
                report["suspicious_zero_coordinates"] += 1

    return report


def count_distribution(rows: Iterable[dict[str, Any]], field: str) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for row in rows:
        value = row.get(field)
        counts[str(value) if not _is_blank(value) else "<blank>"] += 1
    return dict(sorted(counts.items()))


def find_duplicate_values(rows: Iterable[dict[str, Any]], field: str) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for row in rows:
        value = row.get(field)
        if not _is_blank(value):
            counts[str(value)] += 1
    return {value: count for value, count in sorted(counts.items()) if count > 1}


def fetch_one(connection: Any, sql: str, params: tuple[Any, ...] = ()) -> int:
    with connection.cursor() as cur:
        cur.execute(sql, params)
        return int(cur.fetchone()[0])


def fetch_key_value_counts(connection: Any, sql: str) -> list[dict[str, Any]]:
    with connection.cursor() as cur:
        cur.execute(sql)
        return [{"value": row[0] or "<blank>", "count": int(row[1])} for row in cur.fetchall()]


def fetch_duplicate_summary(connection: Any, field: str) -> dict[str, Any]:
    if field not in {"ident", "iata_code"}:
        raise ValueError("unsupported duplicate field")
    with connection.cursor() as cur:
        cur.execute(
            f"""
            SELECT {field}, COUNT(*) AS count
            FROM aviation_airports
            WHERE {field} IS NOT NULL
              AND btrim({field}) <> ''
            GROUP BY {field}
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC, {field}
            LIMIT 20
            """
        )
        examples = [{"value": row[0], "count": int(row[1])} for row in cur.fetchall()]
        cur.execute(
            f"""
            SELECT COUNT(*)
            FROM (
              SELECT {field}
              FROM aviation_airports
              WHERE {field} IS NOT NULL
                AND btrim({field}) <> ''
              GROUP BY {field}
              HAVING COUNT(*) > 1
            ) duplicates
            """
        )
        duplicate_value_count = int(cur.fetchone()[0])
    return {
        "duplicate_value_count": duplicate_value_count,
        "top_examples": examples,
    }


def run_report(database_url: str) -> dict[str, Any]:
    import psycopg

    with psycopg.connect(database_url) as connection:
        coordinate_quality = {
            "total": fetch_one(connection, "SELECT COUNT(*) FROM aviation_airports"),
            "missing_lat_lon": fetch_one(
                connection,
                """
                SELECT COUNT(*)
                FROM aviation_airports
                WHERE latitude_deg IS NULL OR longitude_deg IS NULL
                """,
            ),
            "invalid_lat_lon_range": fetch_one(
                connection,
                """
                SELECT COUNT(*)
                FROM aviation_airports
                WHERE latitude_deg IS NOT NULL
                  AND longitude_deg IS NOT NULL
                  AND (
                    latitude_deg < -90 OR latitude_deg > 90
                    OR longitude_deg < -180 OR longitude_deg > 180
                  )
                """,
            ),
            "geom_null": fetch_one(
                connection,
                "SELECT COUNT(*) FROM aviation_airports WHERE geom IS NULL",
            ),
            "lat_lon_geom_disagree": fetch_one(
                connection,
                """
                SELECT COUNT(*)
                FROM aviation_airports
                WHERE latitude_deg IS NOT NULL
                  AND longitude_deg IS NOT NULL
                  AND geom IS NOT NULL
                  AND (
                    abs(latitude_deg - ST_Y(geom)) > %s
                    OR abs(longitude_deg - ST_X(geom)) > %s
                  )
                """,
                (GEOM_TOLERANCE_DEGREES, GEOM_TOLERANCE_DEGREES),
            ),
            "suspicious_zero_coordinates": fetch_one(
                connection,
                """
                SELECT COUNT(*)
                FROM aviation_airports
                WHERE latitude_deg = 0
                  AND longitude_deg = 0
                """,
            ),
        }

        return {
            "coordinate_quality": coordinate_quality,
            "category_distribution": fetch_key_value_counts(
                connection,
                """
                SELECT category_normalized, COUNT(*)
                FROM aviation_airports
                GROUP BY category_normalized
                ORDER BY COUNT(*) DESC, category_normalized
                """,
            ),
            "type_source_distribution": fetch_key_value_counts(
                connection,
                """
                SELECT type_source, COUNT(*)
                FROM aviation_airports
                GROUP BY type_source
                ORDER BY COUNT(*) DESC, type_source
                """,
            ),
            "scheduled_service_distribution": fetch_key_value_counts(
                connection,
                """
                SELECT scheduled_service, COUNT(*)
                FROM aviation_airports
                GROUP BY scheduled_service
                ORDER BY COUNT(*) DESC, scheduled_service
                """,
            ),
            "duplicate_idents": fetch_duplicate_summary(connection, "ident"),
            "duplicate_iata_codes": fetch_duplicate_summary(connection, "iata_code"),
            "closed_airports_count": fetch_one(
                connection,
                "SELECT COUNT(*) FROM aviation_airports WHERE category_normalized = %s",
                ("closed_or_abandoned",),
            ),
            "heliport_count": fetch_one(
                connection,
                "SELECT COUNT(*) FROM aviation_airports WHERE category_normalized = %s",
                ("heliport",),
            ),
            "water_landing_site_count": fetch_one(
                connection,
                "SELECT COUNT(*) FROM aviation_airports WHERE category_normalized = %s",
                ("water_landing_site",),
            ),
            "low_coordinate_precision_note": (
                "Not reliably detectable after normalization because source coordinate "
                "string precision is not preserved in double precision columns."
            ),
        }


def print_markdown(report: dict[str, Any]) -> None:
    print("# Aviation Data Quality Report")
    print()
    print("## Coordinate Quality")
    for key, value in report["coordinate_quality"].items():
        print(f"- {key}: {value}")
    print()
    print("## Category Distribution")
    for item in report["category_distribution"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Source Type Distribution")
    for item in report["type_source_distribution"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Scheduled Service Distribution")
    for item in report["scheduled_service_distribution"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Duplicate Ident Values")
    print(f"- duplicate value count: {report['duplicate_idents']['duplicate_value_count']}")
    for item in report["duplicate_idents"]["top_examples"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Duplicate IATA Codes")
    print(f"- duplicate value count: {report['duplicate_iata_codes']['duplicate_value_count']}")
    for item in report["duplicate_iata_codes"]["top_examples"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Notable Counts")
    print(f"- closed_airports_count: {report['closed_airports_count']}")
    print(f"- heliport_count: {report['heliport_count']}")
    print(f"- water_landing_site_count: {report['water_landing_site_count']}")
    print(f"- low_coordinate_precision_note: {report['low_coordinate_precision_note']}")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Report aviation_airports coordinate and identifier quality"
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    return parser


def main() -> None:
    args = build_arg_parser().parse_args()
    report = run_report(args.database_url)
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print_markdown(report)


if __name__ == "__main__":
    main()
