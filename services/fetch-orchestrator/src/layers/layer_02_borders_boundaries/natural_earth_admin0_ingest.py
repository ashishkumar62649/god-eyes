"""Natural Earth Admin-0 Countries ingestion for WO-078C.

This worker is for MVP/local/dev ingestion only. It does not approve Natural
Earth for production, India compliance, or official India boundary depiction use.

Default mode is dry-run. Use --persist explicitly to write to PostGIS.
"""

import argparse
import json
import os
import struct
import sys
import tempfile
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

NATURAL_EARTH_ADMIN0_50M_URL = (
    "https://naturalearth.s3.amazonaws.com/50m_cultural/"
    "ne_50m_admin_0_countries.zip"
)
NATURAL_EARTH_TERMS_URL = "https://www.naturalearthdata.com/about/terms-of-use/"
SOURCE_ID = "natural_earth_admin0_50m"
SOURCE_NAME = "Natural Earth Admin-0 Countries 1:50m"
LAYER_ID = "layer_02_borders_boundaries"
DEFAULT_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev",
)
DEFAULT_CACHE_DIR = (
    Path(__file__).resolve().parents[5]
    / "raw"
    / LAYER_ID
    / SOURCE_ID
)


@dataclass(frozen=True)
class DbfField:
    name: str
    field_type: str
    length: int
    decimal_count: int


@dataclass(frozen=True)
class ShapeFeature:
    attributes: dict[str, Any]
    geometry_wkt: str


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Dry-run or persist Natural Earth Admin-0 Countries 1:50m into Borders schema."
    )
    parser.add_argument(
        "--persist",
        action="store_true",
        help="Write source metadata and boundary rows to the database. Without this flag, dry-run is used.",
    )
    parser.add_argument(
        "--input-zip",
        type=Path,
        default=None,
        help="Optional local Natural Earth zip path. If omitted, the official Natural Earth URL is downloaded at runtime.",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=DEFAULT_CACHE_DIR,
        help="Runtime cache directory for downloaded Natural Earth zip. This is under raw/ and is gitignored.",
    )
    parser.add_argument(
        "--database-url",
        default=DEFAULT_DATABASE_URL,
        help="PostgreSQL connection URL used only with --persist.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional feature limit for local smoke tests.",
    )
    return parser


def is_dry_run(args: argparse.Namespace) -> bool:
    return not bool(args.persist)


def build_source_metadata() -> dict[str, Any]:
    return {
        "source_id": SOURCE_ID,
        "source_name": SOURCE_NAME,
        "source_url": NATURAL_EARTH_ADMIN0_50M_URL,
        "license_name": "Public domain",
        "license_url": NATURAL_EARTH_TERMS_URL,
        "attribution": "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.",
        "approved_for_india": False,
        "approved_for_non_india": False,
        "india_conflict_checked": False,
        "human_approved_by": None,
        "human_approved_at": None,
        "approval_notes": (
            "MVP/local/dev only; not production-approved; not India-compliant; "
            "Natural Earth uses de facto boundaries and must not replace Survey of India review."
        ),
    }


def download_official_zip(cache_dir: Path, timeout: int = 60) -> Path:
    cache_dir.mkdir(parents=True, exist_ok=True)
    target = cache_dir / "ne_50m_admin_0_countries.zip"
    if target.exists() and target.stat().st_size > 0:
        return target

    request = urllib.request.Request(
        NATURAL_EARTH_ADMIN0_50M_URL,
        headers={"User-Agent": "GodEyes/0.1 NaturalEarthMVPIngest"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read()
    target.write_bytes(payload)
    return target


def extract_zip_to_temp(zip_path: Path) -> Path:
    temp_dir = Path(tempfile.mkdtemp(prefix="god_eyes_ne_admin0_"))
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(temp_dir)
    return temp_dir


def find_dataset_files(extracted_dir: Path) -> tuple[Path, Path]:
    shp_files = list(extracted_dir.rglob("ne_50m_admin_0_countries.shp"))
    dbf_files = list(extracted_dir.rglob("ne_50m_admin_0_countries.dbf"))
    if not shp_files or not dbf_files:
        raise FileNotFoundError("Natural Earth zip did not contain expected .shp and .dbf files")
    return shp_files[0], dbf_files[0]


def clean_text(value: str) -> str:
    return value.replace("\x00", "").strip()


def parse_dbf_value(raw: bytes, field: DbfField) -> Any:
    text = clean_text(raw.decode("utf-8", errors="replace"))
    if text == "":
        return None
    if field.field_type in {"N", "F"}:
        try:
            if field.decimal_count == 0:
                return int(text)
            return float(text)
        except ValueError:
            return text
    if field.field_type == "L":
        return text.upper() in {"Y", "T"}
    return text


def read_dbf_records(dbf_path: Path) -> list[dict[str, Any]]:
    data = dbf_path.read_bytes()
    if len(data) < 32:
        raise ValueError("DBF file is too small")

    record_count = struct.unpack_from("<I", data, 4)[0]
    header_length = struct.unpack_from("<H", data, 8)[0]
    record_length = struct.unpack_from("<H", data, 10)[0]

    fields: list[DbfField] = []
    offset = 32
    while offset < header_length and data[offset] != 0x0D:
        descriptor = data[offset:offset + 32]
        name = descriptor[:11].split(b"\x00", 1)[0].decode("ascii", errors="ignore")
        field_type = chr(descriptor[11])
        length = descriptor[16]
        decimal_count = descriptor[17]
        fields.append(DbfField(name, field_type, length, decimal_count))
        offset += 32

    records: list[dict[str, Any]] = []
    record_offset = header_length
    for _ in range(record_count):
        record = data[record_offset:record_offset + record_length]
        record_offset += record_length
        if not record or record[0:1] == b"*":
            continue

        values: dict[str, Any] = {}
        field_offset = 1
        for field in fields:
            raw_value = record[field_offset:field_offset + field.length]
            values[field.name] = parse_dbf_value(raw_value, field)
            field_offset += field.length
        records.append(values)

    return records


def format_coord(value: float) -> str:
    return f"{value:.8f}".rstrip("0").rstrip(".")


def ring_to_wkt(points: list[tuple[float, float]]) -> str:
    if not points:
        raise ValueError("Cannot build WKT from empty ring")
    if points[0] != points[-1]:
        points = [*points, points[0]]
    return ",".join(f"{format_coord(x)} {format_coord(y)}" for x, y in points)


def polygon_record_to_wkt(content: bytes) -> str | None:
    if len(content) < 44:
        return None
    shape_type = struct.unpack_from("<i", content, 0)[0]
    if shape_type == 0:
        return None
    if shape_type not in {5, 15, 25}:
        raise ValueError(f"Unsupported Natural Earth shape type: {shape_type}")

    num_parts = struct.unpack_from("<i", content, 36)[0]
    num_points = struct.unpack_from("<i", content, 40)[0]
    parts_offset = 44
    points_offset = parts_offset + (num_parts * 4)
    parts = list(struct.unpack_from(f"<{num_parts}i", content, parts_offset))
    points = [
        struct.unpack_from("<2d", content, points_offset + (index * 16))
        for index in range(num_points)
    ]

    polygons: list[str] = []
    for part_index, start in enumerate(parts):
        end = parts[part_index + 1] if part_index + 1 < len(parts) else num_points
        ring = [(float(x), float(y)) for x, y in points[start:end]]
        if len(ring) >= 3:
            polygons.append(f"(({ring_to_wkt(ring)}))")

    if not polygons:
        return None
    return f"MULTIPOLYGON({','.join(polygons)})"


def read_shp_geometries(shp_path: Path) -> list[str]:
    data = shp_path.read_bytes()
    if len(data) < 100:
        raise ValueError("SHP file is too small")

    geometries: list[str] = []
    offset = 100
    while offset + 8 <= len(data):
        content_length_words = struct.unpack_from(">i", data, offset + 4)[0]
        content_length_bytes = content_length_words * 2
        content_start = offset + 8
        content = data[content_start:content_start + content_length_bytes]
        wkt = polygon_record_to_wkt(content)
        if wkt:
            geometries.append(wkt)
        offset = content_start + content_length_bytes

    return geometries


def load_features_from_zip(zip_path: Path, limit: int | None = None) -> list[ShapeFeature]:
    extracted = extract_zip_to_temp(zip_path)
    shp_path, dbf_path = find_dataset_files(extracted)
    attributes = read_dbf_records(dbf_path)
    geometries = read_shp_geometries(shp_path)
    if len(attributes) != len(geometries):
        raise ValueError(f"DBF/SHP record count mismatch: {len(attributes)} attrs vs {len(geometries)} geometries")

    features = [
        ShapeFeature(attributes=attrs, geometry_wkt=wkt)
        for attrs, wkt in zip(attributes, geometries)
    ]
    return features[:limit] if limit is not None else features


def clean_code(value: Any) -> str | None:
    if value is None:
        return None
    text = clean_text(str(value))
    if text in {"", "-99", "None"}:
        return None
    return text


def clean_iso_code(value: Any, length: int) -> str | None:
    text = clean_code(value)
    if text is None:
        return None
    text = text.upper()
    return text if len(text) == length else None


def is_india_sensitive(attributes: dict[str, Any]) -> bool:
    code_values = {
        clean_code(attributes.get("ISO_A2")),
        clean_code(attributes.get("ISO_A3")),
        clean_code(attributes.get("ADM0_A3")),
        clean_code(attributes.get("SOV_A3")),
        clean_code(attributes.get("BRK_A3")),
    }
    name_values = " ".join(
        str(attributes.get(key) or "")
        for key in ("NAME", "NAME_LONG", "ADMIN", "SOVEREIGNT", "BRK_NAME")
    ).lower()
    return "IN" in code_values or "IND" in code_values or "india" in name_values


def source_object_id(attributes: dict[str, Any]) -> str:
    for key in ("NE_ID", "ADM0_A3", "ISO_A3", "ISO_N3", "NAME_LONG", "NAME"):
        value = clean_code(attributes.get(key))
        if value:
            return str(value)
    raise ValueError("Natural Earth feature is missing a stable source identifier")


def normalize_boundary_record(attributes: dict[str, Any], geometry_wkt: str) -> dict[str, Any]:
    iso2 = clean_iso_code(attributes.get("ISO_A2"), 2)
    iso3 = clean_iso_code(attributes.get("ISO_A3"), 3) or clean_iso_code(attributes.get("ADM0_A3"), 3)
    name = clean_code(attributes.get("NAME_LONG")) or clean_code(attributes.get("NAME")) or clean_code(attributes.get("ADMIN"))
    if not name:
        raise ValueError("Natural Earth feature is missing a name")

    sensitive = is_india_sensitive(attributes)
    minimal_properties = {
        "ne_id": attributes.get("NE_ID"),
        "admin": attributes.get("ADMIN"),
        "sovereignt": attributes.get("SOVEREIGNT"),
        "adm0_a3": attributes.get("ADM0_A3"),
        "mapcolor7": attributes.get("MAPCOLOR7"),
        "continent": attributes.get("CONTINENT"),
        "region_un": attributes.get("REGION_UN"),
        "subregion": attributes.get("SUBREGION"),
        "mvp_warning": "Natural Earth MVP/local/dev only; not production-approved; not India-compliant.",
        "dispute_caveat": "Disputed boundary handling remains subject to future compliance review.",
    }

    return {
        "layer_id": LAYER_ID,
        "source_id": SOURCE_ID,
        "source_object_id": source_object_id(attributes),
        "boundary_type": "country_boundary",
        "boundary_level": "admin0",
        "country_iso2": iso2,
        "country_iso3": iso3,
        "admin_level": 0,
        "name": name,
        "name_local": clean_code(attributes.get("NAME")),
        "display_name": clean_code(attributes.get("NAME_LONG")) or name,
        "disputed": False,
        "dispute_status": "undisputed",
        "india_sensitive": sensitive,
        "india_compliance_status": "requires_soi_review" if sensitive else "not_applicable",
        "geometry_wkt": geometry_wkt,
        "properties": {k: v for k, v in minimal_properties.items() if v is not None},
    }


def connect_db(database_url: str) -> Any:
    import psycopg
    from psycopg.rows import dict_row

    return psycopg.connect(database_url, row_factory=dict_row)


def upsert_source(conn: Any) -> None:
    metadata = build_source_metadata()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO border_boundary_sources (
              source_id, source_name, source_url, license_name, license_url,
              attribution, approved_for_india, approved_for_non_india,
              india_conflict_checked, human_approved_by, human_approved_at,
              approval_notes
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (source_id) DO UPDATE SET
              source_name = EXCLUDED.source_name,
              source_url = EXCLUDED.source_url,
              license_name = EXCLUDED.license_name,
              license_url = EXCLUDED.license_url,
              attribution = EXCLUDED.attribution,
              approved_for_india = false,
              approved_for_non_india = false,
              india_conflict_checked = false,
              human_approved_by = NULL,
              human_approved_at = NULL,
              approval_notes = EXCLUDED.approval_notes,
              updated_at = NOW()
            """,
            [
                metadata["source_id"],
                metadata["source_name"],
                metadata["source_url"],
                metadata["license_name"],
                metadata["license_url"],
                metadata["attribution"],
                metadata["approved_for_india"],
                metadata["approved_for_non_india"],
                metadata["india_conflict_checked"],
                metadata["human_approved_by"],
                metadata["human_approved_at"],
                metadata["approval_notes"],
            ],
        )


def upsert_boundary(conn: Any, boundary: dict[str, Any]) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO border_boundaries (
              layer_id, source_id, source_object_id, boundary_type, boundary_level,
              country_iso2, country_iso3, admin_level, name, name_local,
              display_name, disputed, dispute_status, india_sensitive,
              india_compliance_status, geometry, properties
            )
            VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
              ST_Multi(ST_MakeValid(ST_GeomFromText(%s, 4326))), %s
            )
            ON CONFLICT (source_id, source_object_id) WHERE source_object_id IS NOT NULL
            DO UPDATE SET
              boundary_type = EXCLUDED.boundary_type,
              boundary_level = EXCLUDED.boundary_level,
              country_iso2 = EXCLUDED.country_iso2,
              country_iso3 = EXCLUDED.country_iso3,
              admin_level = EXCLUDED.admin_level,
              name = EXCLUDED.name,
              name_local = EXCLUDED.name_local,
              display_name = EXCLUDED.display_name,
              disputed = EXCLUDED.disputed,
              dispute_status = EXCLUDED.dispute_status,
              india_sensitive = EXCLUDED.india_sensitive,
              india_compliance_status = EXCLUDED.india_compliance_status,
              geometry = EXCLUDED.geometry,
              properties = EXCLUDED.properties,
              updated_at = NOW()
            """,
            [
                boundary["layer_id"],
                boundary["source_id"],
                boundary["source_object_id"],
                boundary["boundary_type"],
                boundary["boundary_level"],
                boundary["country_iso2"],
                boundary["country_iso3"],
                boundary["admin_level"],
                boundary["name"],
                boundary["name_local"],
                boundary["display_name"],
                boundary["disputed"],
                boundary["dispute_status"],
                boundary["india_sensitive"],
                boundary["india_compliance_status"],
                boundary["geometry_wkt"],
                json.dumps(boundary["properties"]),
            ],
        )


def persist_boundaries(conn: Any, boundaries: list[dict[str, Any]]) -> None:
    upsert_source(conn)
    for boundary in boundaries:
        upsert_boundary(conn, boundary)
    conn.commit()


def run_ingestion(
    persist: bool = False,
    input_zip: Path | None = None,
    cache_dir: Path = DEFAULT_CACHE_DIR,
    database_url: str = DEFAULT_DATABASE_URL,
    limit: int | None = None,
) -> dict[str, Any]:
    zip_path = input_zip if input_zip is not None else download_official_zip(cache_dir)
    features = load_features_from_zip(zip_path, limit=limit)
    boundaries = [
        normalize_boundary_record(feature.attributes, feature.geometry_wkt)
        for feature in features
    ]

    result = {
        "source_id": SOURCE_ID,
        "source_url": NATURAL_EARTH_ADMIN0_50M_URL,
        "terms_url": NATURAL_EARTH_TERMS_URL,
        "zip_path": str(zip_path),
        "features_parsed": len(features),
        "boundaries_normalized": len(boundaries),
        "india_sensitive_count": sum(1 for item in boundaries if item["india_sensitive"]),
        "persisted": False,
        "source_rows_written": 0,
        "boundary_rows_written": 0,
    }

    if not persist:
        return result

    conn = connect_db(database_url)
    try:
        persist_boundaries(conn, boundaries)
        result["persisted"] = True
        result["source_rows_written"] = 1
        result["boundary_rows_written"] = len(boundaries)
    finally:
        conn.close()
    return result


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    dry_run = is_dry_run(args)
    if dry_run:
        print("[WORKER] Dry-run mode (default). Use --persist to write to PostGIS.")
    else:
        print("[WORKER] Persist mode enabled by explicit --persist flag.")

    result = run_ingestion(
        persist=args.persist,
        input_zip=args.input_zip,
        cache_dir=args.cache_dir,
        database_url=args.database_url,
        limit=args.limit,
    )

    print("[SUMMARY]")
    print(f"  Source: {result['source_id']}")
    print(f"  Features parsed: {result['features_parsed']}")
    print(f"  Boundaries normalized: {result['boundaries_normalized']}")
    print(f"  India-sensitive rows: {result['india_sensitive_count']}")
    print(f"  Persisted: {result['persisted']}")
    if result["persisted"]:
        print(f"  Source rows written/upserted: {result['source_rows_written']}")
        print(f"  Boundary rows written/upserted: {result['boundary_rows_written']}")
    print("  Warning: MVP/local/dev only; not production-approved; not India-compliant.")


if __name__ == "__main__":
    main()
