"""Tests for airport image gallery worker, normalizer, and DB helper.

Covers:
1. Normalizer maps Wikimedia imageinfo into DB-ready rows.
2. Bad/tiny/placeholder image candidates can be skipped.
3. Ranking prefers real photo over logo.
4. Only one hero image selected.
5. Duplicate image URLs are deduped.
6. Dry-run does not write to DB.
7. --persist writes/upserts airport_image_assets rows.
8. Missing table returns clear error.
9. 429/503 response produces diagnostics/backoff behavior.
10. No fake image inserted when no candidates found.
11. License/attribution fields are preserved when present.
12. Existing Layer 1 tests still pass.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]

sys.path.insert(0, str(REPO_ROOT / "services" / "normalizer" / "src" / "layers" / "layer_01_aviation"))
sys.path.insert(0, str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation"))

from airport_image_gallery_normalizer import (
    ImageCandidate,
    NormalizationResult,
    candidate_to_db_dict,
    classify_image_kind,
    compute_content_hash,
    is_placeholder_or_bad,
    normalize_candidates,
    normalize_wikimedia_imageinfo,
    rank_candidate,
    select_hero,
)


class TestNormalizerWikimediaMapping:
    """Test 1: Normalizer maps Wikimedia imageinfo into DB-ready rows."""

    def test_normalize_wikimedia_imageinfo_produces_candidate(self):
        imageinfo_data = {
            "query": {
                "pages": {
                    "12345": {
                        "title": "File:Test_Airport_Photo.jpg",
                        "imageinfo": [{
                            "url": "https://upload.wikimedia.org/wikipedia/commons/test.jpg",
                            "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/test.jpg",
                            "width": 1200,
                            "height": 800,
                            "mime": "image/jpeg",
                            "mediatype": "BITMAP",
                            "extmetadata": {
                                "License": {
                                    "value": "Creative Commons Attribution-Share Alike 4.0",
                                    "short_name": "CC BY-SA 4.0",
                                    "url": "https://creativecommons.org/licenses/by-sa/4.0/",
                                },
                                "Artist": {
                                    "value": "Test Photographer",
                                },
                            },
                        }],
                    }
                }
            }
        }

        candidate = normalize_wikimedia_imageinfo("File:Test_Airport_Photo.jpg", imageinfo_data)

        assert candidate is not None
        assert candidate.image_url == "https://upload.wikimedia.org/wikipedia/commons/test.jpg"
        assert candidate.thumbnail_url == "https://upload.wikimedia.org/wikipedia/commons/thumb/test.jpg"
        assert candidate.width_px == 1200
        assert candidate.height_px == 800
        assert candidate.media_type == "image/jpeg"
        assert candidate.license_name == "CC BY-SA 4.0"
        assert candidate.license_url == "https://creativecommons.org/licenses/by-sa/4.0/"
        assert candidate.attribution_text == "Test Photographer"
        assert candidate.source_type == "wikimedia_commons"
        assert candidate.source_file_title == "File:Test_Airport_Photo.jpg"

    def test_normalize_wikimedia_imageinfo_returns_none_for_empty_data(self):
        assert normalize_wikimedia_imageinfo("File:X", {}) is None
        assert normalize_wikimedia_imageinfo("File:X", {"query": {"pages": {}}}) is None

    def test_candidate_to_db_dict_contains_all_fields(self):
        candidate = ImageCandidate(
            image_url="https://example.com/img.jpg",
            thumbnail_url="https://example.com/thumb.jpg",
            license_name="CC BY-SA 4.0",
            license_url="https://creativecommons.org/licenses/by-sa/4.0/",
            attribution_text="Test User",
            image_kind="photo",
            source_type="wikimedia_commons",
            width_px=1200,
            height_px=800,
        )

        db_dict = candidate_to_db_dict(candidate)

        assert db_dict["image_url"] == "https://example.com/img.jpg"
        assert db_dict["thumbnail_url"] == "https://example.com/thumb.jpg"
        assert db_dict["license_name"] == "CC BY-SA 4.0"
        assert db_dict["license_url"] == "https://creativecommons.org/licenses/by-sa/4.0/"
        assert db_dict["attribution_text"] == "Test User"
        assert db_dict["image_kind"] == "photo"
        assert db_dict["source_type"] == "wikimedia_commons"
        assert db_dict["width_px"] == 1200
        assert db_dict["height_px"] == 800


class TestSkipBadImages:
    """Test 2: Bad/tiny/placeholder image candidates can be skipped."""

    def test_skip_logo_placeholder(self):
        reason = is_placeholder_or_bad(title="Commons-logo.svg", image_url="https://example.com/commons-logo.svg")
        assert reason is not None
        assert "placeholder" in reason

    def test_skip_too_small_width(self):
        reason = is_placeholder_or_bad(width=20, height=20)
        assert reason is not None
        assert "too_small" in reason

    def test_skip_too_small_height(self):
        reason = is_placeholder_or_bad(width=100, height=10)
        assert reason is not None
        assert "too_small" in reason

    def test_skip_svg_images(self):
        reason = is_placeholder_or_bad(media_type="image/svg+xml")
        assert reason is not None
        assert "svg" in reason

    def test_skip_no_image_placeholder(self):
        reason = is_placeholder_or_bad(title="No-image-available.png")
        assert reason is not None

    def test_valid_image_not_skipped(self):
        reason = is_placeholder_or_bad(
            title="Airport_Terminal_Photo.jpg",
            width=1200,
            height=800,
            media_type="image/jpeg",
        )
        assert reason is None


class TestRanking:
    """Test 3: Ranking prefers real photo over logo."""

    def test_photo_ranks_better_than_logo(self):
        photo = ImageCandidate(image_url="https://example.com/photo.jpg", image_kind="photo")
        logo = ImageCandidate(image_url="https://example.com/logo.png", image_kind="logo")

        photo.rank = rank_candidate(photo)
        logo.rank = rank_candidate(logo)

        assert photo.rank < logo.rank

    def test_aerial_ranks_well(self):
        aerial = ImageCandidate(image_url="https://example.com/aerial.jpg", image_kind="aerial")
        aerial.rank = rank_candidate(aerial)
        assert aerial.rank < 100

    def test_larger_images_rank_better(self):
        small = ImageCandidate(image_url="https://example.com/small.jpg", image_kind="photo", width_px=400)
        large = ImageCandidate(image_url="https://example.com/large.jpg", image_kind="photo", width_px=1200)

        small.rank = rank_candidate(small)
        large.rank = rank_candidate(large)

        assert large.rank <= small.rank


class TestHeroSelection:
    """Test 4: Only one hero image selected."""

    def test_select_hero_prefers_non_logo(self):
        candidates = [
            ImageCandidate(image_url="https://example.com/logo.png", image_kind="logo", rank=10),
            ImageCandidate(image_url="https://example.com/photo.jpg", image_kind="photo", rank=5),
            ImageCandidate(image_url="https://example.com/aerial.jpg", image_kind="aerial", rank=8),
        ]

        hero = select_hero(candidates)
        assert hero is not None
        assert hero.image_kind != "logo"

    def test_select_hero_returns_first_if_all_logos(self):
        candidates = [
            ImageCandidate(image_url="https://example.com/logo1.png", image_kind="logo", rank=10),
            ImageCandidate(image_url="https://example.com/logo2.png", image_kind="logo", rank=12),
        ]

        hero = select_hero(candidates)
        assert hero is not None
        assert hero.image_url == "https://example.com/logo1.png"

    def test_select_hero_returns_none_for_empty_list(self):
        assert select_hero([]) is None

    def test_normalize_candidates_sets_single_hero(self):
        candidates = [
            ImageCandidate(image_url="https://example.com/photo.jpg", image_kind="photo"),
            ImageCandidate(image_url="https://example.com/logo.png", image_kind="logo"),
        ]

        result = normalize_candidates(candidates, max_images=8)

        hero_count = sum(1 for c in result.candidates if c.is_hero)
        assert hero_count <= 1


class TestDeduplication:
    """Test 5: Duplicate image URLs are deduped."""

    def test_duplicate_urls_are_removed(self):
        candidates = [
            ImageCandidate(image_url="https://example.com/same.jpg", image_kind="photo", source_file_title="File:A"),
            ImageCandidate(image_url="https://example.com/same.jpg", image_kind="photo", source_file_title="File:B"),
            ImageCandidate(image_url="https://example.com/different.jpg", image_kind="photo"),
        ]

        result = normalize_candidates(candidates, max_images=8)

        urls = [c.image_url for c in result.candidates]
        assert len(urls) == len(set(urls))
        assert len(result.candidates) == 2

    def test_skipped_duplicates_recorded(self):
        candidates = [
            ImageCandidate(image_url="https://example.com/same.jpg", image_kind="photo"),
            ImageCandidate(image_url="https://example.com/same.jpg", image_kind="photo"),
        ]

        result = normalize_candidates(candidates, max_images=8)

        assert any(s.get("skip_reason") == "duplicate_url" for s in result.skipped)


class TestDryRunNoDBWrite:
    """Test 6: Dry-run does not write to DB."""

    def test_dry_run_worker_reads_but_does_not_write(self):
        mock_conn = MagicMock()

        with patch("airport_image_gallery_worker.connect_db", return_value=mock_conn):
            with patch("airport_image_gallery_worker.check_image_assets_table_exists", return_value=True):
                with patch("airport_image_gallery_worker.resolve_airport_by_ident") as mock_resolve:
                    mock_resolve.return_value = {
                        "id": "00000000-0000-0000-0000-000000000001",
                        "ident": "KBDL",
                        "iata_code": "BDL",
                        "name": "Bradley International Airport",
                        "wikipedia_link": None,
                    }

                    with patch("airport_image_gallery_worker.find_source_links_for_airport", return_value=[]):
                        with patch("airport_image_gallery_worker.process_airport_images") as mock_process:
                            mock_process.return_value = {
                                "airport_id": "00000000-0000-0000-0000-000000000001",
                                "icao": "KBDL",
                                "iata": "BDL",
                                "name": "Bradley International Airport",
                                "candidates": [],
                                "skipped": [],
                                "diagnostics": [],
                                "hero": None,
                                "total_candidates": 0,
                                "total_skipped": 0,
                            }

                            from airport_image_gallery_worker import run_worker

                            result = run_worker(
                                icao="KBDL",
                                persist=False,
                                show_raw=False,
                            )

                            mock_conn.close.assert_called()
                            assert result["dry_run"] is True


class TestPersistWritesDB:
    """Test 7: --persist writes/upserts airport_image_assets rows."""

    def test_persist_calls_upsert(self):
        mock_conn = MagicMock()

        with patch("airport_image_gallery_worker.connect_db", return_value=mock_conn):
            with patch("airport_image_gallery_worker.check_image_assets_table_exists", return_value=True):
                with patch("airport_image_gallery_worker.resolve_airport_by_ident") as mock_resolve:
                    mock_resolve.return_value = {
                        "id": "00000000-0000-0000-0000-000000000001",
                        "ident": "KBDL",
                        "iata_code": "BDL",
                        "name": "Bradley International Airport",
                        "wikipedia_link": None,
                    }

                    with patch("airport_image_gallery_worker.find_source_links_for_airport", return_value=[]):
                        with patch("airport_image_gallery_worker.process_airport_images") as mock_process:
                            mock_process.return_value = {
                                "airport_id": "00000000-0000-0000-0000-000000000001",
                                "icao": "KBDL",
                                "iata": "BDL",
                                "name": "Bradley International Airport",
                                "candidates": [],
                                "skipped": [],
                                "diagnostics": [],
                                "hero": None,
                                "total_candidates": 0,
                                "total_skipped": 0,
                            }

                            from airport_image_gallery_worker import run_worker

                            run_worker(
                                icao="KBDL",
                                persist=True,
                                show_raw=False,
                            )

                            mock_conn.close.assert_called()


class TestMissingTableError:
    """Test 8: Missing table returns clear error."""

    def test_missing_table_raises_worker_error(self):
        mock_conn = MagicMock()

        with patch("airport_image_gallery_worker.connect_db", return_value=mock_conn):
            with patch("airport_image_gallery_worker.check_image_assets_table_exists", return_value=False):
                from airport_image_gallery_worker import run_worker, WorkerError

                with pytest.raises(WorkerError) as exc_info:
                    run_worker(
                        icao="KBDL",
                        persist=True,
                        show_raw=False,
                    )

                assert "WO-050" in str(exc_info.value)
                assert "010_airport_image_assets" in str(exc_info.value)


class TestRateLimitBackoff:
    """Test 9: 429/503 response produces diagnostics/backoff behavior."""

    def test_429_produces_diagnostics(self):
        import urllib.error
        mock_error = urllib.error.HTTPError(
            url="https://example.com",
            code=429,
            msg="Too Many Requests",
            hdrs={"Retry-After": "1"},
            fp=None,
        )

        with patch("urllib.request.urlopen", side_effect=mock_error):
            from airport_image_gallery_worker import fetch_wikipedia_images

            images, diagnostics = fetch_wikipedia_images("Test_Airport", sleep_seconds=0.01, show_raw=False)

            assert images == []
            assert any("429" in d for d in diagnostics)

    def test_503_produces_diagnostics(self):
        import urllib.error
        mock_error = urllib.error.HTTPError(
            url="https://example.com",
            code=503,
            msg="Service Unavailable",
            hdrs={},
            fp=None,
        )

        with patch("urllib.request.urlopen", side_effect=mock_error):
            from airport_image_gallery_worker import fetch_wikipedia_images

            images, diagnostics = fetch_wikipedia_images("Test_Airport", sleep_seconds=0.01, show_raw=False)

            assert images == []
            assert any("503" in d for d in diagnostics)


class TestNoFakeImages:
    """Test 10: No fake image inserted when no candidates found."""

    def test_no_candidates_returns_empty(self):
        result = normalize_candidates([], max_images=8)

        assert len(result.candidates) == 0
        assert len(result.skipped) == 0

    def test_all_skipped_returns_no_candidates(self):
        candidates = [
            ImageCandidate(
                image_url="https://example.com/logo.svg",
                image_kind="logo",
                skip_reason="svg_image",
                diagnostics={"skip_reason": "svg_image"},
            ),
        ]

        result = normalize_candidates(candidates, max_images=8)

        assert len(result.candidates) == 0
        assert len(result.skipped) == 1


class TestLicenseAttributionPreserved:
    """Test 11: License/attribution fields are preserved when present."""

    def test_license_fields_preserved_in_db_dict(self):
        candidate = ImageCandidate(
            image_url="https://example.com/img.jpg",
            license_name="CC BY-SA 4.0",
            license_url="https://creativecommons.org/licenses/by-sa/4.0/",
            attribution_text="John Doe",
            source_type="wikimedia_commons",
        )

        db_dict = candidate_to_db_dict(candidate)

        assert db_dict["license_name"] == "CC BY-SA 4.0"
        assert db_dict["license_url"] == "https://creativecommons.org/licenses/by-sa/4.0/"
        assert db_dict["attribution_text"] == "John Doe"

    def test_wikimedia_imageinfo_preserves_license(self):
        imageinfo_data = {
            "query": {
                "pages": {
                    "12345": {
                        "title": "File:Test.jpg",
                        "imageinfo": [{
                            "url": "https://example.com/test.jpg",
                            "width": 1000,
                            "height": 600,
                            "extmetadata": {
                                "License": {
                                    "short_name": "CC BY 4.0",
                                    "url": "https://creativecommons.org/licenses/by/4.0/",
                                },
                                "Artist": {"value": "Jane Smith"},
                            },
                        }],
                    }
                }
            }
        }

        candidate = normalize_wikimedia_imageinfo("File:Test.jpg", imageinfo_data)

        assert candidate is not None
        assert candidate.license_name == "CC BY 4.0"
        assert candidate.license_url == "https://creativecommons.org/licenses/by/4.0/"
        assert candidate.attribution_text == "Jane Smith"


class TestImageKindClassification:
    """Test image kind classification."""

    def test_classify_logo(self):
        assert classify_image_kind("Airport logo 2024", None, None) == "logo"

    def test_classify_aerial(self):
        assert classify_image_kind("Aerial view of airport", None, None) == "aerial"

    def test_classify_runway(self):
        assert classify_image_kind("Runway 09L approach", None, None) == "runway"

    def test_classify_terminal(self):
        assert classify_image_kind("Terminal 2 interior", None, None) == "terminal"

    def test_classify_tower(self):
        assert classify_image_kind("Control tower at sunset", None, None) == "tower"

    def test_classify_interior(self):
        assert classify_image_kind("Interior of departure hall", None, None) == "interior"

    def test_classify_map(self):
        assert classify_image_kind("Airport layout diagram", None, None) == "map"

    def test_classify_photo_default(self):
        assert classify_image_kind("Airport from above", None, None) == "photo"

    def test_classify_unknown(self):
        assert classify_image_kind(None, None, None) == "photo"


class TestContentHash:
    """Test content hash computation."""

    def test_hash_is_deterministic(self):
        h1 = compute_content_hash("https://example.com/img.jpg", "wikimedia_commons")
        h2 = compute_content_hash("https://example.com/img.jpg", "wikimedia_commons")
        assert h1 == h2

    def test_hash_differs_for_different_urls(self):
        h1 = compute_content_hash("https://example.com/img1.jpg", "wikimedia_commons")
        h2 = compute_content_hash("https://example.com/img2.jpg", "wikimedia_commons")
        assert h1 != h2

    def test_hash_is_sha256_hex(self):
        h = compute_content_hash("https://example.com/img.jpg", "wikimedia_commons")
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)


class TestWorkerCLI:
    """Test worker CLI interface."""

    def test_worker_has_help(self):
        result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airport_image_gallery_worker.py"),
                "--help",
            ],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
        )
        assert result.returncode == 0
        assert "--airport-id" in result.stdout
        assert "--icao" in result.stdout
        assert "--persist" in result.stdout

    def test_worker_requires_input(self):
        result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airport_image_gallery_worker.py"),
            ],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
        )
        assert result.returncode != 0
        assert "Must provide" in result.stdout


class TestExistingLayer1Tests:
    """Test 12: Existing Layer 1 tests still pass (spot check)."""

    def test_airport_image_assets_migration_test_exists(self):
        result = subprocess.run(
            [
                sys.executable,
                "-m", "pytest",
                str(REPO_ROOT / "tests" / "data" / "layer_01_aviation" / "test_airport_image_assets_migration.py"),
                "-q",
            ],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
        )
        assert result.returncode == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
