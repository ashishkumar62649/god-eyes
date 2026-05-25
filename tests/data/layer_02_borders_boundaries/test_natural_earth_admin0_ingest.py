import importlib.util
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = (
    REPO_ROOT
    / "services"
    / "fetch-orchestrator"
    / "src"
    / "layers"
    / "layer_02_borders_boundaries"
    / "natural_earth_admin0_ingest.py"
)


def script_text() -> str:
    if not SCRIPT_PATH.exists():
        return ""
    return SCRIPT_PATH.read_text(encoding="utf-8")


def load_module():
    assert SCRIPT_PATH.exists()
    spec = importlib.util.spec_from_file_location("natural_earth_admin0_ingest", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_natural_earth_ingest_script_exists_in_fetch_orchestrator():
    assert SCRIPT_PATH.exists()


def test_dry_run_is_default_and_persist_requires_explicit_flag():
    module = load_module()

    parser = module.build_arg_parser()
    default_args = parser.parse_args([])
    persist_args = parser.parse_args(["--persist"])

    assert default_args.persist is False
    assert module.is_dry_run(default_args) is True
    assert persist_args.persist is True
    assert module.is_dry_run(persist_args) is False


def test_uses_official_natural_earth_url_and_no_random_mirrors():
    module = load_module()
    text = script_text().lower()

    assert module.NATURAL_EARTH_ADMIN0_50M_URL == (
        "https://naturalearth.s3.amazonaws.com/50m_cultural/"
        "ne_50m_admin_0_countries.zip"
    )
    assert "github.com" not in text
    assert "gist.github" not in text
    assert "kaggle.com" not in text
    assert "figshare.com" not in text


def test_source_metadata_is_mvp_local_dev_only_and_not_approved():
    module = load_module()
    metadata = module.build_source_metadata()

    assert metadata["source_id"] == "natural_earth_admin0_50m"
    assert metadata["source_name"] == "Natural Earth Admin-0 Countries 1:50m"
    assert metadata["approved_for_india"] is False
    assert metadata["approved_for_non_india"] is False
    assert metadata["india_conflict_checked"] is False
    assert "mvp/local/dev only" in metadata["approval_notes"].lower()
    assert "not production-approved" in metadata["approval_notes"].lower()
    assert "not india-compliant" in metadata["approval_notes"].lower()


def test_no_production_approval_or_soi_approval_claims_in_script():
    text = script_text().lower()

    forbidden_phrases = [
        "production-approved true",
        "approved_for_india true",
        "approved_for_non_india true",
        "india-compliant source",
        "survey of india replacement",
        "soi_approved",
    ]
    for phrase in forbidden_phrases:
        assert phrase not in text


def test_normalized_boundary_marks_india_requires_review_and_never_soi_approved():
    module = load_module()
    boundary = module.normalize_boundary_record(
        {
            "NE_ID": "1159320845",
            "ISO_A2": "IN",
            "ISO_A3": "IND",
            "ADM0_A3": "IND",
            "NAME": "India",
            "NAME_LONG": "India",
        },
        "MULTIPOLYGON(((0 0,1 0,1 1,0 0)))",
    )

    assert boundary["india_sensitive"] is True
    assert boundary["india_compliance_status"] == "requires_soi_review"
    assert boundary["india_compliance_status"] != "soi_approved"


def test_normalized_non_india_boundary_is_not_applicable_for_india_compliance():
    module = load_module()
    boundary = module.normalize_boundary_record(
        {
            "NE_ID": "123",
            "ISO_A2": "FR",
            "ISO_A3": "FRA",
            "ADM0_A3": "FRA",
            "NAME": "France",
            "NAME_LONG": "France",
        },
        "MULTIPOLYGON(((0 0,1 0,1 1,0 0)))",
    )

    assert boundary["india_sensitive"] is False
    assert boundary["india_compliance_status"] == "not_applicable"


def test_normalized_boundary_drops_non_iso_length_country_codes():
    module = load_module()
    boundary = module.normalize_boundary_record(
        {
            "NE_ID": "1159321335",
            "ISO_A2": "CN-TW",
            "ISO_A3": "TWN",
            "ADM0_A3": "TWN",
            "NAME": "Taiwan",
            "NAME_LONG": "Taiwan",
        },
        "MULTIPOLYGON(((0 0,1 0,1 1,0 0)))",
    )

    assert boundary["country_iso2"] is None
    assert boundary["country_iso3"] == "TWN"


def test_dbf_text_normalization_removes_nul_padding():
    module = load_module()
    field = module.DbfField("NAME", "C", 10, 0)

    assert module.parse_dbf_value(b"India\x00\x00   ", field) == "India"


def test_script_uses_parameterized_sql_and_idempotent_conflict_handling():
    text = script_text().lower()

    assert "cur.execute(" in text
    assert "%s" in text
    assert "on conflict (source_id)" in text
    assert "on conflict (source_id, source_object_id) where source_object_id is not null" in text
    assert "do update set" in text


def test_full_natural_earth_dataset_is_not_committed_as_fixture():
    forbidden_suffixes = {".zip", ".shp", ".shx", ".dbf", ".prj", ".cpg", ".geojson", ".kml"}
    data_dir = REPO_ROOT / "tests" / "data" / "layer_02_borders_boundaries"
    committed_like_data_files = [
        path for path in data_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in forbidden_suffixes
    ]

    assert committed_like_data_files == []
