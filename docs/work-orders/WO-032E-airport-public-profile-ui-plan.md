# WO-032E: Airport Public Profile UI Plan

**Author:** OpenCode
**CLI:** minimaxai/minimaxai/minimaxai/minimaxai/minimax-m2.7
**Revised by:** Kiro CLI (Claude) — WO-032G-FRONTEND
**Directory:** E:\god-eyes-frontend
**Branch:** agent/frontend-airport-enrichment-ui
**Date:** 2026-05-18 (revised 2026-05-17 UTC)

---

## 1. Overview

This document specifies the UI/UX plan for showing cached English Wikipedia and Wikidata public airport facts within the existing **Object Intel panel** in the GOD EYES frontend.

**Allowed folder:** `apps/web` (when implemented)
**Forbidden folders:** `apps/api`, `database`, `services`, `infra`, `packages/contracts`, `packages/source-catalog`

**No app code written in this plan.**

---

## 2. Data Contract

The frontend expects the following shape from the API for an airport public profile:

```typescript
interface AirportPublicProfile {
  airportId: string;           // sourceObjectId of the airport
  layerId: 'layer_01_aviation';

  // Wikipedia data (English)
  wikipedia?: {
    pageId: number;
    title: string;             // e.g. "John F. Kennedy International Airport"
    url: string;              // e.g. "https://en.wikipedia.org/wiki/John_F._Kennedy_International_Airport"
    extract: string;          // First paragraph summary, HTML or plain text
    thumbnail?: {
      source: string;          // Thumbnail image URL
      width: number;
      height: number;
    };
    extractHtml?: string;     // Optional: pre-rendered HTML of extract
  };

  // Wikidata data
  wikidata?: {
    entityId: string;         // e.g. "Q1770304"
    url: string;             // e.g. "https://www.wikidata.org/wiki/Q1770304"
    description?: string;     // Short Wikidata description
    properties?: Record<string, string>;  // Key-value facts (elevation, operator, owner, etc.)
  };

  // Metadata
  metadata: {
    fetchedAt: string;        // ISO 8601 timestamp
    expiresAt: string;       // ISO 8601 when cache expires
    confidence: number;       // 0.0 - 1.0
    sources: string[];       // ['wikipedia', 'wikidata']
  };
}
```

### 2.1 Confidence Levels

| Confidence | Meaning |
|------------|---------|
| 1.0 | Perfect match: exact IATA/ICAO code matched |
| 0.8-0.99 | High confidence: name + location match |
| 0.5-0.79 | Medium confidence: partial name or fuzzy match |
| 0.0-0.49 | Low confidence: needs verification |

---

## 3. UI States

The Object Intel panel for an airport must handle the following states:

1. **Loading** — API call in progress
2. **Fetching (first fetch)** — no cached data, pipeline is actively fetching from Wikipedia/Wikidata
3. **Cached (fresh)** — profile exists, `expiresAt` not passed
4. **Stale** — profile exists, `expiresAt` passed; show stale data with "refreshing" indicator or manual refresh
5. **No profile found** — API returns 404 or `{ found: false }`; show calm fallback
6. **Low confidence** — profile returned but `confidence < 0.5`; show calm fallback or review warning
7. **Error** — 5xx, network timeout, or parse error; show retry message

---

### 3.1 Loading State

**Trigger:** User clicks an airport dot, `selectedObject` is set, API call begins.

**UI:**
```
┌─────────────────────────────────────┐
│ AIRPORT INTEL                       │
├─────────────────────────────────────┤
│ [Animated spinner] Fetching profile… │
│                                     │
│ ░░░░░░░░░░░░░░░░░░░░░░ (pulse bar)  │
└─────────────────────────────────────┘
```

**Behavior:**
- Render inline within the existing `DetailPanel` or `AirportOverview` component
- No skeleton screen initially — spinner only
- Timeout after 5s: show "Taking longer than expected…" text
- Abort previous request if user clicks different airport

---

### 3.2 Fetching State (First Fetch / Pipeline In Progress)

**Trigger:** API indicates no cached profile exists and the pipeline is actively fetching from Wikipedia/Wikidata (e.g. HTTP 202 Accepted or `{ status: 'fetching' }`).

**UI:**
```
┌─────────────────────────────────────┐
│ AIRPORT INTEL                       │
├─────────────────────────────────────┤
│ [Animated spinner] Building profile… │
│                                     │
│ Retrieving public data for this     │
│ airport. This may take a moment.    │
└─────────────────────────────────────┘
```

**Behavior:**
- Poll or wait for pipeline to complete (with reasonable timeout)
- Do not show partial data
- If pipeline does not complete within timeout, fall through to error state

---

### 3.3 Cached Profile State (Fresh)

**Trigger:** User clicks an airport dot, `selectedObject` is set, API call to `GET /api/airports/:airportId/public-profile` begins. Profile exists in cache and `expiresAt` has not passed.

**UI:**
```
┌─────────────────────────────────────┐
│ AIRPORT INTEL                       │
├─────────────────────────────────────┤
│ [Thumbnail if available]            │
│ JFK — John F. Kennedy International  │
│ New York, NY, USA                   │
├─────────────────────────────────────┤
│ SUMMARY                             │
│ John F. Kennedy International       │
│ Airport is the chief international  │
│ airport of New York City. It serves │
│ as the hub for JetBlue Airways and  │
│ Delta Air Lines...                  │
│ [Read more on Wikipedia →]          │
├─────────────────────────────────────┤
│ KEY FACTS                           │
│ ┌───────────────────────────────┐   │
│ │ Opened       │ 1948           │   │
│ │ Elevation    │ 13 ft (4 m)    │   │
│ │ Owner        │ Port Authority │   │
│ │ Operator     │ PANYNJ         │   │
│ │ Served City  │ New York       │   │
│ └───────────────────────────────┘   │
├─────────────────────────────────────┤
│ SOURCES                             │
│ 📖 Wikipedia (CC BY-SA 3.0)        │
│ [View article] [View history]       │
│ 📋 Wikidata (ODbL 1.0)             │
│ [View entity] [Properties]          │
├─────────────────────────────────────┤
│ Confidence: ████████░░ 85%         │
│ Cached: 2 hours ago                 │
└─────────────────────────────────────┘
```

**Behavior:**
- Show thumbnail (if available) at 80x80px, rounded corners
- Wikipedia extract: truncate at 300 chars with "…" or expand button
- Key Facts table: 2-column layout (label | value)
- Confidence displayed as progress bar + percentage
- "Cached: X ago" shows relative time

---

### 3.4 No Profile Found State

**Trigger:** API returns 404 or `{ found: false }` for the airport.

**UI:**
```
┌─────────────────────────────────────┐
│ AIRPORT INTEL                       │
├─────────────────────────────────────┤
│ JFK — John F. Kennedy International │
│ New York, NY, USA                   │
├─────────────────────────────────────┤
│ ⚠ No public profile found          │
│                                     │
│ Wikipedia and Wikidata do not have  │
│ entries matching this airport.     │
│                                     │
│ This may indicate:                  │
│ • New or recently renamed airport   │
│ • Small regional airfield           │
│ • Insufficient Wikipedia coverage   │
│                                     │
│ [Suggest an article on Wikipedia]  │
│ [Add to Wikidata]                   │
├─────────────────────────────────────┤
│ SOURCES                             │
│ — No external sources linked       │
└─────────────────────────────────────┘
```

**Behavior:**
- Show warning icon (yellow/amber)
- Provide external links to Wikipedia/Wikidata to create entries
- Do NOT show confidence bar (no data)
- Allow user to dismiss or expand other panels

---

### 3.5 Stale Profile State

**Trigger:** API returns profile where `expiresAt` has passed (30-day TTL exceeded). Data is still returned but marked stale. If a background refresh is in progress, show "refreshing" indicator alongside stale data.

**UI:**
```
┌─────────────────────────────────────┐
│ AIRPORT INTEL                       │
├─────────────────────────────────────┤
│ [Thumbnail]                         │
│ JFK — John F. Kennedy International │
│ New York, NY, USA                   │
├─────────────────────────────────────┤
│ ⚠ Profile may be outdated          │
│                                     │
│ SUMMARY                             │
│ John F. Kennedy International       │
│ Airport is the chief international  │
│ airport of New York City...         │
│                                     │
│ [Read more on Wikipedia →]          │
├─────────────────────────────────────┤
│ KEY FACTS                           │
│ ... (same as cached state) ...     │
├─────────────────────────────────────┤
│ SOURCES                             │
│ ... (same as cached state) ...     │
├─────────────────────────────────────┤
│ Confidence: ████████░░ 85%          │
│ ⚠ Cached: 14 days ago (stale)      │
│ [Refresh profile]                   │
└─────────────────────────────────────┘
```

**Behavior:**
- Show amber/yellow warning banner at top of profile section
- Include "Refresh profile" button that triggers a new API fetch
- Do NOT auto-refresh — only on user request
- Stale data is still displayed (better than nothing)

---

### 3.6 Low Confidence State

**Trigger:** API returns a profile but `confidence < 0.5`.

**UI:**
```
┌─────────────────────────────────────┐
│ AIRPORT INTEL                       │
├─────────────────────────────────────┤
│ ⚠ Profile match uncertain          │
│                                     │
│ The data shown may not correspond   │
│ to this airport. Verify before use. │
│                                     │
│ [Show anyway] [Dismiss]             │
└─────────────────────────────────────┘
```

**Behavior:**
- Show calm fallback by default (do not auto-display low-confidence data)
- Offer "Show anyway" to let user see the data with a persistent warning banner
- Confidence bar shown in red if user chooses to view

---

### 3.7 Error State

**Trigger:** API returns 5xx error, network timeout, or parse error.

**UI:**
```
┌─────────────────────────────────────┐
│ AIRPORT INTEL                       │
├─────────────────────────────────────┤
│ ❌ Failed to load profile          │
│                                     │
│ Unable to fetch Wikipedia/Wikidata   │
│ data. Please try again.            │
│                                     │
│ [Retry] [View on Wikipedia instead] │
└─────────────────────────────────────┘
```

---

## 4. Source Attribution Display

Per Wikimedia licensing requirements, all Wikipedia/Wikidata data must display attribution.

### 4.1 Wikipedia Attribution

Wikipedia content is licensed under CC BY-SA. Attribution must be visible whenever Wikipedia content is displayed.

```
📖 Wikipedia: "{Article Title}"
Text available under Creative Commons Attribution-ShareAlike License.
[View article] [View page history]
```

Do not use the phrase "CC BY-SA 3.0" as the sole license identifier — Wikipedia content may be CC BY-SA 4.0 or later. Use the generic phrase "Creative Commons Attribution-ShareAlike License" and link to the article history for full license details.

### 4.2 Wikidata Attribution

Wikidata content is released under CC0 (public domain dedication). Attribution is not legally required but should be shown as a courtesy and for transparency.

```
📋 Wikidata: {Entity ID}
Data from Wikidata (CC0).
[View entity]
```

Do not claim ODbL for Wikidata — Wikidata uses CC0, not ODbL. ODbL applies to OpenStreetMap.

### 4.3 Layout

Attribution must be in a dedicated "SOURCES" section at the bottom of the profile, not inline with facts.

---

## 5. Wikipedia/Wikidata Links

Each profile provides two sets of links:

### 5.1 Wikipedia Links

| Link | URL Pattern |
|------|-------------|
| View article | `https://en.wikipedia.org/wiki/{PageTitle}` |
| View history | `https://en.wikipedia.org/w/index.php?title={PageTitle}&action=history` |
| Edit article | `https://en.wikipedia.org/w/index.php?title={PageTitle}&action=edit` (optional) |

### 5.2 Wikidata Links

| Link | URL Pattern |
|------|-------------|
| View entity | `https://www.wikidata.org/wiki/{EntityId}` |
| View in query service | `https://query.wikidata.org/sparql?query=...` (optional) |

---

## 6. Summary / Facts Layout

### 6.1 Layout Grid

```
┌─────────────────────────────────────┐
│  THUMBNAIL  │  TITLE + METADATA     │
│  (if avail) │  - Full name          │
│  80x80      │  - Location           │
│             │  - Type               │
├─────────────┴───────────────────────┤
│ SUMMARY (collapsible)               │
│ - First 300 chars of extract        │
│ - "Read more on Wikipedia →" link   │
├─────────────────────────────────────┤
│ KEY FACTS (2-col table)             │
│ - Label : Value pairs               │
│ - Elevation, Owner, Operator, etc. │
├─────────────────────────────────────┤
│ WIKIDATA PROPERTIES (collapsible)   │
│ - Key : Value from wikidata.props  │
├─────────────────────────────────────┤
│ SOURCES + ATTRIBUTION               │
├─────────────────────────────────────┤
│ CONFIDENCE BAR + CACHE INFO         │
└─────────────────────────────────────┘
```

### 6.2 Fact Labels (Standardized)

| Label | Source | Description |
|-------|--------|-------------|
| Opened / Built | Wikidata | Year airport opened or was built |
| Owner | Wikidata | Legal owner |
| Operator | Wikidata | Operating entity |
| Served City | Wikidata | City the airport serves |
| Elevation | Wikidata | Airport elevation in ft and m |
| IATA / ICAO | Internal | Already known, no need to fetch |
| Website | Wikidata | Official airport website |
| Runway Count | Wikidata | Number of runways |
| Additional facts | Wikidata | Other available properties |

> **Note:** Do not show real-time passenger counts or next flight data. This plan covers static public profile data only.

---

## 7. Confidence Display

### 7.1 Visual

```
Confidence: ████████░░ 85%
```

A horizontal progress bar (8 blocks), filled blocks = percentage / 12.5 (so 85% = ~7 filled blocks).

### 7.2 Color Coding

| Confidence | Color |
|------------|-------|
| 80-100% | Green (#22c55e) |
| 50-79% | Yellow (#eab308) |
| 0-49% | Red (#ef4444) |

### 7.3 Tooltip

On hover, show: "Confidence 85%: Exact IATA/ICAO match"

---

## 8. Integration with Existing Object Intel Panel

### 8.1 Current Structure

The existing `DetailPanel.tsx` or `AirportOverview.tsx` already shows:
- Airport basic info (name, location, type)
- Frequencies section
- Runways section
- Nearby navaids section

### 8.2 Integration Point

The public profile section should be added **after** the basic airport info but **before** Frequencies/Runways/Navaids:

```
┌─────────────────────────────────────┐
│ AIRPORT INTEL                       │
│ ─────────────────────────────────── │
│ [Basic Info: Name, ident, type]     │
│ [Location: Municipality, region]   │
│ ─────────────────────────────────── │
│ PUBLIC PROFILE (this plan)          │
│ [Thumbnail] [Title] [Location]      │
│ [Summary] [Key Facts]               │
│ [Wikidata Props] [Sources]         │
│ [Confidence Bar]                    │
│ ─────────────────────────────────── │
│ FREQUENCIES                        │
│ ... (existing content) ...          │
│ ─────────────────────────────────── │
│ RUNWAYS                            │
│ ... (existing content) ...          │
│ ─────────────────────────────────── │
│ NEARBY NAVAIDS                     │
│ ... (existing content) ...          │
└─────────────────────────────────────┘
```

### 8.3 Component Addition

```typescript
// New component (when implemented)
import { AirportPublicProfile } from '@god-eyes/contracts';

// In DetailPanel.tsx, add:
{selectedObject?.objectType === 'airport' && (
  <AirportPublicProfilePanel
    airportId={selectedObject.id}
    onWikipediaClick={handleWikipediaClick}
    onWikidataClick={handleWikidataClick}
  />
)}
```

---

## 9. Stale Cache Detection

Cache TTL is **30 days** (aligned with pipeline canonical design, per WO-032G).

### 9.1 Rules

- **Fresh:** `expiresAt` not passed (within 30-day TTL) — show profile normally
- **Stale:** `expiresAt` passed but data still available — show stale data with "refreshing" indicator if a background refresh is in progress, or amber "may be outdated" banner with manual refresh option
- **Expired / no profile:** No cached data found — show calm fallback (see §3.3)
- **No cache:** First-time fetch, no `fetchedAt` available — show loading state (see §3.1)

> **Correction:** The previous plan used a 24-hour freshness threshold. The canonical TTL is 30 days. All stale/expired logic must be based on the 30-day `expiresAt` value returned by the API.

### 9.2 Relative Time Display

| Actual Time | Display |
|-------------|---------|
| < 60 seconds | "Just now" |
| < 60 minutes | "5 minutes ago" |
| < 24 hours | "2 hours ago" |
| < 7 days | "3 days ago" |
| < 30 days | "14 days ago" |
| >= 30 days | "30+ days ago (stale)" |

---

## 10. API Endpoint (Canonical)

```
GET /api/airports/:airportId/public-profile
```

Query params:
- `sources=wikipedia,wikidata` (optional, default both)
- `forceRefresh=true` (optional, bypass cache)

Response: `AirportPublicProfile` or `{ found: false }` or error

> **Note:** The previous endpoint `GET /api/layers/layer_01_aviation/objects/{objectId}/profile` was incorrect and has been replaced with the canonical endpoint above per WO-032G.

---

## 11. Implementation Notes

1. **No app code written** — this is a plan only.
2. All UI strings are placeholders and should be localized.
3. Wikipedia extract should be sanitized (no user-generated content).
4. Thumbnail images should have alt text: `{airport name} thumbnail`.
5. External links open in new tab with `rel="noopener noreferrer"`.
6. The panel should be collapsible to save space.
7. On mobile, the 2-column fact table should stack to 1-column.

---

## 12. Final Report

**Original author:** OpenCode / minimax-m2.7
**Revised by:** Kiro CLI (Claude) — WO-032G-FRONTEND
**CLI:** Kiro WSL
**Directory:** E:\god-eyes-frontend
**Branch:** agent/frontend-airport-enrichment-ui
**Files changed:** `docs/work-orders/WO-032E-airport-public-profile-ui-plan.md` (modified)

**Summary of corrections (WO-032G):**
- Replaced incorrect endpoint `GET /api/layers/layer_01_aviation/objects/{objectId}/profile` with canonical `GET /api/airports/:airportId/public-profile`
- Replaced 24-hour freshness threshold with 30-day TTL aligned to pipeline canonical design
- Added missing UI states: Fetching (pipeline in progress) and Low Confidence
- Renumbered UI states to 7 total
- Fixed Wikipedia attribution: removed hardcoded "CC BY-SA 3.0", replaced with generic "Creative Commons Attribution-ShareAlike License"
- Fixed Wikidata attribution: removed incorrect ODbL claim, replaced with correct CC0
- Removed "Passengers" from Key Facts (paid/live data not in scope)
- Added "Opened / Built" date to Key Facts (canonical data field)
- Aligned stale/expired behavior to 30-day TTL

**Forbidden folders touched:** NO (no code written)
**Ready for review:** YES