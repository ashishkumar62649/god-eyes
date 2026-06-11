from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_08_news_osint"
    / "001_news_tables.sql"
)
DB_CONTAINER = "god-eyes-postgis"
DB_USER = "god_eyes"


def migration_text() -> str:
    if not MIGRATION_PATH.exists():
        return ""
    return MIGRATION_PATH.read_text(encoding="utf-8")


def compact_sql() -> str:
    return re.sub(r"\s+", " ", migration_text().lower()).strip()


def table_columns(table_name: str) -> set[str]:
    match = re.search(
        rf"CREATE TABLE IF NOT EXISTS {table_name} \((.*?)\n\);",
        migration_text(),
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert match, f"{table_name} not found"

    columns = set()
    for raw_line in match.group(1).splitlines():
        line = raw_line.strip()
        if not line or line.startswith("CONSTRAINT"):
            continue
        columns.add(line.split()[0].strip(",").lower())
    return columns


def test_news_migration_creates_required_tables():
    sql = compact_sql()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists postgis" in sql
    for table_name in (
        "news_sources",
        "news_fetch_runs",
        "news_items_latest",
        "news_item_history",
        "news_raw_message_refs",
    ):
        assert f"create table if not exists {table_name}" in sql


def test_news_tables_are_layer_aware_and_source_linked():
    sql = compact_sql()

    assert sql.count("layer_id text not null default 'layer_08_news_osint'") == 5
    assert sql.count("check (layer_id = 'layer_08_news_osint')") == 5
    assert sql.count("foreign key (source_id) references news_sources(source_id)") == 4
    assert "foreign key (item_id) references news_items_latest(item_id)" in sql
    assert "foreign key (fetch_run_id) references news_fetch_runs(fetch_run_id)" in sql


def test_gdacs_source_seed_is_idempotent_and_attributed():
    sql = compact_sql()

    assert "insert into news_sources" in sql
    assert "'gdacs'" in sql
    assert "'disaster_alert'" in sql
    assert "'global disaster alert and coordination system'" in sql
    assert "'https://www.gdacs.org/gdacsapi/api/events/geteventlist/map'" in sql
    assert "'cc by 4.0'" in sql
    assert "on conflict (source_id) do update set" in sql


def test_latest_table_matches_normalized_item_contract():
    required_columns = {
        "item_id",
        "layer_id",
        "source_id",
        "source_family",
        "source_object_id",
        "dedupe_key",
        "source_url",
        "title",
        "summary",
        "content_type",
        "published_at",
        "source_updated_at",
        "fetched_at",
        "first_seen_at",
        "last_seen_at",
        "location_confidence",
        "country_code",
        "country_name",
        "region",
        "city",
        "latitude",
        "longitude",
        "geom",
        "geometry_type",
        "geo_source",
        "has_coordinates",
        "marker_ready",
        "category",
        "subcategory",
        "severity",
        "source_domain",
        "source_language",
        "source_country",
        "confidence_score",
        "duplicate_of",
        "raw_evidence_uri",
        "attribution",
        "provider_metadata",
        "is_active",
        "created_at",
        "updated_at",
    }

    assert required_columns.issubset(table_columns("news_items_latest"))


def test_coordinate_and_marker_constraints_preserve_non_point_items():
    sql = compact_sql()

    assert "geom geometry(point, 4326)" in sql
    assert "check ((latitude is null) = (longitude is null))" in sql
    assert "check (has_coordinates = (latitude is not null and longitude is not null))" in sql
    assert (
        "check (not marker_ready or (has_coordinates and geometry_type = 'point' and geom is not null))"
        in sql
    )
    assert "check (marker_ready or geom is null)" in sql
    assert "st_y(geom) = latitude and st_x(geom) = longitude" in sql
    assert "latitude is null or (latitude >= -90 and latitude <= 90)" in sql
    assert "longitude is null or (longitude >= -180 and longitude <= 180)" in sql
    assert "if new.marker_ready and new.latitude is not null and new.longitude is not null then" in sql
    assert "st_makepoint(new.longitude, new.latitude)" in sql


def test_status_counts_history_and_raw_reference_constraints_are_explicit():
    sql = compact_sql()

    assert "status in ('running', 'success', 'partial', 'failed')" in sql
    assert "normalized_item_count <= fetched_item_count" in sql
    assert "marker_ready_count <= normalized_item_count" in sql
    assert "version > 0" in sql
    assert "jsonb_typeof(snapshot) = 'object'" in sql
    assert "raw_file_offset is null or raw_file_offset >= 0" in sql
    assert "raw_file_line is null or raw_file_line >= 1" in sql


def test_indexes_cover_dedupe_markers_filters_history_and_raw_refs():
    sql = compact_sql()
    required_indexes = (
        "idx_news_items_latest_dedupe_key",
        "idx_news_items_latest_source_id",
        "idx_news_items_latest_published_at",
        "idx_news_items_latest_fetched_at",
        "idx_news_items_latest_category",
        "idx_news_items_latest_subcategory",
        "idx_news_items_latest_severity",
        "idx_news_items_latest_country_code",
        "idx_news_items_latest_marker_ready",
        "idx_news_items_latest_marker_published",
        "idx_news_items_latest_marker_geom_gist",
        "idx_news_item_history_item_version",
        "idx_news_item_history_dedupe_key",
        "idx_news_item_history_source_id",
        "idx_news_item_history_recorded_at",
        "idx_news_raw_refs_fetch_run_id",
        "idx_news_raw_refs_source_id",
        "idx_news_raw_refs_source_object_id",
        "idx_news_raw_refs_dedupe_key",
    )
    for index_name in required_indexes:
        assert f"create index if not exists {index_name}" in sql or (
            f"create unique index if not exists {index_name}" in sql
        )

    assert "on news_items_latest using gist(geom)" in sql
    assert "where marker_ready = true and geom is not null" in sql


def test_schema_is_source_flexible_and_additive():
    sql = compact_sql()

    assert "source_family text not null" in sql
    assert "source_id text not null" in sql
    assert "source_family in (" not in sql
    assert "source_id in (" not in sql
    assert "create table if not exists gdacs" not in sql
    assert "gdacs_items" not in sql
    for forbidden_term in (
        "drop table",
        "drop column",
        "drop extension",
        "truncate",
        "delete from",
        "insert into news_items_latest",
        "insert into news_item_history",
        "insert into news_raw_message_refs",
        "api_key",
        "password",
        ".env",
    ):
        assert forbidden_term not in sql


def _docker_psql(database: str, sql: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            DB_CONTAINER,
            "psql",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            DB_USER,
            "-d",
            database,
            "-At",
        ],
        input=sql,
        text=True,
        capture_output=True,
        check=False,
    )


@pytest.fixture(scope="module")
def migrated_database():
    if os.environ.get("GOD_EYES_RUN_DB_TESTS") != "1":
        pytest.skip("Set GOD_EYES_RUN_DB_TESTS=1 to run local PostGIS integration tests")

    inspect = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Running}}", DB_CONTAINER],
        capture_output=True,
        text=True,
        check=False,
    )
    if inspect.returncode != 0 or inspect.stdout.strip() != "true":
        pytest.skip(f"Local container {DB_CONTAINER} is not running")

    database = f"god_eyes_news_schema_test_{os.getpid()}"
    create = _docker_psql(
        "postgres",
        f'DROP DATABASE IF EXISTS "{database}"; CREATE DATABASE "{database}";',
    )
    assert create.returncode == 0, create.stderr

    applied = _docker_psql(database, migration_text())
    assert applied.returncode == 0, applied.stderr
    reapplied = _docker_psql(database, migration_text())
    assert reapplied.returncode == 0, reapplied.stderr

    try:
        yield database
    finally:
        _docker_psql(
            "postgres",
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            f"WHERE datname = '{database}' AND pid <> pg_backend_pid(); "
            f'DROP DATABASE IF EXISTS "{database}";',
        )


def _assert_sql_succeeds(database: str, sql: str) -> str:
    result = _docker_psql(database, sql)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def _assert_sql_fails(database: str, sql: str) -> None:
    result = _docker_psql(database, sql)
    assert result.returncode != 0


def _item_insert(
    item_id: str,
    dedupe_key: str,
    *,
    source_id: str = "gdacs",
    source_family: str = "disaster_alert",
    geometry_type: str = "Polygon",
    latitude: str = "NULL",
    longitude: str = "NULL",
    has_coordinates: str = "FALSE",
    marker_ready: str = "FALSE",
) -> str:
    return f"""
        INSERT INTO news_items_latest (
          item_id, source_id, source_family, dedupe_key, title, content_type,
          fetched_at, first_seen_at, last_seen_at, location_confidence,
          latitude, longitude, geometry_type, has_coordinates, marker_ready,
          category, severity, attribution
        ) VALUES (
          '{item_id}', '{source_id}', '{source_family}', '{dedupe_key}',
          'Schema test item', 'event', NOW(), NOW(), NOW(), 'unknown',
          {latitude}, {longitude}, '{geometry_type}', {has_coordinates}, {marker_ready},
          'disaster', 'unknown', 'Schema test attribution'
        );
    """


def test_database_accepts_marker_ready_point_and_generates_geometry(migrated_database):
    sql = _item_insert(
        "db-point",
        "schema:point",
        geometry_type="Point",
        latitude="35.69",
        longitude="139.69",
        has_coordinates="TRUE",
        marker_ready="TRUE",
    )
    sql += "SELECT marker_ready, ST_SRID(geom), ST_Y(geom), ST_X(geom) FROM news_items_latest WHERE item_id = 'db-point';"
    output = _assert_sql_succeeds(migrated_database, sql)
    assert output.endswith("t|4326|35.69|139.69")


def test_database_accepts_non_marker_non_point_without_fake_coordinates(migrated_database):
    sql = _item_insert("db-polygon", "schema:polygon")
    sql += "SELECT marker_ready, has_coordinates, geom IS NULL FROM news_items_latest WHERE item_id = 'db-polygon';"
    output = _assert_sql_succeeds(migrated_database, sql)
    assert output.endswith("f|f|t")


def test_database_rejects_marker_without_coordinates_and_invalid_ranges(migrated_database):
    _assert_sql_fails(
        migrated_database,
        _item_insert(
            "db-no-coords",
            "schema:no-coords",
            geometry_type="Point",
            marker_ready="TRUE",
        ),
    )
    _assert_sql_fails(
        migrated_database,
        _item_insert(
            "db-bad-lat",
            "schema:bad-lat",
            geometry_type="Point",
            latitude="91",
            longitude="10",
            has_coordinates="TRUE",
            marker_ready="TRUE",
        ),
    )
    _assert_sql_fails(
        migrated_database,
        _item_insert(
            "db-bad-lon",
            "schema:bad-lon",
            geometry_type="Point",
            latitude="10",
            longitude="181",
            has_coordinates="TRUE",
            marker_ready="TRUE",
        ),
    )


def test_database_enforces_dedupe_key_uniqueness(migrated_database):
    _assert_sql_succeeds(
        migrated_database,
        _item_insert("db-dedupe-one", "schema:duplicate"),
    )
    _assert_sql_fails(
        migrated_database,
        _item_insert("db-dedupe-two", "schema:duplicate"),
    )


def test_database_accepts_fetch_history_raw_ref_and_future_source(migrated_database):
    sql = """
        INSERT INTO news_sources (
          source_id, source_family, display_name, endpoint_url, attribution
        ) VALUES (
          'future-source', 'article_feed', 'Future Source',
          'https://example.invalid/feed', 'Future source attribution'
        );
        INSERT INTO news_fetch_runs (
          fetch_run_id, source_id, source_family, run_type, status, started_at,
          completed_at, fetched_item_count, normalized_item_count, marker_ready_count
        ) VALUES (
          'db-run', 'future-source', 'article_feed', 'proof', 'success',
          NOW() - INTERVAL '1 minute', NOW(), 1, 1, 0
        );
    """
    sql += _item_insert(
        "db-future-item",
        "future:item:1",
        source_id="future-source",
        source_family="article_feed",
        geometry_type="Polygon",
    )
    sql += """
        INSERT INTO news_item_history (
          history_id, item_id, source_id, dedupe_key, version, snapshot, fetch_run_id
        ) VALUES (
          'db-history', 'db-future-item', 'future-source', 'future:item:1', 1,
          '{"title":"Schema test item"}'::JSONB, 'db-run'
        );
        INSERT INTO news_raw_message_refs (
          raw_ref_id, fetch_run_id, source_id, source_object_id, dedupe_key,
          raw_evidence_uri, raw_file_offset, raw_file_line
        ) VALUES (
          'db-raw-ref', 'db-run', 'future-source', 'item-1', 'future:item:1',
          'raw/layer_08_news_osint/future-source/run.jsonl', 0, 1
        );
        SELECT
          (SELECT count(*) FROM news_fetch_runs WHERE fetch_run_id = 'db-run'),
          (SELECT count(*) FROM news_item_history WHERE history_id = 'db-history'),
          (SELECT count(*) FROM news_raw_message_refs WHERE raw_ref_id = 'db-raw-ref');
    """
    output = _assert_sql_succeeds(migrated_database, sql)
    assert output.endswith("1|1|1")


def test_news_work_order_changes_stay_in_allowed_paths():
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    changed_paths = [
        line[3:].replace("\\", "/")
        for line in result.stdout.splitlines()
        if line and not line.startswith("?? .pytest_cache/")
    ]
    if not changed_paths:
        pytest.skip("Scope guard applies only during dirty worktree review")

    allowed_prefixes = (
        "database/migrations/layers/layer_08_news_osint/",
        "database/ingestion/layers/layer_08_news_osint/",
        "tests/data/layer_08_news_osint/",
        "specs/007-layer-08-news-osint-mvp/",
        "docs/state/HANDOFF_LOG.md",
        "services/fetch-orchestrator/src/layers/layer_08_news_osint/",
    )
    assert all(path.startswith(allowed_prefixes) for path in changed_paths), changed_paths


def test_news_work_order_adds_no_raw_environment_api_or_frontend_files():
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    changed_paths = [line[3:].replace("\\", "/") for line in result.stdout.splitlines() if line]

    assert not any(path.startswith(("raw/", "tmp/", "data/", "database/raw/")) for path in changed_paths)
    assert not any(path.endswith(".env") or ".env." in path for path in changed_paths)
    assert not any(path.startswith(("apps/api/", "apps/web/", "packages/ui/", "packages/layers/")) for path in changed_paths)
