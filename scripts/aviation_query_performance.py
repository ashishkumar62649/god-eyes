"""Measure Layer 1 aviation airport query readiness against local PostGIS."""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, NamedTuple


DEFAULT_DATABASE_URL = (
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)


class BBox(NamedTuple):
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float

    def validate(self) -> "BBox":
        if not -180 <= self.min_lon <= 180:
            raise ValueError("min_lon must be between -180 and 180")
        if not -180 <= self.max_lon <= 180:
            raise ValueError("max_lon must be between -180 and 180")
        if not -90 <= self.min_lat <= 90:
            raise ValueError("min_lat must be between -90 and 90")
        if not -90 <= self.max_lat <= 90:
            raise ValueError("max_lat must be between -90 and 90")
        if self.min_lon >= self.max_lon:
            raise ValueError("min_lon must be less than max_lon")
        if self.min_lat >= self.max_lat:
            raise ValueError("min_lat must be less than max_lat")
        return self


class Query(NamedTuple):
    sql: str
    params: tuple[Any, ...]


class QueryCase(NamedTuple):
    name: str
    query: Query
    expectation: str


def bbox_clause(bbox: BBox) -> Query:
    checked = bbox.validate()
    envelope = "ST_MakeEnvelope(%s, %s, %s, %s, 4326)"
    clause = (
        f"geom IS NOT NULL AND geom && {envelope} "
        f"AND ST_Intersects(geom, {envelope})"
    )
    params = (
        checked.min_lon,
        checked.min_lat,
        checked.max_lon,
        checked.max_lat,
        checked.min_lon,
        checked.min_lat,
        checked.max_lon,
        checked.max_lat,
    )
    return Query(clause, params)


def build_airport_count_query(
    *,
    bbox: BBox | None = None,
    category: str | None = None,
    country: str | None = None,
    search: str | None = None,
) -> Query:
    clauses = ["layer_id = %s"]
    params: list[Any] = ["layer_01_aviation"]

    if bbox is not None:
        bbox_filter = bbox_clause(bbox)
        clauses.append(bbox_filter.sql)
        params.extend(bbox_filter.params)

    if category:
        clauses.append("category_normalized = %s")
        params.append(category)

    if country:
        clauses.append("iso_country = %s")
        params.append(country.upper())

    if search:
        clauses.append(
            "("
            "name ILIKE %s OR ident ILIKE %s OR iata_code ILIKE %s "
            "OR municipality ILIKE %s"
            ")"
        )
        pattern = f"%{search}%"
        params.extend([pattern, pattern, pattern, pattern])

    return Query(
        "SELECT COUNT(*) AS count FROM aviation_airports WHERE " + " AND ".join(clauses),
        tuple(params),
    )


def query_cases() -> list[QueryCase]:
    usa = BBox(-125, 25, -65, 50)
    europe = BBox(-10, 35, 30, 60)
    dubai = BBox(54, 23, 56.5, 26)
    return [
        QueryCase("total_airport_count", build_airport_count_query(), "baseline table count"),
        QueryCase("bbox_usa", build_airport_count_query(bbox=usa), "GiST bbox query"),
        QueryCase("bbox_europe", build_airport_count_query(bbox=europe), "GiST bbox query"),
        QueryCase("bbox_dubai_uae", build_airport_count_query(bbox=dubai), "GiST bbox query"),
        QueryCase(
            "category_heliport",
            build_airport_count_query(category="heliport"),
            "btree category filter",
        ),
        QueryCase("country_us", build_airport_count_query(country="US"), "btree country filter"),
        QueryCase(
            "search_dubai",
            build_airport_count_query(search="Dubai"),
            "simple ILIKE search over name, ident, iata_code, municipality",
        ),
        QueryCase(
            "bbox_usa_category_heliport",
            build_airport_count_query(bbox=usa, category="heliport"),
            "combined bbox and category filter",
        ),
        QueryCase(
            "bbox_usa_country_us",
            build_airport_count_query(bbox=usa, country="US"),
            "combined bbox and country filter",
        ),
    ]


def collect_node_types(plan_node: dict[str, Any]) -> list[str]:
    node_types = [str(plan_node.get("Node Type", ""))]
    for child in plan_node.get("Plans", []):
        node_types.extend(collect_node_types(child))
    return [node for node in node_types if node]


def collect_index_names(plan_node: dict[str, Any]) -> list[str]:
    names: list[str] = []
    if plan_node.get("Index Name"):
        names.append(str(plan_node["Index Name"]))
    for child in plan_node.get("Plans", []):
        names.extend(collect_index_names(child))
    return names


def summarize_explain(explain_json: list[dict[str, Any]]) -> dict[str, Any]:
    top = explain_json[0]
    plan = top["Plan"]
    node_types = collect_node_types(plan)
    return {
        "planning_time_ms": round(float(top.get("Planning Time", 0.0)), 3),
        "execution_time_ms": round(float(top.get("Execution Time", 0.0)), 3),
        "rows": int(plan.get("Actual Rows", 0)),
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
        return summarize_explain(cur.fetchone()[0])


def run_scalar(connection: Any, query: Query) -> int:
    with connection.cursor() as cur:
        cur.execute(query.sql, query.params)
        return int(cur.fetchone()[0])


def fetch_key_value_counts(connection: Any, sql: str) -> list[dict[str, Any]]:
    with connection.cursor() as cur:
        cur.execute(sql)
        return [{"value": row[0] or "<null>", "count": int(row[1])} for row in cur.fetchall()]


def fetch_airport_indexes(connection: Any) -> list[dict[str, str]]:
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'aviation_airports'
            ORDER BY indexname
            """
        )
        return [{"name": row[0], "definition": row[1]} for row in cur.fetchall()]


def run_report(database_url: str) -> dict[str, Any]:
    import psycopg

    with psycopg.connect(database_url) as connection:
        cases = []
        for case in query_cases():
            cases.append(
                {
                    "name": case.name,
                    "expectation": case.expectation,
                    "count": run_scalar(connection, case.query),
                    "plan": run_explain(connection, case.query),
                }
            )

        grid_query = Query(
            """
            SELECT
              floor((longitude_deg + 180.0) / 5.0)::int AS lon_bucket,
              floor((latitude_deg + 90.0) / 5.0)::int AS lat_bucket,
              COUNT(*) AS count
            FROM aviation_airports
            WHERE layer_id = %s
              AND geom IS NOT NULL
              AND geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
            GROUP BY lon_bucket, lat_bucket
            ORDER BY count DESC
            LIMIT 10
            """,
            ("layer_01_aviation", -125, 25, -65, 50),
        )
        with connection.cursor() as cur:
            cur.execute(grid_query.sql, grid_query.params)
            grid_rows = [
                {"lon_bucket": row[0], "lat_bucket": row[1], "count": int(row[2])}
                for row in cur.fetchall()
            ]

        return {
            "indexes": fetch_airport_indexes(connection),
            "category_counts": fetch_key_value_counts(
                connection,
                """
                SELECT category_normalized, COUNT(*)
                FROM aviation_airports
                GROUP BY category_normalized
                ORDER BY COUNT(*) DESC, category_normalized
                """,
            ),
            "country_counts_top_20": fetch_key_value_counts(
                connection,
                """
                SELECT iso_country, COUNT(*)
                FROM aviation_airports
                GROUP BY iso_country
                ORDER BY COUNT(*) DESC, iso_country
                LIMIT 20
                """,
            ),
            "query_cases": cases,
            "grid_bucket_sample": grid_rows,
        }


def print_markdown(report: dict[str, Any]) -> None:
    print("# Aviation Query Performance Report")
    print()
    print("## Indexes")
    for index in report["indexes"]:
        print(f"- `{index['name']}`")
    print()
    print("## Category Counts")
    for item in report["category_counts"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Top Countries")
    for item in report["country_counts_top_20"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Query Cases")
    for item in report["query_cases"]:
        plan = item["plan"]
        print(
            f"- {item['name']}: count={item['count']}; "
            f"execution_ms={plan['execution_time_ms']}; "
            f"nodes={', '.join(plan['node_types'])}; "
            f"indexes={', '.join(plan['index_names']) or 'none'}"
        )
    print()
    print("## Grid Bucket Sample")
    for item in report["grid_bucket_sample"]:
        print(
            f"- lon_bucket={item['lon_bucket']}, "
            f"lat_bucket={item['lat_bucket']}, count={item['count']}"
        )


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Measure aviation_airports viewport/filter/search query readiness"
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
