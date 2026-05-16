"""Report Layer 1 aviation airport distribution for density-view planning."""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, NamedTuple


DEFAULT_DATABASE_URL = (
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)
LAYER_ID = "layer_01_aviation"
CLOSED_CATEGORY = "closed_or_abandoned"


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


class RegionCase(NamedTuple):
    name: str
    label: str
    bbox: BBox
    reason: str


QA_REGIONS = (
    RegionCase(
        "usa_contiguous",
        "Contiguous United States",
        BBox(-125, 25, -65, 50),
        "largest single-country stress region and broad mixed category coverage",
    ),
    RegionCase(
        "europe_core",
        "Core Europe",
        BBox(-10, 35, 30, 60),
        "dense multi-country region with many medium and small airports",
    ),
    RegionCase(
        "brazil",
        "Brazil",
        BBox(-75, -35, -30, 6),
        "large southern-hemisphere country count and sparse-to-dense interior mix",
    ),
    RegionCase(
        "japan_korea",
        "Japan and Korea",
        BBox(125, 30, 146, 46),
        "dense East Asia island/peninsula viewport with many airports in compact space",
    ),
    RegionCase(
        "california_nevada",
        "California and Nevada",
        BBox(-125, 32, -114, 43),
        "western US dense viewport with heliport and small-airfield pressure",
    ),
    RegionCase(
        "northeast_us",
        "Northeast United States",
        BBox(-80, 38, -66, 47),
        "dense urban corridor and high marker overlap risk",
    ),
    RegionCase(
        "dubai_uae",
        "Dubai and UAE",
        BBox(54, 23, 56.5, 26),
        "small viewport sanity check with low count and known sample airport OMDB",
    ),
)


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


def build_operational_status_query() -> Query:
    return Query(
        """
        SELECT
          CASE
            WHEN category_normalized = %s THEN 'closed_or_historical'
            ELSE 'operational_reference'
          END AS status,
          COUNT(*)
        FROM aviation_airports
        WHERE layer_id = %s
        GROUP BY status
        ORDER BY status
        """,
        (CLOSED_CATEGORY, LAYER_ID),
    )


def build_country_counts_query(limit: int) -> Query:
    return Query(
        """
        SELECT iso_country, COUNT(*)
        FROM aviation_airports
        WHERE layer_id = %s
        GROUP BY iso_country
        ORDER BY COUNT(*) DESC, iso_country
        LIMIT %s
        """,
        (LAYER_ID, limit),
    )


def build_grid_density_query(cell_size_degrees: float, limit: int) -> Query:
    if cell_size_degrees <= 0:
        raise ValueError("cell_size_degrees must be positive")
    return Query(
        """
        WITH bucketed AS (
          SELECT
            floor((longitude_deg + 180.0) / %s)::int AS lon_bucket,
            floor((latitude_deg + 90.0) / %s)::int AS lat_bucket,
            COUNT(*) AS count
          FROM aviation_airports
          WHERE layer_id = %s
            AND geom IS NOT NULL
          GROUP BY lon_bucket, lat_bucket
        )
        SELECT
          (-180.0 + lon_bucket * %s) AS min_lon,
          (-90.0 + lat_bucket * %s) AS min_lat,
          (-180.0 + (lon_bucket + 1) * %s) AS max_lon,
          (-90.0 + (lat_bucket + 1) * %s) AS max_lat,
          count
        FROM bucketed
        ORDER BY count DESC, min_lon, min_lat
        LIMIT %s
        """,
        (
            cell_size_degrees,
            cell_size_degrees,
            LAYER_ID,
            cell_size_degrees,
            cell_size_degrees,
            cell_size_degrees,
            cell_size_degrees,
            limit,
        ),
    )


def bbox_count_query(bbox: BBox) -> Query:
    checked = bbox.validate()
    envelope = "ST_MakeEnvelope(%s, %s, %s, %s, 4326)"
    return Query(
        f"""
        SELECT COUNT(*)
        FROM aviation_airports
        WHERE layer_id = %s
          AND geom IS NOT NULL
          AND geom && {envelope}
          AND ST_Intersects(geom, {envelope})
        """,
        (
            LAYER_ID,
            checked.min_lon,
            checked.min_lat,
            checked.max_lon,
            checked.max_lat,
            checked.min_lon,
            checked.min_lat,
            checked.max_lon,
            checked.max_lat,
        ),
    )


def fetch_scalar(connection: Any, query: Query) -> int:
    with connection.cursor() as cur:
        cur.execute(query.sql, query.params)
        return int(cur.fetchone()[0])


def fetch_key_value_counts(connection: Any, query: Query) -> list[dict[str, Any]]:
    with connection.cursor() as cur:
        cur.execute(query.sql, query.params)
        return [{"value": row[0] or "<blank>", "count": int(row[1])} for row in cur.fetchall()]


def fetch_grid_density(connection: Any, query: Query) -> list[dict[str, Any]]:
    with connection.cursor() as cur:
        cur.execute(query.sql, query.params)
        return [
            {
                "min_lon": float(row[0]),
                "min_lat": float(row[1]),
                "max_lon": float(row[2]),
                "max_lat": float(row[3]),
                "count": int(row[4]),
            }
            for row in cur.fetchall()
        ]


def fetch_region_counts(connection: Any) -> list[dict[str, Any]]:
    rows = []
    for region in QA_REGIONS:
        rows.append(
            {
                "name": region.name,
                "label": region.label,
                "bbox": {
                    "min_lon": region.bbox.min_lon,
                    "min_lat": region.bbox.min_lat,
                    "max_lon": region.bbox.max_lon,
                    "max_lat": region.bbox.max_lat,
                },
                "count": fetch_scalar(connection, bbox_count_query(region.bbox)),
                "reason": region.reason,
            }
        )
    return rows


def run_report(
    database_url: str,
    *,
    country_limit: int = 20,
    grid_limit: int = 15,
    cell_size_degrees: float = 5.0,
) -> dict[str, Any]:
    import psycopg

    with psycopg.connect(database_url) as connection:
        category_counts = fetch_key_value_counts(connection, build_category_counts_query())
        status_counts = fetch_key_value_counts(connection, build_operational_status_query())
        special_categories = {
            item["value"]: item["count"]
            for item in category_counts
            if item["value"] in {"heliport", "water_landing_site", "balloonport", "unknown"}
        }
        for category in ["heliport", "water_landing_site", "balloonport", "unknown"]:
            special_categories.setdefault(category, 0)

        return {
            "total_airports": fetch_scalar(connection, build_total_count_query()),
            "category_counts": category_counts,
            "operational_status_counts": status_counts,
            "special_category_counts": dict(sorted(special_categories.items())),
            "top_country_counts": fetch_key_value_counts(
                connection, build_country_counts_query(country_limit)
            ),
            "densest_grid_cells": fetch_grid_density(
                connection,
                build_grid_density_query(cell_size_degrees, grid_limit),
            ),
            "qa_region_counts": fetch_region_counts(connection),
            "cell_size_degrees": cell_size_degrees,
        }


def print_markdown(report: dict[str, Any]) -> None:
    print("# Aviation Density View Data Reference Report")
    print()
    print(f"- total_airports: {report['total_airports']}")
    print(f"- cell_size_degrees: {report['cell_size_degrees']}")
    print()
    print("## Category Counts")
    for item in report["category_counts"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Operational Status Counts")
    for item in report["operational_status_counts"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Special Category Counts")
    for value, count in report["special_category_counts"].items():
        print(f"- {value}: {count}")
    print()
    print("## Top Countries")
    for item in report["top_country_counts"]:
        print(f"- {item['value']}: {item['count']}")
    print()
    print("## Densest Grid Cells")
    for item in report["densest_grid_cells"]:
        print(
            f"- {item['min_lon']},{item['min_lat']} to "
            f"{item['max_lon']},{item['max_lat']}: {item['count']}"
        )
    print()
    print("## QA Regions")
    for item in report["qa_region_counts"]:
        bbox = item["bbox"]
        print(
            f"- {item['label']}: {item['count']} "
            f"({bbox['min_lon']},{bbox['min_lat']} to "
            f"{bbox['max_lon']},{bbox['max_lat']}) - {item['reason']}"
        )


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Report aviation airport distribution for density-view planning"
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    parser.add_argument("--country-limit", type=int, default=20)
    parser.add_argument("--grid-limit", type=int, default=15)
    parser.add_argument("--cell-size-degrees", type=float, default=5.0)
    return parser


def main() -> None:
    args = build_arg_parser().parse_args()
    report = run_report(
        args.database_url,
        country_limit=args.country_limit,
        grid_limit=args.grid_limit,
        cell_size_degrees=args.cell_size_degrees,
    )
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print_markdown(report)


if __name__ == "__main__":
    main()
