"""Audit Layer 1 aviation category distribution and water/seaplane mapping."""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, NamedTuple


DEFAULT_DATABASE_URL = (
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)
LAYER_ID = "layer_01_aviation"
MAJOR_CATEGORY = "international_or_major_airport"
WATER_CATEGORY = "water_landing_site"

DISPLAY_CATEGORY_MAPPING = {
    "international_or_major_airport": "Major / International",
    "regional_or_domestic_airport": "Regional / Domestic",
    "small_airfield": "Local / Small Airfields",
    "heliport": "Heliports",
    "water_landing_site": "Water / Seaplane",
    "balloonport": "Balloonports",
    "unknown": "Unknown / Unclassified",
    "closed_or_abandoned": "Closed / Historical",
}

SOURCE_TYPE_MAPPING = {
    "large_airport": "international_or_major_airport",
    "medium_airport": "regional_or_domestic_airport",
    "small_airport": "small_airfield",
    "heliport": "heliport",
    "seaplane_base": "water_landing_site",
    "balloonport": "balloonport",
    "closed": "closed_or_abandoned",
    "closed_airport": "closed_or_abandoned",
}

COUNTRIES_FOR_MAJOR_LIST = ("IN", "CN")
SOURCE_PATTERN_TERMS = ("seaplane", "water", "floatplane", "float")


class Query(NamedTuple):
    sql: str
    params: tuple[Any, ...]


def _validate_limit(limit: int, *, maximum: int) -> int:
    if limit < 1:
        raise ValueError("limit must be positive")
    return min(limit, maximum)


def _validate_country_code(country_code: str) -> str:
    normalized = country_code.strip().upper()
    if len(normalized) != 2 or not normalized.isalpha():
        raise ValueError("country code must be a two-letter ISO code")
    return normalized


def _validate_category(category: str) -> str:
    if category not in DISPLAY_CATEGORY_MAPPING:
        raise ValueError(f"unknown normalized category: {category}")
    return category


def build_total_count_query() -> Query:
    return Query(
        "SELECT COUNT(*) FROM aviation_airports WHERE layer_id = %s",
        (LAYER_ID,),
    )


def build_category_counts_query() -> Query:
    return Query(
        """
        SELECT category_normalized, COUNT(*)
        FROM aviation_airports
        WHERE layer_id = %s
        GROUP BY category_normalized
        ORDER BY COUNT(*) DESC, category_normalized
        """,
        (LAYER_ID,),
    )


def build_type_source_counts_query() -> Query:
    return Query(
        """
        SELECT source_id, type_source, category_normalized, COUNT(*)
        FROM aviation_airports
        WHERE layer_id = %s
        GROUP BY source_id, type_source, category_normalized
        ORDER BY COUNT(*) DESC, source_id, type_source, category_normalized
        """,
        (LAYER_ID,),
    )


def build_major_airport_country_counts_query(limit: int) -> Query:
    checked_limit = _validate_limit(limit, maximum=250)
    return Query(
        """
        SELECT iso_country, COUNT(*)
        FROM aviation_airports
        WHERE layer_id = %s
          AND category_normalized = %s
        GROUP BY iso_country
        ORDER BY COUNT(*) DESC, iso_country
        LIMIT %s
        """,
        (LAYER_ID, MAJOR_CATEGORY, checked_limit),
    )


def build_country_major_airports_query(country_code: str, limit: int) -> Query:
    checked_country = _validate_country_code(country_code)
    checked_limit = _validate_limit(limit, maximum=250)
    return Query(
        """
        SELECT source_airport_id, ident, name, iso_country, iso_region,
               municipality, iata_code, scheduled_service, type_source,
               category_normalized
        FROM aviation_airports
        WHERE layer_id = %s
          AND category_normalized = %s
          AND iso_country = %s
        ORDER BY scheduled_service DESC NULLS LAST, iata_code NULLS LAST,
                 ident, source_airport_id
        LIMIT %s
        """,
        (LAYER_ID, MAJOR_CATEGORY, checked_country, checked_limit),
    )


def build_country_major_count_query(country_code: str) -> Query:
    checked_country = _validate_country_code(country_code)
    return Query(
        """
        SELECT COUNT(*)
        FROM aviation_airports
        WHERE layer_id = %s
          AND category_normalized = %s
          AND iso_country = %s
        """,
        (LAYER_ID, MAJOR_CATEGORY, checked_country),
    )


def build_water_country_counts_query(limit: int) -> Query:
    checked_limit = _validate_limit(limit, maximum=250)
    return Query(
        """
        SELECT a.iso_country, COALESCE(c.name, '<unknown>') AS country_name,
               COALESCE(c.continent, '<blank>') AS continent, COUNT(*)
        FROM aviation_airports a
        LEFT JOIN aviation_countries c
          ON c.layer_id = a.layer_id
         AND c.source_id = a.source_id
         AND c.code = a.iso_country
        WHERE a.layer_id = %s
          AND a.category_normalized = %s
        GROUP BY a.iso_country, c.name, c.continent
        ORDER BY COUNT(*) DESC, a.iso_country
        LIMIT %s
        """,
        (LAYER_ID, WATER_CATEGORY, checked_limit),
    )


def build_asia_water_country_counts_query(limit: int) -> Query:
    checked_limit = _validate_limit(limit, maximum=250)
    return Query(
        """
        SELECT a.iso_country, COALESCE(c.name, '<unknown>') AS country_name,
               COUNT(*)
        FROM aviation_airports a
        LEFT JOIN aviation_countries c
          ON c.layer_id = a.layer_id
         AND c.source_id = a.source_id
         AND c.code = a.iso_country
        WHERE a.layer_id = %s
          AND a.category_normalized = %s
          AND c.continent = %s
        GROUP BY a.iso_country, c.name
        ORDER BY COUNT(*) DESC, a.iso_country
        LIMIT %s
        """,
        (LAYER_ID, WATER_CATEGORY, "AS", checked_limit),
    )


def build_water_region_counts_query(limit: int) -> Query:
    checked_limit = _validate_limit(limit, maximum=250)
    return Query(
        """
        SELECT iso_country, iso_region, COUNT(*)
        FROM aviation_airports
        WHERE layer_id = %s
          AND category_normalized = %s
        GROUP BY iso_country, iso_region
        ORDER BY COUNT(*) DESC, iso_country, iso_region
        LIMIT %s
        """,
        (LAYER_ID, WATER_CATEGORY, checked_limit),
    )


def build_source_pattern_query(limit: int) -> Query:
    checked_limit = _validate_limit(limit, maximum=100)
    return Query(
        """
        SELECT source_airport_id, ident, name, iso_country, iso_region,
               type_source, category_normalized, keywords
        FROM aviation_airports
        WHERE layer_id = %s
          AND (
            type_source ILIKE %s
            OR name ILIKE %s
            OR COALESCE(keywords, '') ILIKE %s
            OR type_source ILIKE %s
            OR name ILIKE %s
            OR COALESCE(keywords, '') ILIKE %s
            OR type_source ILIKE %s
            OR name ILIKE %s
            OR COALESCE(keywords, '') ILIKE %s
            OR type_source ILIKE %s
            OR name ILIKE %s
            OR COALESCE(keywords, '') ILIKE %s
          )
        ORDER BY
          CASE WHEN category_normalized = %s THEN 0 ELSE 1 END,
          iso_country, iso_region, ident, source_airport_id
        LIMIT %s
        """,
        (
            LAYER_ID,
            "%seaplane%",
            "%seaplane%",
            "%seaplane%",
            "%water%",
            "%water%",
            "%water%",
            "%floatplane%",
            "%floatplane%",
            "%floatplane%",
            "%float%",
            "%float%",
            "%float%",
            WATER_CATEGORY,
            checked_limit,
        ),
    )


def build_source_pattern_type_counts_query() -> Query:
    return Query(
        """
        SELECT type_source, category_normalized, COUNT(*)
        FROM aviation_airports
        WHERE layer_id = %s
          AND (
            type_source ILIKE %s
            OR name ILIKE %s
            OR COALESCE(keywords, '') ILIKE %s
            OR type_source ILIKE %s
            OR name ILIKE %s
            OR COALESCE(keywords, '') ILIKE %s
            OR type_source ILIKE %s
            OR name ILIKE %s
            OR COALESCE(keywords, '') ILIKE %s
            OR type_source ILIKE %s
            OR name ILIKE %s
            OR COALESCE(keywords, '') ILIKE %s
          )
        GROUP BY type_source, category_normalized
        ORDER BY COUNT(*) DESC, type_source, category_normalized
        """,
        (
            LAYER_ID,
            "%seaplane%",
            "%seaplane%",
            "%seaplane%",
            "%water%",
            "%water%",
            "%water%",
            "%floatplane%",
            "%floatplane%",
            "%floatplane%",
            "%float%",
            "%float%",
            "%float%",
        ),
    )


def build_category_sample_query(category: str, limit: int) -> Query:
    checked_category = _validate_category(category)
    checked_limit = _validate_limit(limit, maximum=25)
    return Query(
        """
        SELECT source_airport_id, ident, name, iso_country, iso_region,
               municipality, iata_code, type_source, category_normalized
        FROM aviation_airports
        WHERE layer_id = %s
          AND category_normalized = %s
        ORDER BY
          CASE WHEN iata_code IS NULL THEN 1 ELSE 0 END,
          scheduled_service DESC NULLS LAST,
          iso_country, ident, source_airport_id
        LIMIT %s
        """,
        (LAYER_ID, checked_category, checked_limit),
    )


def build_closed_count_query() -> Query:
    return Query(
        """
        SELECT COUNT(*)
        FROM aviation_airports
        WHERE layer_id = %s
          AND category_normalized = %s
        """,
        (LAYER_ID, "closed_or_abandoned"),
    )


def fetch_scalar(connection: Any, query: Query) -> int:
    with connection.cursor() as cur:
        cur.execute(query.sql, query.params)
        row = cur.fetchone()
        if isinstance(row, dict):
            return int(next(iter(row.values())))
        return int(row[0])


def fetch_rows(connection: Any, query: Query) -> list[dict[str, Any]]:
    with connection.cursor() as cur:
        cur.execute(query.sql, query.params)
        return [dict(row) for row in cur.fetchall()]


def _normalize_counts(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            key: ("<blank>" if value is None else value)
            for key, value in row.items()
        }
        for row in rows
    ]


def run_report(
    database_url: str,
    *,
    country_limit: int = 25,
    region_limit: int = 25,
    sample_limit: int = 3,
    pattern_limit: int = 30,
    country_major_limit: int = 100,
) -> dict[str, Any]:
    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        category_counts = _normalize_counts(fetch_rows(connection, build_category_counts_query()))
        type_source_counts = _normalize_counts(
            fetch_rows(connection, build_type_source_counts_query())
        )
        category_count_map = {
            str(row["category_normalized"]): int(row["count"]) for row in category_counts
        }
        expected_category_counts = {
            category: category_count_map.get(category, 0)
            for category in DISPLAY_CATEGORY_MAPPING
        }
        source_type_map = {str(row["type_source"]) for row in type_source_counts}
        db_categories = set(category_count_map)

        major_airports_by_country = _normalize_counts(
            fetch_rows(connection, build_major_airport_country_counts_query(country_limit))
        )
        major_country_evidence = {}
        for country_code in COUNTRIES_FOR_MAJOR_LIST:
            count = fetch_scalar(connection, build_country_major_count_query(country_code))
            rows = _normalize_counts(
                fetch_rows(
                    connection,
                    build_country_major_airports_query(country_code, country_major_limit),
                )
            )
            major_country_evidence[country_code] = {
                "count": count,
                "returned": len(rows),
                "limit": country_major_limit,
                "airports": rows,
            }

        category_samples = {}
        for category in DISPLAY_CATEGORY_MAPPING:
            if expected_category_counts[category] == 0:
                category_samples[category] = []
            else:
                category_samples[category] = _normalize_counts(
                    fetch_rows(connection, build_category_sample_query(category, sample_limit))
                )

        return {
            "total_airports": fetch_scalar(connection, build_total_count_query()),
            "category_counts": category_counts,
            "expected_category_counts": expected_category_counts,
            "type_source_counts": type_source_counts,
            "source_type_mapping": SOURCE_TYPE_MAPPING,
            "source_type_values": sorted(source_type_map),
            "major_airports_by_country": major_airports_by_country,
            "india_china_major_airports": major_country_evidence,
            "water_landing_sites_by_country": _normalize_counts(
                fetch_rows(connection, build_water_country_counts_query(country_limit))
            ),
            "asia_water_landing_sites_by_country": _normalize_counts(
                fetch_rows(connection, build_asia_water_country_counts_query(country_limit))
            ),
            "water_landing_sites_by_region": _normalize_counts(
                fetch_rows(connection, build_water_region_counts_query(region_limit))
            ),
            "source_pattern_type_counts": _normalize_counts(
                fetch_rows(connection, build_source_pattern_type_counts_query())
            ),
            "source_pattern_samples": _normalize_counts(
                fetch_rows(connection, build_source_pattern_query(pattern_limit))
            ),
            "category_samples": category_samples,
            "display_category_mapping": DISPLAY_CATEGORY_MAPPING,
            "missing_display_mappings": sorted(db_categories.difference(DISPLAY_CATEGORY_MAPPING)),
            "display_categories_not_present": [
                category for category in DISPLAY_CATEGORY_MAPPING if category not in db_categories
            ],
            "source_types_without_schema_mapping": sorted(
                source_type_map.difference(SOURCE_TYPE_MAPPING)
            ),
            "unknown_count": expected_category_counts["unknown"],
            "closed_or_abandoned_count": fetch_scalar(connection, build_closed_count_query()),
            "limits": {
                "country_limit": country_limit,
                "region_limit": region_limit,
                "sample_limit": sample_limit,
                "pattern_limit": pattern_limit,
                "country_major_limit": country_major_limit,
            },
        }


def print_markdown(report: dict[str, Any]) -> None:
    print("# Aviation Category Audit Report")
    print()
    print(f"- total_airports: {report['total_airports']}")
    print(f"- unknown_count: {report['unknown_count']}")
    print(f"- closed_or_abandoned_count: {report['closed_or_abandoned_count']}")
    print()
    print("## Category Counts")
    for row in report["category_counts"]:
        print(f"- {row['category_normalized']}: {row['count']}")
    print()
    print("## Type Source Counts")
    for row in report["type_source_counts"]:
        print(
            f"- {row['source_id']} / {row['type_source']} -> "
            f"{row['category_normalized']}: {row['count']}"
        )
    print()
    print("## India And China Major Airports")
    for country_code, evidence in report["india_china_major_airports"].items():
        print(f"- {country_code}: {evidence['count']} major/international airports")
    print()
    print("## Water Landing Site Country Counts")
    for row in report["water_landing_sites_by_country"]:
        print(f"- {row['iso_country']} ({row['country_name']}): {row['count']}")
    print()
    print("## Display Mapping Coverage")
    print(f"- missing_display_mappings: {report['missing_display_mappings']}")
    print(f"- display_categories_not_present: {report['display_categories_not_present']}")
    print(
        "- source_types_without_schema_mapping: "
        f"{report['source_types_without_schema_mapping']}"
    )


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Audit aviation source category distribution and display mapping"
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    parser.add_argument("--country-limit", type=int, default=25)
    parser.add_argument("--region-limit", type=int, default=25)
    parser.add_argument("--sample-limit", type=int, default=3)
    parser.add_argument("--pattern-limit", type=int, default=30)
    parser.add_argument("--country-major-limit", type=int, default=100)
    return parser


def main() -> None:
    args = build_arg_parser().parse_args()
    report = run_report(
        args.database_url,
        country_limit=args.country_limit,
        region_limit=args.region_limit,
        sample_limit=args.sample_limit,
        pattern_limit=args.pattern_limit,
        country_major_limit=args.country_major_limit,
    )
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True, default=str))
    else:
        print_markdown(report)


if __name__ == "__main__":
    main()
