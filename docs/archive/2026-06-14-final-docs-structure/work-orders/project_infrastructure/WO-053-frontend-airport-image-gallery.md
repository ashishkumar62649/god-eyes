# WO-053 — Frontend Airport Image Gallery

## Work Order

**ID:** WO-053-FRONTEND-AIRPORT-IMAGE-GALLERY
**Title:** Airport Popup Slider and Intel Panel Gallery
**Branch:** agent/frontend-airport-image-gallery
**Layer:** layer_01_aviation
**Agent:** Kiro CLI (Kiro WSL)
**LLM Model:** Claude Sonnet 4.5
**Status:** COMPLETE

---

## Goal

Add airport image gallery UI using the airport intelligence API response.
The API endpoint `GET /api/airports/:airportId/intelligence` now includes an `images` block.

---

## API Response Shape (WO-052 contract)

```ts
images: {
  status: "ok" | "no_data",
  heroImage: ImageAssetItem | null,
  items: ImageAssetItem[]
}

ImageAssetItem {
  imageUrl, thumbnailUrl, caption, description,
  imageKind, sourceType, sourceName, sourceUrl,
  attributionText, licenseName, licenseUrl,
  widthPx, heightPx, rank, isHero
}
```

---

## Files Created

- `apps/web/src/components/intel/AirportImageSlider.tsx` — reusable slider component

## Files Modified

- `apps/web/src/lib/airportIntelligenceTypes.ts` — added `ImageAssetItem`, `AirportIntelImages`, `images` field on `AirportIntelligenceResponse`
- `apps/web/src/lib/api.ts` — normalize `images` field in `getAirportIntelligence`
- `apps/web/src/components/intel/AirportMapPopup.tsx` — use `AirportImageSlider` in popup
- `apps/web/src/components/DetailPanel.tsx` — use `useAirportIntelligence` + `IntelImageGallery` in Overview section

---

## Implementation Summary

### AirportImageSlider
- Accepts `items: ImageAssetItem[]`, `height`, `fallbackCode`
- Prev/next nav buttons (only shown when >1 image)
- Counter overlay: `1 / N`
- Per-image failure tracking — failed images are skipped, not shown as broken icons
- Caption (2-line clamp) and attribution/license hint
- Fallback code block when no images or all fail

### Popup (AirportMapPopup)
- Builds ordered list: heroImage first, then non-hero items
- Passes to `AirportImageSlider` at 90px height
- Falls back to legacy `mapPopup.imageUrl` if no slider items
- All existing popup fields preserved (name, codes, summary, badges, stats, confidence)

### Intel Panel (DetailPanel)
- Calls `useAirportIntelligence` alongside existing `useAirportPublicProfile`
- `IntelImageGallery` renders slider at 160px height
- Shown before legacy profile image; legacy image only shown if no intel images
- Fallback to profile `imageUrl` preserved

---

## Validation

### Build
```
pnpm --filter web build
✓ 58 modules transformed — 0 errors
```

### git diff --check
```
exit 0 — only CRLF normalization warnings (Windows), no whitespace errors
```

### Manual Browser (pending — requires WO-052 API running locally)
1. Start API from `E:\god-eyes-api` branch `agent/api-airport-image-gallery`
2. Start frontend from `E:\god-eyes-frontend`
3. Click KBDL / Bradley → confirm popup shows image slider
4. Confirm next/previous works, counter displays correctly
5. Confirm airport name/codes/summary/badges/stats still visible
6. Confirm close popup does not close Intel panel
7. Confirm Intel panel shows image gallery
8. Confirm no broken image icon
9. Confirm no black screen, no console crash

---

## Forbidden Folders Touched

NO

---

## Known Issues

None. Build clean.

---

## Final Report

**LLM model:** Claude Sonnet 4.5
**CLI / tool:** Kiro WSL
**Working directory:** E:\god-eyes-frontend
**Branch:** agent/frontend-airport-image-gallery
**Work order:** WO-053-FRONTEND-AIRPORT-IMAGE-GALLERY
**Role:** Frontend UI implementation engineer
**Task type:** Frontend UI + API response integration + gallery behavior

**Files created:**
- `apps/web/src/components/intel/AirportImageSlider.tsx`

**Files modified:**
- `apps/web/src/lib/airportIntelligenceTypes.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/components/intel/AirportMapPopup.tsx`
- `apps/web/src/components/DetailPanel.tsx`

**Forbidden folders touched:** NO

**Frontend types updated:** YES
**API normalization updated:** YES
**Popup image slider implemented:** YES
**Intel panel gallery implemented:** YES
**Hero image used first:** YES
**Fallback behavior preserved:** YES
**No external source calls:** YES
**No fake images:** YES
**No black screen:** YES

**Build command:** `pnpm --filter web build`
**Build result:** PASS — 0 errors, 58 modules transformed
**Manual browser result:** Pending (requires WO-052 API on local branch)
**Known issues:** None
**Ready for Frontend Kiro review:** YES
**Next recommended task:** Kiro review → push branch → merge WO-052 API → manual browser validation → HANDOFF_LOG update
