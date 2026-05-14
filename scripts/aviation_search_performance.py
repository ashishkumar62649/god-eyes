"""Benchmark Layer 1 aviation airport search query performance."""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, NamedTuple


DEFAULT_DATABASE_URL = (
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)
LAYER_ID = "layer_01_aviation"


class Query(NamedTuple):
    sql: str
    params: tuple[Any, ...]


class SearchCase(NamedTuple):
    term: str
    description: str


def search_cases() -> list[SearchCase]:
    return [
        SearchCase("Dubai", "city/name search; WO-009 baseline case"),
        SearchCase("London", "large city/name search"),
        SearchCase("New York", "multi-word city/name search"),
        SearchCase("Tokyo", "city/name search with mixed airport types"),
        SearchCase("KR", "two-letter country-code-like term"),
        SearchCase("heliport", "category-like search term"),
        SearchCase("small_airfield", "normalized category exact text"),
    ]


def build_broad_search_query(term: str) -> Query:
    pattern = f"%{term}%"
    return Query(
        """
        SELECT COUNT(*) AS count
        FROM aviation_airports
        WHERE layer_id = %s
          AND (
            name ILIKE %s
            OR ident ILIKE %s
            OR iata_code ILIKE %s
            OR municipality ILIKE %s
            OR iso_country ILIKE %s
            OR category_normalized ILIKE %s
          )
        """,
        (LAYER_ID, pattern, pattern, pattern, pattern, pattern, pattern),
    )


def build_exact_field_search_query(term: str) -> Query:
    upper_term = term.upper()
    lower_term = term.lower()
    return Query(
        """
        SELECT COUNT(*) AS count
        FROM aviation_airports
        WHERE layer_id = %s
          AND (
            iso_country = %s
            OR ident = %s
            OR iata_code = %s
            OR category_normalized = %s
          )
        """,
        (LAYER_ID, upper_term, upper_term, upper_term, lower_term),
    )


def build_lower_prefix_search_query(term: str) -> Query:
    pattern = f"{term.lower()}%"
    return Query(
        """
        SELECT COUNT(*) AS count
        FROM aviation_airports
        WHERE layer_id = %s
          AND (
            lower(name) LIKE %s
            OR lower(ident) LIKE %s
            OR lower(iata_code) LIKE %s
            OR lower(municipality) LIKE %s
          )
        """,
        (LAYER_ID, pattern, pattern, pattern, pattern),
    )


def build_lower_contains_search_query(term: str) -> Query:
    pattern = f"%{term.lower()}%"
    return Query(
        """
        SELECT COUNT(*) AS count
        FROM aviation_airports
        WHERE layer_id = %s
          AND (
            lower(name) LIKE %s
            OR lower(ident) LIKE %s
            OR lower(iata_code) LIKE %s
            OR lower(municipality) LIKE %s
          )
        """,
        (LAYER_ID, pattern, pattern, pattern, pattern),
    )


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
    index_names = sorted(set(collect_index_names(plan)))
    return {
        "planning_time_ms": round(float(top.get("Planning Time", 0.0)), 3),
        "execution_time_ms": round(float(top.get("Execution Time", 0.0)), 3),
        "node_types": node_types,
        "index_names": index_names,
        "uses_index": any("Index" in node or "Bitmap" in node for node in node_types),
        "uses_sequential_scan": any(node == "Seq Scan" for node in node_types),
    }


def run_explain(connection: Any, query: Query) -> dict[str, Any]:
    with connection.cursor() as cur:
        cur.execute("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query.sql, query.params)
        return summarize_explain(cur.fetchone()[0])


def run_scalar(connection: Any, query: Query) -> int:
    with connection.cursor() as cur:
        cur.execute(query.sql, query.params)
        return int(cur.fetchone()[0])


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
        results = []
        for case in search_cases():
            queries = {
                "broad_ilike": build_broad_search_query(case.term),
                "exact_field": build_exact_field_search_query(case.term),
                "lower_prefix": build_lower_prefix_search_query(case.term),
                "lower_contains": build_lower_contains_search_query(case.term),
            }
            case_results = {}
            for name, query in queries.items():
                case_results[name] = {
                    "count": run_scalar(connection, query),
                    "plan": run_explain(connection, query),
                }
            results.append(
                {
                    "term": case.term,
                    "description": case.description,
                    "queries": case_results,
                }
            )

        return {
            "row_count": run_scalar(
                connection,
                Query(
                    "SELECT COUNT(*) FROM aviation_airports WHERE layer_id = %s",
                    (LAYER_ID,),
                ),
            ),
            "indexes": fetch_airport_indexes(connection),
            "results": results,
        }


def print_markdown(report: dict[str, Any]) -> None:
    print("# Aviation Search Performance Benchmark")
    print()
    print(f"- airport rows: {report['row_count']}")
    print()
    print("## Indexes")
    for index in report["indexes"]:
        print(f"- `{index['name']}`")
    print()
    print("## Search Cases")
    for result in report["results"]:
        print(f"### {result['term']}")
        print(f"- description: {result['description']}")
        for query_name, query_result in result["queries"].items():
            plan = query_result["plan"]
            print(
                f"- {query_name}: count={query_result['count']}; "
                f"execution_ms={plan['execution_time_ms']}; "
                f"nodes={', '.join(plan['node_types'])}; "
                f"indexes={', '.join(plan['index_names']) or 'none'}"
            )
        print()


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Benchmark aviation_airports search query performance"
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
