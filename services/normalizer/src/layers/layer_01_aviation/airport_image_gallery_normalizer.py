"""Airport Image Gallery Normalizer.

Normalizes raw image candidates from Wikimedia/Wikipedia/Wikidata
into airport_image_assets-ready dicts.

No database I/O occurs here.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[5]
import sys

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

WIKIMEDIA_COMMONS_LICENSE = "CC BY-SA 4.0"
WIKIMEDIA_COMMONS_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/"
WIKIPEDIA_LICENSE = "CC BY-SA 4.0"
WIKIPEDIA_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/"
WIKIDATA_LICENSE = "CC0 1.0"
WIKIDATA_LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/"

VALID_IMAGE_KINDS = {"photo", "logo", "map", "terminal", "runway", "aerial", "tower", "interior", "unknown"}

MIN_WIDTH_PX = 50
MIN_HEIGHT_PX = 50

LOGO_KEYWORDS = ["logo", "emblem", "badge", "symbol", "icon"]
AERIAL_KEYWORDS = ["aerial", "airfield", "overview", "satellite view", "bird's eye", "birdseye"]
RUNWAY_KEYWORDS = ["runway", "taxiway", "apron"]
TERMINAL_KEYWORDS = ["terminal", "concourse", "gate", "check-in", "arrival hall"]
TOWER_KEYWORDS = ["tower", "control tower", "atc tower"]
INTERIOR_KEYWORDS = ["interior", "inside", "lobby", "hall", "waiting area", "duty free", "departure hall"]
MAP_KEYWORDS = ["map", "diagram", "layout", "plan", "schematic"]

PLACEHOLDER_PATTERNS = [
    r"no-image",
    r"placeholder",
    r"missing-file",
    r"commons-logo",
    r"wikimedia-logo",
    r"wikimedia-community-logo",
    r"question_book",
    r"crystal_clear_app",
    r"button_",
]


@dataclass
class ImageCandidate:
    image_url: str
    thumbnail_url: str | None = None
    original_url: str | None = None
    caption: str | None = None
    description: str | None = None
    attribution_text: str | None = None
    license_name: str | None = None
    license_url: str | None = None
    width_px: int | None = None
    height_px: int | None = None
    media_type: str | None = None
    image_kind: str = "unknown"
    is_hero: bool = False
    rank: int = 100
    confidence_label: str = "unknown"
    confidence_score: float | None = None
    content_hash: str | None = None
    source_type: str = "wikimedia_commons"
    source_name: str | None = None
    source_url: str | None = None
    source_file_title: str | None = None
    source_object_id: str | None = None
    source_entity_id: str | None = None
    raw_metadata: dict[str, Any] = field(default_factory=dict)
    diagnostics: dict[str, Any] = field(default_factory=dict)
    skip_reason: str | None = None


@dataclass
class NormalizationResult:
    candidates: list[ImageCandidate] = field(default_factory=list)
    skipped: list[dict[str, Any]] = field(default_factory=list)
    diagnostics: list[str] = field(default_factory=list)


def classify_image_kind(title: str | None, caption: str | None, description: str | None) -> str:
    text = " ".join(filter(None, [title or "", caption or "", description or ""])).lower()

    for kw in LOGO_KEYWORDS:
        if kw in text:
            return "logo"

    for kw in MAP_KEYWORDS:
        if kw in text:
            return "map"

    for kw in AERIAL_KEYWORDS:
        if kw in text:
            return "aerial"

    for kw in RUNWAY_KEYWORDS:
        if kw in text:
            return "runway"

    for kw in TERMINAL_KEYWORDS:
        if kw in text:
            return "terminal"

    for kw in TOWER_KEYWORDS:
        if kw in text:
            return "tower"

    for kw in INTERIOR_KEYWORDS:
        if kw in text:
            return "interior"

    return "photo"


def compute_content_hash(image_url: str, source_type: str) -> str:
    raw = f"{source_type}:{image_url}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def is_placeholder_or_bad(title: str | None = None, caption: str | None = None, description: str | None = None,
                          image_url: str | None = None, width: int | None = None,
                          height: int | None = None, media_type: str | None = None) -> str | None:
    text = " ".join(filter(None, [title or "", caption or "", description or "", image_url or ""])).lower()

    for pattern in PLACEHOLDER_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return f"placeholder_match:{pattern}"

    if media_type and media_type.startswith("image/svg"):
        return "svg_image"

    if width is not None and width < MIN_WIDTH_PX:
        return f"too_small_width:{width}"

    if height is not None and height < MIN_HEIGHT_PX:
        return f"too_small_height:{height}"

    return None


def rank_candidate(candidate: ImageCandidate) -> int:
    rank = 100

    if candidate.image_kind == "photo":
        rank -= 40
    elif candidate.image_kind == "aerial":
        rank -= 35
    elif candidate.image_kind == "terminal":
        rank -= 30
    elif candidate.image_kind == "runway":
        rank -= 25
    elif candidate.image_kind == "tower":
        rank -= 20
    elif candidate.image_kind == "interior":
        rank -= 20
    elif candidate.image_kind == "logo":
        rank += 20
    elif candidate.image_kind == "map":
        rank += 10

    if candidate.width_px and candidate.width_px >= 1000:
        rank -= 10
    elif candidate.width_px and candidate.width_px >= 600:
        rank -= 5

    if candidate.confidence_label == "high":
        rank -= 10
    elif candidate.confidence_label == "medium":
        rank -= 5

    if candidate.source_type == "wikimedia_commons":
        rank -= 5

    return max(0, rank)


def normalize_wikimedia_imageinfo(file_title: str, imageinfo_data: dict[str, Any],
                                   source_type: str = "wikimedia_commons") -> ImageCandidate | None:
    pages = imageinfo_data.get("query", {}).get("pages", {})
    if not pages:
        return None

    page = next(iter(pages.values()))
    image_infos = page.get("imageinfo", [])
    if not image_infos:
        return None

    ii = image_infos[0]

    image_url = ii.get("url")
    if not image_url:
        return None

    thumbnail_url = ii.get("thumburl")
    original_url = ii.get("url")
    width = ii.get("width")
    height = ii.get("height")
    media_type = ii.get("mime") or ii.get("mediatype")

    extmeta = ii.get("extmetadata", {})

    license_name = None
    license_url = None
    attribution_text = None

    license_info = extmeta.get("License", {})
    if license_info:
        license_name = license_info.get("short_name") or license_info.get("name") or license_info.get("value")
    if not license_name:
        license_name = extmeta.get("LicenseShortName", {}).get("value")
    if not license_url:
        license_url = license_info.get("url") or extmeta.get("LicenseUrl", {}).get("value")

    attribution_info = extmeta.get("Artist", {})
    if attribution_info:
        attribution_text = attribution_info.get("value")

    description_info = extmeta.get("ImageDescription", {})
    description = description_info.get("value") if description_info else None

    caption = page.get("title", "").replace("File:", "")

    skip_reason = is_placeholder_or_bad(
        title=caption,
        caption=description,
        description=description,
        image_url=image_url,
        width=width,
        height=height,
        media_type=media_type,
    )

    image_kind = classify_image_kind(caption, description, description)

    candidate = ImageCandidate(
        image_url=image_url,
        thumbnail_url=thumbnail_url,
        original_url=original_url,
        caption=caption,
        description=description,
        attribution_text=attribution_text,
        license_name=license_name,
        license_url=license_url,
        width_px=width,
        height_px=height,
        media_type=media_type,
        image_kind=image_kind,
        confidence_label="high" if license_name else "medium",
        source_type=source_type,
        source_name="Wikimedia Commons",
        source_file_title=file_title,
        source_url=f"https://commons.wikimedia.org/wiki/{file_title}",
        raw_metadata={
            "file_title": file_title,
            "imageinfo": ii,
            "extmetadata_keys": list(extmeta.keys()),
        },
    )

    if skip_reason:
        candidate.skip_reason = skip_reason
        candidate.diagnostics = {"skip_reason": skip_reason}

    return candidate


def normalize_wikipedia_image_list(airport_title: str, images_data: dict[str, Any]) -> list[dict[str, str]]:
    pages = images_data.get("query", {}).get("pages", {})
    if not pages:
        return []

    page = next(iter(pages.values()))
    images = page.get("images", [])

    result = []
    for img in images:
        title = img.get("title", "")
        if title.startswith("File:"):
            result.append({
                "file_title": title,
                "source_page": airport_title,
            })
    return result


def normalize_commons_category_members(category_name: str, members_data: dict[str, Any]) -> list[dict[str, str]]:
    members = members_data.get("query", {}).get("categorymembers", [])
    result = []
    for member in members:
        title = member.get("title", "")
        ns = member.get("ns", 0)
        if ns == 6 and title.startswith("File:"):
            result.append({
                "file_title": title,
                "source_category": category_name,
            })
    return result


def normalize_wikidata_image(entity_data: dict[str, Any]) -> ImageCandidate | None:
    entities = entity_data.get("entities", {})
    if not entities:
        return None

    entity = next(iter(entities.values()))
    qid = entity.get("id", "")
    claims = entity.get("claims", {})

    p18_entries = claims.get("P18", [])
    if not p18_entries:
        return None

    p18_value = p18_entries[0].get("mainsnak", {}).get("datavalue", {}).get("value")
    if not p18_value:
        return None

    file_name = p18_value if isinstance(p18_value, str) else p18_value.get("text", "")
    if not file_name:
        return None

    image_url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{file_name}"

    label = entity.get("labels", {}).get("en", {}).get("value", "")
    description = entity.get("descriptions", {}).get("en", {}).get("value", "")

    candidate = ImageCandidate(
        image_url=image_url,
        caption=file_name,
        description=description or label,
        image_kind="photo",
        confidence_label="medium",
        source_type="wikidata",
        source_name="Wikidata",
        source_entity_id=qid,
        source_url=f"https://www.wikidata.org/wiki/{qid}",
        raw_metadata={
            "qid": qid,
            "p18_value": p18_value,
            "label": label,
        },
    )

    return candidate


def normalize_candidates(candidates: list[ImageCandidate],
                          max_images: int = 8) -> NormalizationResult:
    result = NormalizationResult()

    valid_candidates = []
    for c in candidates:
        if c.skip_reason:
            result.skipped.append({
                "file_title": c.source_file_title or c.caption or "unknown",
                "image_url": c.image_url,
                "skip_reason": c.skip_reason,
            })
            result.diagnostics.append(f"Skipped {c.source_file_title or 'unknown'}: {c.skip_reason}")
            continue
        valid_candidates.append(c)

    seen_urls: set[str] = set()
    deduped: list[ImageCandidate] = []
    for c in valid_candidates:
        if c.image_url in seen_urls:
            result.skipped.append({
                "file_title": c.source_file_title or c.caption or "unknown",
                "image_url": c.image_url,
                "skip_reason": "duplicate_url",
            })
            result.diagnostics.append(f"Deduped {c.source_file_title or 'unknown'}: duplicate URL")
            continue
        seen_urls.add(c.image_url)
        deduped.append(c)

    for c in deduped:
        c.rank = rank_candidate(c)
        c.content_hash = compute_content_hash(c.image_url, c.source_type)

    deduped.sort(key=lambda c: c.rank)

    selected = deduped[:max_images]

    result.candidates = selected

    if len(deduped) > max_images:
        for c in deduped[max_images:]:
            result.skipped.append({
                "file_title": c.source_file_title or c.caption or "unknown",
                "image_url": c.image_url,
                "skip_reason": "exceeds_max_images",
                "rank": c.rank,
            })

    return result


def select_hero(candidates: list[ImageCandidate]) -> ImageCandidate | None:
    for c in candidates:
        if c.image_kind != "logo":
            return c
    if candidates:
        return candidates[0]
    return None


def candidate_to_db_dict(candidate: ImageCandidate) -> dict[str, Any]:
    return {
        "source_type": candidate.source_type,
        "image_url": candidate.image_url,
        "thumbnail_url": candidate.thumbnail_url,
        "original_url": candidate.original_url,
        "caption": candidate.caption,
        "description": candidate.description,
        "attribution_text": candidate.attribution_text,
        "license_name": candidate.license_name,
        "license_url": candidate.license_url,
        "width_px": candidate.width_px,
        "height_px": candidate.height_px,
        "media_type": candidate.media_type,
        "image_kind": candidate.image_kind,
        "rank": candidate.rank,
        "confidence_label": candidate.confidence_label,
        "confidence_score": candidate.confidence_score,
        "content_hash": candidate.content_hash,
        "source_entity_id": candidate.source_entity_id,
        "source_name": candidate.source_name,
        "source_url": candidate.source_url,
        "source_file_title": candidate.source_file_title,
        "source_object_id": candidate.source_object_id,
        "raw_metadata": candidate.raw_metadata,
        "diagnostics": candidate.diagnostics,
    }
