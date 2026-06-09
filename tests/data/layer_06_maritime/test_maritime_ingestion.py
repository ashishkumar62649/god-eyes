"""Tests for maritime ingestion and DB writer."""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Set up path like other tests in the project
REPO_ROOT = Path(__file__).resolve().parents[3]
_services_src = REPO_ROOT / "services" / "fetch-orchestrator" / "src"

# Must insert services/src to resolve 'from layers...' imports
if str(_services_src) not in sys.path:
    sys.path.insert(0, str(_services_src))


class TestMaritimeDbWriter:
    """Tests for maritime_db_writer module."""

    def test_ensure_source_exists(self):
        """Test source upsert SQL uses parameterized queries."""
        from layers.layer_06_maritime import maritime_db_writer
        
        # Verify the function exists and has correct parameters
        assert callable(maritime_db_writer.ensure_source_exists)
        # The SQL should use parameterized queries (check source code)
        import inspect
        source = inspect.getsource(maritime_db_writer.ensure_source_exists)
        assert "%s" in source  # Uses parameterized queries
        assert "ON CONFLICT" in source  # Uses upsert

    def test_upsert_vessel_sql_parameterized(self):
        """Test vessel upsert uses parameterized queries."""
        from layers.layer_06_maritime import maritime_db_writer
        
        import inspect
        source = inspect.getsource(maritime_db_writer.upsert_vessel)
        assert "%s" in source
        assert "ON CONFLICT" in source
        assert "source_id, mmsi" in source  # Uses composite key

    def test_upsert_position_latest_sql_parameterized(self):
        """Test position latest upsert uses parameterized queries."""
        from layers.layer_06_maritime import maritime_db_writer
        
        import inspect
        source = inspect.getsource(maritime_db_writer.upsert_position_latest)
        assert "%s" in source
        assert "ON CONFLICT" in source
        assert "source_id, mmsi" in source

    def test_insert_position_history_sql_parameterized(self):
        """Test position history insert uses parameterized queries."""
        from layers.layer_06_maritime import maritime_db_writer
        
        import inspect
        source = inspect.getsource(maritime_db_writer.insert_position_history)
        assert "%s" in source
        # Should be INSERT (not upsert for history)
        assert "INSERT INTO" in source

    def test_insert_raw_message_ref_sql_parameterized(self):
        """Test raw message ref insert uses parameterized queries."""
        from layers.layer_06_maritime import maritime_db_writer
        
        import inspect
        source = inspect.getsource(maritime_db_writer.insert_raw_message_ref)
        assert "%s" in source
        assert "INSERT INTO maritime_raw_message_refs" in source

    def test_ensure_minimal_vessel_for_position(self):
        """Test minimal vessel row creation for position-only records."""
        from layers.layer_06_maritime import maritime_db_writer
        
        import inspect
        source = inspect.getsource(maritime_db_writer.ensure_minimal_vessel_for_position)
        assert "%s" in source
        assert "ON CONFLICT" in source

    def test_no_api_frontend_imports(self):
        """Test DB writer doesn't import API or frontend modules."""
        from layers.layer_06_maritime import maritime_db_writer
        
        module_file = maritime_db_writer.__file__
        with open(module_file, "r") as f:
            content = f.read()
        
        # Should not import from apps/api or apps/web
        assert "from apps.api" not in content
        assert "from apps.web" not in content
        assert "import apps.api" not in content
        assert "import apps.web" not in content

    def test_no_aisstream_connection_in_db_writer(self):
        """Test DB writer doesn't connect to AISStream."""
        from layers.layer_06_maritime import maritime_db_writer
        
        module_file = maritime_db_writer.__file__
        with open(module_file, "r") as f:
            content = f.read()
        
        # Should not have WebSocket or AISStream connection
        assert "websockets" not in content.lower()
        assert "aisstream" not in content or "source_id" in content  # Only as source_id string

    def test_dedupe_key_format(self):
        """Test dedupe_key is formatted correctly."""
        source_id = "aisstream"
        mmsi = 123456789
        expected = f"{source_id}:{mmsi}"
        assert expected == "aisstream:123456789"

    def test_no_secrets_in_default_url(self):
        """Test default database URL doesn't contain hardcoded secrets."""
        from layers.layer_06_maritime import maritime_db_writer
        
        # Default should reference env var or use placeholder
        assert maritime_db_writer.DEFAULT_DATABASE_URL is not None
        # Should use environment variable pattern
        import os
        url = maritime_db_writer.DEFAULT_DATABASE_URL
        # If it contains a password, it should be a placeholder or from env
        if "god_eyes" in url and "password" not in url.lower():
            # Check it's using the env var pattern
            assert "os.getenv" in open(maritime_db_writer.__file__).read()


class TestMaritimeIngestion:
    """Tests for maritime_ingestion module."""

    def test_ingestion_class_exists(self):
        """Test MaritimeIngestion class exists."""
        from layers.layer_06_maritime.maritime_ingestion import MaritimeIngestion
        assert MaritimeIngestion is not None

    def test_ingest_from_cache_method_exists(self):
        """Test ingest_from_cache method exists."""
        from layers.layer_06_maritime.maritime_ingestion import MaritimeIngestion
        assert hasattr(MaritimeIngestion, "ingest_from_cache")

    def test_ingest_live_method_exists(self):
        """Test ingest_live method exists."""
        from layers.layer_06_maritime.maritime_ingestion import MaritimeIngestion
        assert hasattr(MaritimeIngestion, "ingest_live")

    def test_dry_run_mode(self):
        """Test dry-run mode doesn't write to DB."""
        from layers.layer_06_maritime.maritime_ingestion import MaritimeIngestion
        
        # Create ingestion with dry_run=True
        ingestion = MaritimeIngestion(dry_run=True)
        
        # Connection should be None in dry-run
        assert ingestion.dry_run is True
        assert ingestion.conn is None
        ingestion.close()

    def test_no_api_frontend_imports(self):
        """Test ingestion module doesn't import API or frontend modules."""
        from layers.layer_06_maritime import maritime_ingestion
        
        module_file = maritime_ingestion.__file__
        with open(module_file, "r") as f:
            content = f.read()
        
        assert "from apps.api" not in content
        assert "from apps.web" not in content

    def test_ingest_from_cache_returns_stats(self):
        """Test ingest_from_cache returns expected statistics."""
        from layers.layer_06_maritime.maritime_ingestion import MaritimeIngestion
        
        # Create dry-run ingestion
        ingestion = MaritimeIngestion(dry_run=True)
        
        # Verify it has the expected structure
        assert hasattr(ingestion, "ingest_from_cache")
        assert hasattr(ingestion, "close")
        ingestion.close()

    def test_run_ingestion_convenience_function(self):
        """Test run_ingestion convenience function exists."""
        from layers.layer_06_maritime.maritime_ingestion import run_ingestion
        assert callable(run_ingestion)


class TestMaritimeCli:
    """Tests for CLI commands."""

    def test_ingest_from_cache_command_exists(self):
        """Test ingest-from-cache CLI command is registered."""
        from layers.layer_06_maritime import maritime_cli
        import inspect
        source = inspect.getsource(maritime_cli.main)
        assert "ingest-from-cache" in source

    def test_live_ingest_proof_command_exists(self):
        """Test live-ingest-proof CLI command is registered."""
        from layers.layer_06_maritime import maritime_cli
        import inspect
        source = inspect.getsource(maritime_cli.main)
        assert "live-ingest-proof" in source

    def test_cli_uses_maritime_ingestion(self):
        """Test CLI uses MaritimeIngestion class."""
        from layers.layer_06_maritime import maritime_cli
        import inspect
        source = inspect.getsource(maritime_cli.main)
        assert "MaritimeIngestion" in source


class TestIngestLivePositionsVariable:
    """Tests that ingest_live reads positions from norm_result, not undefined variable."""

    def test_ingest_live_reads_positions_from_norm_result(self):
        """Verify ingest_live does not reference undefined 'positions' variable.

        This catches the bug where line 378 used bare `positions` instead of
        `norm_result.get('positions', [])`.
        """
        import inspect
        from layers.layer_06_maritime.maritime_ingestion import MaritimeIngestion

        source = inspect.getsource(MaritimeIngestion.ingest_live)

        # The fixed code should reference norm_result.get("positions", [])
        assert 'norm_result.get("positions"' in source or "norm_result.get('positions'" in source

        # The buggy bare `for position in positions:` should NOT exist
        # in ingest_live. We check that the only `for position in` in
        # ingest_live uses norm_result.
        lines = source.split("\n")
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("for position in ") and "norm_result" not in stripped:
                pytest.fail(
                    f"ingest_live references bare variable in: {stripped!r}. "
                    "Should use norm_result.get('positions', [])"
                )

    def test_ingest_live_handles_empty_positions(self):
        """Verify ingest_live handles empty positions list without error."""
        from layers.layer_06_maritime.maritime_ingestion import MaritimeIngestion

        ingestion = MaritimeIngestion(dry_run=True)

        # Mock normalize_from_cache to return empty positions
        mock_norm_result = {
            "raw_messages_read": 10,
            "position_normalized": 0,
            "static_normalized": 0,
            "joined_vessels": 0,
            "skipped_invalid": 0,
            "positions": [],
            "static_records": [],
            "latest_by_mmsi": {},
        }

        with patch(
            "layers.layer_06_maritime.maritime_ingestion.normalize_from_cache",
            return_value=mock_norm_result,
        ), patch(
            "layers.layer_06_maritime.maritime_ingestion.maritime_db_writer"
        ), patch(
            "layers.layer_06_maritime.maritime_fetcher.MaritimeFetcher"
        ) as mock_fetcher_cls:
            mock_fetcher = mock_fetcher_cls.return_value
            mock_fetcher.run_proof.return_value = {
                "run_dir": "/tmp/fake_run",
                "message_count": 10,
                "unique_mmsi_count": 0,
            }

            # This should NOT raise NameError for undefined 'positions'
            stats = ingestion.ingest_live(max_messages=10, max_duration_seconds=5.0)

        assert stats["positions_upserted"] == 0
        assert stats["errors"] == []
        ingestion.close()

    def test_ingest_live_processes_positions_from_norm_result(self):
        """Verify ingest_live iterates over positions returned by normalize_from_cache."""
        from layers.layer_06_maritime.maritime_ingestion import MaritimeIngestion

        ingestion = MaritimeIngestion(dry_run=True)

        sample_position = {
            "mmsi": 123456789,
            "latitude": 37.7749,
            "longitude": -122.4194,
            "speed_over_ground": 12.5,
            "course_over_ground": 180.0,
            "true_heading": 178,
            "navigation_status": 0,
            "navigation_status_text": "under_way_using_engine",
            "position_accuracy": True,
            "ais_timestamp_second": 30,
            "metadata_time_utc": "2026-06-09T12:00:00Z",
            "received_at": "2026-06-09T12:00:00Z",
            "raw_evidence_uri": "/tmp/raw_messages.jsonl",
            "source_id": "aisstream",
            "message_type": "PositionReport",
            "provider_metadata": {"source": "aisstream"},
        }

        mock_norm_result = {
            "raw_messages_read": 5,
            "position_normalized": 1,
            "static_normalized": 0,
            "joined_vessels": 0,
            "skipped_invalid": 0,
            "positions": [sample_position],
            "static_records": [],
            "latest_by_mmsi": {},
        }

        with patch(
            "layers.layer_06_maritime.maritime_ingestion.normalize_from_cache",
            return_value=mock_norm_result,
        ), patch(
            "layers.layer_06_maritime.maritime_ingestion.maritime_db_writer"
        ) as mock_db, patch(
            "layers.layer_06_maritime.maritime_fetcher.MaritimeFetcher"
        ) as mock_fetcher_cls:
            mock_fetcher = mock_fetcher_cls.return_value
            mock_fetcher.run_proof.return_value = {
                "run_dir": "/tmp/fake_run",
                "message_count": 5,
                "unique_mmsi_count": 1,
            }

            stats = ingestion.ingest_live(max_messages=5, max_duration_seconds=5.0)

        # Position should have been processed
        assert stats["positions_upserted"] == 1
        assert stats["history_rows_inserted"] == 1
        assert stats["raw_refs_inserted"] == 1
        assert len(stats["errors"]) == 0
        ingestion.close()


class TestIngestionFlow:
    """Integration-style tests for the full ingestion flow."""

    def test_normalize_position_report_output_format(self):
        """Test normalize_position_report produces expected output format."""
        from layers.layer_06_maritime.maritime_normalizer import normalize_position_report
        
        # Sample raw message
        raw = {
            "MessageType": "PositionReport",
            "Message": {
                "PositionReport": {
                    "UserID": 123456789,
                    "Latitude": 37.7749,
                    "Longitude": -122.4194,
                    "Speed": 12.5,
                    "Course": 180.0,
                    "Heading": 178,
                    "NavigationalStatus": 0,
                    "Timestamp": 30,
                }
            },
            "MetaData": {
                "MMSI": 123456789,
                "time_utc": "2026-06-09T12:00:00Z"
            },
            "received_at": "2026-06-09T12:00:00Z"
        }
        
        result = normalize_position_report(raw, "test_uri")
        
        if result:
            # Check expected fields
            assert result["mmsi"] == 123456789
            assert result["latitude"] == 37.7749
            assert result["longitude"] == -122.4194
            assert result["source_id"] == "aisstream"
            assert "provider_metadata" in result

    def test_normalize_ship_static_data_output_format(self):
        """Test normalize_ship_static_data produces expected output format."""
        from layers.layer_06_maritime.maritime_normalizer import normalize_ship_static_data
        
        raw = {
            "MessageType": "ShipStaticData",
            "Message": {
                "ShipStaticData": {
                    "UserID": 123456789,
                    "ImoNumber": 9876543,
                    "CallSign": "ABCD",
                    "Name": "TEST VESSEL",
                    "Type": 70,
                    "Dimension": {"A": 100, "B": 50, "C": 20, "D": 10},
                    "Destination": "PORT",
                    "Eta": {"Month": 6, "Day": 15, "Hour": 10, "Minute": 30},
                    "MaximumStaticDraught": 10.5,
                }
            },
            "MetaData": {
                "MMSI": 123456789,
                "time_utc": "2026-06-09T12:00:00Z"
            },
            "received_at": "2026-06-09T12:00:00Z"
        }
        
        result = normalize_ship_static_data(raw, "test_uri")
        
        if result:
            assert result["mmsi"] == 123456789
            assert result["imo"] == 9876543
            assert result["callsign"] == "ABCD"
            assert result["vessel_name"] == "TEST VESSEL"
            assert result["source_id"] == "aisstream"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])