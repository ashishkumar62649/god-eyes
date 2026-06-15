# WO-035: Airport Intelligence Frontend Display Research

**Author:** Claude (Kiro WSL)
**Work order:** WO-035-CLAUDE-FRONTEND-RESEARCH
**Date:** 2026-05-18
**Type:** Research / design only — no implementation

---

## 1. Overall Panel Philosophy

The Object Intel panel should feel like a **briefing card**, not a database dump.

Principle: show the most useful fact first, hide the rest behind progressive disclosure.
The user should understand the airport in 3 seconds without scrolling.

Visual model: Google Earth sidebar + intelligence dashboard.
Dark panel, compact typography, subtle section dividers, no heavy borders.

---

## 2. Recommended Layout (top to bottom)

```
┌─────────────────────────────────────────┐
│  [Hero image or dark placeholder]       │  ← 100–120px, object-fit: cover
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
├─────────────────────────────────────────┤
│  AIRPORT NAME                           │  ← 1.1rem, accent color
│  ICAO · IATA  ·  City, Country          │  ← 0.75rem, mono, dimmed
│  Opened: 1948                           │  ← only if known
├─────────────────────────────────────────┤
│  [CAPABILITY BADGES]                    │  ← inline pill tags
│  ✈ International  🛬 Cargo  🚁 Helipad  │
├─────────────────────────────────────────┤
│  SUMMARY                                │  ← 2–3 sentences, collapsible
│  "JFK is the chief international..."   │
│  [Read more]                            │
├─────────────────────────────────────────┤
│  CAPACITY & TRAFFIC          [▾]        │  ← collapsible section
│  Annual passengers  62.5M               │
│  Runways            4                   │
│  Gates              ~130                │
│  5-yr growth        [sparkline bar]     │
├─────────────────────────────────────────┤
│  INFRASTRUCTURE              [▾]        │  ← collapsible, default closed
│  Runways / Frequencies / Navaids        │
├─────────────────────────────────────────┤
│  SOURCES & DETAILS           [▾]        │  ← collapsible, default closed
│  Wikipedia · Wikidata · confidence      │
└─────────────────────────────────────────┘
```

---

## 3. Top Overview Design

### What shows instantly (before enrichment)
These come from the base airport object (already loaded):
- Airport name
- ICAO / IATA codes
- Municipality, country
- Airport type badge (large / regional / heliport)

These appear immediately — no spinner, no wait.

### What loads progressively (from public profile)
- Hero image
- Opened/built date
- Summary paragraph
- Capability badges
- Capacity numbers

While these are loading, show a subtle inline skeleton or "Building profile…" micro-text — not a full-panel spinner.

### Image behavior
- Use `facts.imageUrl` if present → hero image, `object-fit: cover`, 100–120px height
- If image fails to load → silently hide (no broken icon)
- If no image → show a dark gradient placeholder with airport ICAO code centered in dim text
- Future: logo as small 24×24 badge overlaid bottom-right of hero image

### Name / codes layout
```
JOHN F. KENNEDY INTERNATIONAL AIRPORT
KJFK · JFK  ·  New York, US
Opened: 1948
```
- Name: accent color, 1.1rem, bold
- Codes: monospace, 0.75rem, 60% opacity
- Opened: only if `facts.opened` exists; omit row entirely if unknown

---

## 4. Capability Badge Design

Inline pill tags, small, no heavy borders.

```
[✈ International]  [📦 Cargo]  [🛬 Customs]  [⛽ Fuel]
```

Badge rules:
- Derive from `facts` keys or airport type
- Max 5 badges visible; overflow hidden under `[+N more]`
- Color: subtle tinted background matching GOD EYES palette
  - International: cyan tint
  - Cargo: amber tint
  - Helipad: purple tint
  - Closed: red tint, strikethrough name
- Do not show badges if no capability data — omit the row entirely

---

## 5. Capacity & Traffic Design

Collapsible section, default **open** if data exists, **hidden** if no data.

### Layout
```
CAPACITY & TRAFFIC
Annual passengers    62.5M (2023)
Cargo (tonnes)       1.2M
Runways              4
Gates                ~130
```

### 5-year passenger growth
- Show as a simple horizontal sparkline (5 bars, one per year)
- Each bar height proportional to passenger count
- Label: "2019–2023 trend"
- If only 1–2 years of data: show as plain numbers, no chart
- If no data: hide the row entirely (do not show "N/A")

### Important
- Do not show real-time data (live flight counts, current occupancy)
- Only show static/cached annual figures from public profile
- Label data year clearly: "62.5M (2023)" not just "62.5M"

---

## 6. Progressive Loading Design

The key principle: **never block the whole panel for one section**.

### Loading states per section

| Section | Source | Loading behavior |
|---------|--------|-----------------|
| Name / codes / type | Base object | Instant — always available |
| Hero image | Public profile | Fade in when loaded; placeholder until then |
| Summary | Public profile | Inline skeleton (2 lines, pulsing) while fetching |
| Capability badges | Public profile | Omit row until data arrives |
| Capacity / traffic | Public profile | Section hidden until data arrives |
| Runways / Frequencies | Detail API | Collapsible sections show spinner inside |
| Sources | Public profile | Section hidden until data arrives |

### "Building profile" micro-state
When API returns `202 fetching`:
```
Building public profile…  [●]
```
- Small, inline, below the airport name
- Animated dot or spinner (8px)
- Does NOT replace the whole Overview section
- Disappears automatically when profile arrives (polling)

### Skeleton design
For summary while loading:
```
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░
```
Two lines, pulsing opacity animation, same width as text area.
Avoids layout shift when real text arrives.

---

## 7. Source Confidence Design

Shown in the collapsible "Sources & Details" section at the bottom.

### Confidence display
```
📋 Wikipedia  ·  exact match  ·  high confidence
📋 Wikidata   ·  IATA lookup  ·  high confidence
Last checked: 3 days ago
```

- Do not show a numeric percentage (0.85) to normal users
- Map confidence levels to plain words:
  - 0.8–1.0 → "high confidence"
  - 0.5–0.79 → "partial match"
  - 0.0–0.49 → "uncertain match" (show warning, not data)
- Show match method in plain language: "exact IATA match", "name search", "fuzzy match"
- Attribution links: Wikipedia article title (linked), Wikidata entity ID (linked)
- License: "Creative Commons Attribution-ShareAlike License" (linked) for Wikipedia; "CC0" for Wikidata

### Low confidence behavior
- Do not display uncertain data as fact
- Show amber warning: "⚠ Profile match uncertain — verify before use"
- Offer "Show anyway" toggle
- This applies to the whole profile, not individual fields

---

## 8. Advanced Details (hidden by default)

Under a collapsible "Advanced Details" or inside existing sections:

- Raw coordinate source
- Elevation in feet/metres
- Source system ID
- Data quality metadata (runway count, frequency count, navaid radius)
- Full Wikidata property list
- Cache expiry / fetchedAt timestamp

These are useful for debugging and power users but should not be visible by default.

---

## 9. No-Data / Error Wording

### No public profile found
```
No public profile available for this airport.
```
(Calm, no apology, no technical jargon. Show basic airport info normally.)

### Profile building
```
Building public profile…
```
(Inline, small. Not a modal or full-section blocker.)

### Profile fetch error
```
Public profile unavailable.  [Retry]
```
(One line. Retry button inline.)

### Low confidence match
```
⚠ Profile match uncertain — data may not correspond to this airport.
[Show anyway]
```

### No capacity data
Omit the Capacity section entirely. Do not show "N/A" or empty rows.

### No image
Show dark placeholder with ICAO code. Do not show broken image icon.

### API offline (detail sections)
```
Offline — runway and frequency data unavailable.
```
(Inside the relevant section, not a full-panel error.)

---

## 10. Avoiding Slowness

1. **Show base data instantly** — name, codes, type badge never wait for API
2. **Skeleton placeholders** — prevent layout shift, signal activity
3. **Section-level loading** — each section loads independently
4. **Polling is silent** — "Building profile…" is a micro-indicator, not a blocker
5. **Collapsible sections default closed** — Runways/Frequencies/Navaids don't render until opened (lazy)
6. **Image fade-in** — hero image fades in with CSS transition, no pop
7. **No full-panel spinners** — the panel is never blank while waiting

---

## 11. Visual Hierarchy Summary

```
Priority 1 (always visible, instant):
  Airport name · ICAO/IATA · type badge

Priority 2 (visible when profile ready):
  Hero image · opened date · summary · capability badges

Priority 3 (collapsible, open by default if data exists):
  Capacity & traffic

Priority 4 (collapsible, closed by default):
  Infrastructure (runways / frequencies / navaids)
  Sources & details
  Advanced details
```

---

## 12. Open Questions

1. **Capacity data source** — `facts` from Wikidata/Wikipedia may have inconsistent keys for passenger counts. Should the normalizer standardize these into named fields (`annualPassengers`, `cargoTonnes`) rather than free-form `facts`?

2. **Sparkline library** — Is there a lightweight chart library already in the project, or should we use a pure CSS/SVG sparkline to avoid adding a dependency?

3. **Capability badge derivation** — Should badges come from the API (explicit list) or be derived client-side from `facts` keys? API-side is more reliable.

4. **Image source** — Wikipedia thumbnails are low-resolution. Should we plan for a higher-quality image source (e.g. Wikimedia Commons direct URL) in the normalizer?

5. **Lazy rendering for Runways/Frequencies/Navaids** — Currently these sections render even when collapsed. Should we add lazy rendering (only fetch/render when section is opened) to reduce initial load?

6. **Mobile layout** — The current panel is a fixed right sidebar. Is a bottom-sheet or full-screen modal needed for mobile/tablet?

---

## 13. Recommended Implementation Order

1. Implement skeleton placeholders for summary (no new data needed)
2. Add dark placeholder for missing hero image
3. Add capability badges derived from existing `facts` / airport type
4. Add Capacity section using existing `facts` keys
5. Standardize `facts` keys in normalizer (separate work order for Codex)
6. Add sparkline for 5-year growth (requires multi-year data — future)
7. Lazy render Runways/Frequencies/Navaids sections
