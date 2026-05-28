import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_01_aviation"
    / "012_aviation_live_aircraft_tables.sql"
)


def migration_text() -> str:
    if not MIGRATION_PATH.exists():
        return ""
    return MIGRATION_PATH.read_text(encoding="utf-8").lower()


def test_aviation_live_aircraft_migration_exists_and_creates_required_tables():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists postgis" in migration
    assert "create table if not exists aviation_aircraft_sources" in migration
    assert "create table if not exists aviation_aircraft_latest" in migration
    assert "create table if not exists aviation_aircraft_observations" in migration
    assert "create table if not exists aviation_aircraft_raw_batches" in migration


def test_aviation_live_aircraft_migration_seeds_required_sources_with_caveats():
    migration = migration_text()

    required_terms = [
        "insert into aviation_aircraft_sources",
        "airplanes_live_v2",
        "opensky_trino",
        "airplanes.live",
        "non-commercial",
        "no sla",
        "no global",
        "civil aircraft",
        "camera region",
        "opensky network",
        "trino",
        "historical",
        "future",
        "requires application",
        "not used for mvp live tracking",
    ]
    for term in required_terms:
        assert term in migration


def test_aviation_live_aircraft_tables_have_layer_id_defaults_and_source_object_conventions():
    migration = migration_text()

    required_terms = [
        "layer_id text not null default 'layer_01_aviation'",
        "source_id text not null",
        "source_object_id text not null",
        "aviation_aircraft_sources_layer_id_check",
        "aviation_aircraft_latest_layer_id_check",
        "aviation_aircraft_observations_layer_id_check",
        "aviation_aircraft_raw_batches_layer_id_check",
    ]
    for term in required_terms:
        assert term in migration


def test_aviation_live_aircraft_migration_has_required_unique_constraints():
    migration = migration_text()

    required_terms = [
        "constraint aviation_aircraft_latest_source_object_unique",
        "unique (source_id, source_object_id)",
        "constraint aviation_aircraft_observations_source_object_observed_unique",
        "unique (source_id, source_object_id, observed_at)",
    ]
    for term in required_terms:
        assert term in migration


def test_aviation_live_aircraft_migration_has_required_indexes():
    migration = migration_text()

    required_terms = [
        "idx_aviation_aircraft_latest_source_object",
        "on aviation_aircraft_latest(source_id, source_object_id)",
        "idx_aviation_aircraft_latest_observed_at",
        "on aviation_aircraft_latest(observed_at desc)",
        "idx_aviation_aircraft_latest_stale_after",
        "on aviation_aircraft_latest(stale_after)",
        "idx_aviation_aircraft_latest_geom_gist",
        "on aviation_aircraft_latest using gist(geom)",
        "idx_aviation_aircraft_latest_is_military",
        "where is_military = true",
        "idx_aviation_aircraft_latest_is_interesting",
        "where is_interesting = true",
        "idx_aviation_aircraft_latest_is_pia",
        "where is_pia = true",
        "idx_aviation_aircraft_latest_is_ladd",
        "where is_ladd = true",
        "idx_aviation_aircraft_observations_source_object_time",
        "on aviation_aircraft_observations(source_id, source_object_id, observed_at desc)",
        "idx_aviation_aircraft_observations_observed_at",
        "on aviation_aircraft_observations(observed_at desc)",
        "idx_aviation_aircraft_observations_geom_gist",
        "on aviation_aircraft_observations using gist(geom)",
        "idx_aviation_aircraft_raw_batches_fetched_at",
        "on aviation_aircraft_raw_batches(fetched_at desc)",
        "idx_aviation_aircraft_raw_batches_source_fetched",
        "on aviation_aircraft_raw_batches(source_id, fetched_at desc)",
        "idx_aviation_aircraft_raw_batches_endpoint",
        "on aviation_aircraft_raw_batches(endpoint)",
    ]
    for term in required_terms:
        assert term in migration


def test_aviation_live_aircraft_migration_has_raw_batch_evidence_columns():
    migration = migration_text()

    required_terms = [
        "endpoint text not null",
        "fetch_params jsonb",
        "fetched_at timestamptz not null default now()",
        "http_status integer",
        "aircraft_count integer",
        "source_now_ts double precision",
        "source_ctime_ts double precision",
        "source_ptime_ms double precision",
        "raw_sample jsonb",
        "error_message text",
    ]
    for term in required_terms:
        assert term in migration


def test_aviation_live_aircraft_migration_is_additive_and_non_destructive():
    migration = migration_text()

    destructive_terms = [
        "drop table",
        "drop column",
        "drop index",
        "drop extension",
        "truncate",
        "delete from",
        "alter table aviation_airports",
        "alter table aviation_runways",
        "alter table aviation_navaids",
        "alter table aviation_airport_frequencies",
        "alter table aviation_countries",
        "alter table aviation_regions",
    ]
    for term in destructive_terms:
        assert term not in migration


def test_aviation_live_aircraft_work_order_changes_stay_in_allowed_paths():
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

    allowed_prefixes = (
        "database/migrations/layers/layer_01_aviation/012_aviation_live_aircraft_tables.sql",
        "tests/data/layer_01_aviation/",
        "docs/state/HANDOFF_LOG.md",
        "docs/state/CURRENT_PROJECT_STATE.md",
    )
    assert changed_paths
    assert all(path.startswith(allowed_prefixes) for path in changed_paths)


def test_aviation_live_aircraft_work_order_adds_no_raw_data_files():
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
        if line
    ]

    raw_data_paths = [
        path
        for path in changed_paths
        if path.startswith(("data/", "raw/", "database/raw/", "storage/raw/"))
    ]
    raw_data_suffixes = (".csv", ".json", ".jsonl", ".parquet", ".geojson")
    assert not raw_data_paths
    assert not any(
        path.endswith(raw_data_suffixes) and "fixtures/" not in path
        for path in changed_paths
    )
