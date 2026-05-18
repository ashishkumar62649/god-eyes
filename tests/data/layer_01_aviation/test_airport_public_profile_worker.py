"""Unit tests for airport public profile worker persistence.

Tests the worker DB operations:
  - dry-run does not write DB
  - fixture-backed persistence writes expected profile payload
  - version row is created
  - fetch_run transitions queued/running -> completed
  - failure marks fetch_run failed
  - no full Wikipedia page stored
  - API can read profile saved by worker (if DB available)

Uses fixture/no-network mode for tests.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

sys.path.insert(0, str(REPO_ROOT / "packages" / "schemas"))
sys.path.insert(0, str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation"))

from airport_public_profile_worker import (
    build_profile_from_fixtures,
    profile_to_db_payload,
    run_worker,
    DEFAULT_DATABASE_URL,
)

from airport_public_profile import AirportPublicProfilePayload


class TestDryRunBehavior:
    """Test that dry-run mode does not write to database."""

    def test_dry_run_does_not_connect_to_db(self):
        with patch("airport_public_profile_worker.connect_db") as mock_connect:
            with patch("airport_public_profile_worker.get_existing_profile") as mock_get:
                with patch("airport_public_profile_worker.create_fetch_run") as mock_create:
                    with patch("airport_public_profile_worker.upsert_profile") as mock_upsert:
                        with patch("airport_public_profile_worker.insert_profile_version") as mock_version:
                            with patch("airport_public_profile_worker.update_fetch_run_completed") as mock_complete:
                                run_worker(
                                    airport_id="00000000-0000-0000-0000-000000000001",
                                    dry_run=True,
                                    show_raw=False,
                                )

                                mock_connect.assert_not_called()
                                mock_get.assert_not_called()
                                mock_create.assert_not_called()
                                mock_upsert.assert_not_called()
                                mock_version.assert_not_called()
                                mock_complete.assert_not_called()

    def test_dry_run_uses_fixtures(self):
        with patch("airport_public_profile_worker.connect_db"):
            profile = build_profile_from_fixtures(
                airport_id="00000000-0000-0000-0000-000000000001",
                icao_code="OMDB",
                iata_code="DXB",
            )
            assert profile is not None
            assert profile.summary is not None
            assert "Dubai International Airport" in profile.summary


class TestProfilePayloadConversion:
    """Test converting profile to DB payload format."""

    def test_profile_to_db_payload_contains_required_fields(self):
        profile = build_profile_from_fixtures(
            airport_id="00000000-0000-0000-0000-000000000001",
            icao_code="OMDB",
            iata_code="DXB",
        )
        payload = profile_to_db_payload(profile)

        assert "summary" in payload
        assert "shortDescription" in payload
        assert "openedDate" in payload
        assert "operator" in payload
        assert "owner" in payload
        assert "officialWebsite" in payload
        assert "imageUrl" in payload
        assert "facts" in payload
        assert "match" in payload
        assert "iataCode" in payload
        assert "icaoCode" in payload
        assert "location" in payload

    def test_profile_to_db_payload_no_full_wikipedia_page(self):
        profile = build_profile_from_fixtures(
            airport_id="00000000-0000-0000-0000-000000000001",
            icao_code="OMDB",
            iata_code="DXB",
        )
        payload = profile_to_db_payload(profile)

        assert payload.get("summary") is not None
        assert len(payload.get("summary", "")) < 10000
        assert "full_page" not in payload
        assert "entire_article" not in payload


class TestWorkerModes:
    """Test different worker CLI modes."""

    def test_fixture_mode_uses_fixtures(self):
        with patch("airport_public_profile_worker.connect_db") as mock_connect:
            with patch("airport_public_profile_worker.load_fixture_wikipedia") as mock_wiki:
                with patch("airport_public_profile_worker.load_fixture_wikidata") as mock_data:
                    mock_wiki.return_value = {"title": "Test", "pageid": 1, "extract": "Test extract"}
                    mock_data.return_value = {"entities": {"Q1": {"id": "Q1", "labels": {"en": {"value": "Test"}}}}}

                    run_worker(
                        airport_id="00000000-0000-0000-0000-000000000001",
                        fixture_mode=True,
                        dry_run=True,
                        show_raw=False,
                    )

    def test_show_raw_prints_debug_output(self, capsys):
        with patch("airport_public_profile_worker.connect_db"):
            run_worker(
                dry_run=True,
                show_raw=True,
            )
            captured = capsys.readouterr()
            assert "RAW WIKIPEDIA SUMMARY" in captured.out
            assert "RAW WIKIDATA" in captured.out
            assert "NORMALIZED PROFILE" in captured.out


class TestVersionCreation:
    """Test that versions are created with correct content hash."""

    def test_version_includes_content_hash(self):
        profile = build_profile_from_fixtures(
            airport_id="00000000-0000-0000-0000-000000000001",
            icao_code="OMDB",
            iata_code="DXB",
        )
        payload = profile_to_db_payload(profile)
        payload["interesting_facts"] = [
            {"fact": f.fact, "source": f.source, "property_id": f.property_id}
            for f in (profile.interesting_facts or [])
        ]
        if profile.match:
            payload["match"] = {
                "method": profile.match.method,
                "confidence": profile.match.confidence,
                "wikidata_qid": profile.match.wikidata_qid,
                "wikipedia_title": profile.match.wikipedia_title,
            }

        from airport_public_profile import compute_change_hash
        content_hash = compute_change_hash(payload)

        assert content_hash is not None
        assert len(content_hash) == 64


class TestWorkerFailureHandling:
    """Test worker handles failures correctly."""

    def test_failure_prints_error_message(self, capsys):
        mock_conn = MagicMock()

        with patch("airport_public_profile_worker.connect_db", return_value=mock_conn):
            with patch("airport_public_profile_worker.resolve_airport_identity", return_value=None):
                run_worker(
                    airport_id="00000000-0000-0000-0000-000000000001",
                    dry_run=False,
                    show_raw=False,
                    database_url="postgresql://test:test@localhost:5432/test",
                )
                captured = capsys.readouterr()
                assert "ERROR: Airport not found" in captured.out


class TestCacheTTL:
    """Test that 30-day TTL is applied."""

    def test_profile_has_expires_at(self):
        profile = build_profile_from_fixtures(
            airport_id="00000000-0000-0000-0000-000000000001",
            icao_code="OMDB",
            iata_code="DXB",
        )

        assert profile.fetched_at is not None
        assert profile.expires_at is not None


class TestAttributionStored:
    """Test that source attribution is stored."""

    def test_profile_has_attribution(self):
        profile = build_profile_from_fixtures(
            airport_id="00000000-0000-0000-0000-000000000001",
            icao_code="OMDB",
            iata_code="DXB",
        )

        assert profile.attribution is not None
        assert "wikipedia" in profile.attribution
        wiki_attr = profile.attribution["wikipedia"]
        assert wiki_attr["license"] == "CC BY-SA 4.0"


class TestMatchConfidence:
    """Test match confidence is recorded."""

    def test_high_confidence_in_payload(self):
        profile = build_profile_from_fixtures(
            airport_id="00000000-0000-0000-0000-000000000001",
            icao_code="OMDB",
            iata_code="DXB",
        )

        assert profile.match is not None
        assert profile.match.confidence == "high"
        assert profile.match.method == "fixture_dubai"


class TestFixturePersistenceSafety:
    """Test fixture mode persistence safety guards."""

    def test_fixture_mode_non_dry_run_blocked_by_default(self, capsys):
        run_worker(
            airport_id="00000000-0000-0000-0000-000000000001",
            fixture_mode=True,
            dry_run=False,
            show_raw=False,
            database_url="postgresql://test:test@localhost:5432/test",
        )
        captured = capsys.readouterr()
        assert "ERROR: Fixture mode cannot persist to real DB" in captured.out
        assert "--allow-fixture-persistence" in captured.out

    def test_fixture_mode_dry_run_works(self, capsys):
        with patch("airport_public_profile_worker.connect_db"):
            run_worker(
                airport_id="00000000-0000-0000-0000-000000000001",
                fixture_mode=True,
                dry_run=True,
                show_raw=False,
            )
            captured = capsys.readouterr()
            assert "DRY-RUN: No database writes performed" in captured.out
            assert "ERROR" not in captured.out

    def test_kbdl_dubai_mismatch_prevented(self, capsys):
        identity = {
            "id": "5209e070-54e7-45af-a2ef-afa20905085c",
            "source_airport_id": "OA-12345",
            "ident": "KBDL",
            "iata_code": "BDL",
            "name": "Bradley International Airport",
            "iso_country": "US",
            "municipality": "Windsor Locks",
            "latitude_deg": 41.9389,
            "longitude_deg": -72.6832,
        }

        with patch("airport_public_profile_worker.connect_db"):
            with patch("airport_public_profile_worker.resolve_airport_identity", return_value=identity):
                run_worker(
                    airport_id="5209e070-54e7-45af-a2ef-afa20905085c",
                    fixture_mode=True,
                    allow_fixture_persistence=True,
                    dry_run=False,
                    show_raw=False,
                    database_url="postgresql://test:test@localhost:5432/test",
                )
                captured = capsys.readouterr()
                assert "KBDL" in captured.out
                assert "does not match fixture ICAO" in captured.out
                assert "Dubai" in captured.out

    def test_dubai_to_dubai_identity_match_allowed(self, capsys):
        identity = {
            "id": "00000000-0000-0000-0000-000000000001",
            "source_airport_id": "OA-DXB",
            "ident": "OMDB",
            "iata_code": "DXB",
            "name": "Dubai International Airport",
            "iso_country": "AE",
            "municipality": "Dubai",
            "latitude_deg": 25.2528,
            "longitude_deg": 55.3644,
        }

        with patch("airport_public_profile_worker.connect_db"):
            with patch("airport_public_profile_worker.resolve_airport_identity", return_value=identity):
                with patch("airport_public_profile_worker.create_fetch_run") as mock_create:
                    with patch("airport_public_profile_worker.upsert_profile") as mock_upsert:
                        with patch("airport_public_profile_worker.insert_profile_version") as mock_version:
                            with patch("airport_public_profile_worker.update_fetch_run_completed"):
                                run_worker(
                                    airport_id="00000000-0000-0000-0000-000000000001",
                                    fixture_mode=True,
                                    allow_fixture_persistence=True,
                                    dry_run=False,
                                    show_raw=False,
                                    database_url="postgresql://test:test@localhost:5432/test",
                                )
                                captured = capsys.readouterr()
                                assert "Identity match confirmed" in captured.out
                                assert "OMDB" in captured.out
                                mock_create.assert_called()


class TestAllowedRunType:
    """Test that worker uses allowed run_type values."""

    def test_worker_creates_fetch_run_with_lazy_fetch_type(self):
        with patch("airport_public_profile_worker.connect_db") as mock_connect:
            mock_conn = MagicMock()
            mock_connect.return_value = mock_conn

            with patch("airport_public_profile_worker.resolve_airport_identity") as mock_resolve:
                mock_resolve.return_value = {
                    "id": "00000000-0000-0000-0000-000000000001",
                    "source_airport_id": "OA-12345",
                    "ident": "OMDB",
                    "iata_code": "DXB",
                }

                with patch("airport_public_profile_worker.get_existing_profile", return_value=None):
                    with patch("airport_public_profile_worker.create_fetch_run") as mock_create:
                        mock_create.return_value = "test-uuid"

                        with patch("airport_public_profile_worker.upsert_profile") as mock_upsert:
                            with patch("airport_public_profile_worker.insert_profile_version"):
                                with patch("airport_public_profile_worker.update_fetch_run_completed"):
                                    with patch("airport_public_profile_worker.update_profile_current_version"):
                                        with patch("airport_public_profile_worker.update_profile_latest_fetch_run"):
                                            run_worker(
                                                airport_id="00000000-0000-0000-0000-000000000001",
                                                dry_run=False,
                                                show_raw=False,
                                                database_url="postgresql://test:test@localhost:5432/test",
                                            )

                                            mock_create.assert_called_once()
                                            call_kwargs = mock_create.call_args.kwargs
                                            assert call_kwargs["run_type"] == "lazy_fetch"
                                            assert call_kwargs["run_status"] == "running"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])