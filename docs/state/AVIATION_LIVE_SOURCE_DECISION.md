# AVIATION_LIVE_SOURCE_DECISION.md

**Layer:** layer_01_aviation  
**Decision Date:** 2026-05-28T06:52:02Z  
**Decision Author:** Kiro CLI (Claude Sonnet 4.5 — initial plan; architecture going forward uses Claude Sonnet 4.6)
**Work Order:** WO-079A-AVIATION-LIVE-SOURCE-SCHEMA-PLAN  
**Status:** DECIDED — Ready for implementation

---

## Decision Summary

| Question | Decision |
|----------|----------|
| Live source for MVP | **Airplanes.live official REST API** |
| Historical source | **OpenSky Network Trino** (future only, not MVP) |
| Global endpoint available? | **NO** — does not exist in Airplanes.live API |
| MVP fetch scope | **/mil + /ladd + /pia (global) + /point (camera region)** |
| Fetch cadence | **5-second cycle, 1 req/sec hard limit** |
| Dead reckoning | **NO** — interpolation between real positions only |
| Frontend direct API calls | **NO** — backend fetcher only |
| Military/PIA/LADD included | **YES** — all publicly available via official endpoints |

---

## Source 1: Airplanes.live (Live — MVP)

**Base URL:** `http://api.airplanes.live/v2/`  
**Source:** https://airplanes.live/api-guide/ (inspected 2026-05-28)  
**License:** Non-commercial use only  
**SLA:** None  
**Uptime guarantee:** None  
**Rate limit:** 1 request per second (documented)  
**Auth required:** No (currently)

### Why Airplanes.live

- Official public REST API with documented endpoints
- No authentication required for non-commercial use
- Provides global coverage for military, LADD, and PIA aircraft via dedicated endpoints
- ADS-B + MLAT data from crowdsourced receiver network
- Actively maintained (as of 2026)

### Critical Constraint: No Global Endpoint

The Airplanes.live API does **NOT** provide a global "all aircraft" endpoint. This was confirmed by direct inspection of the official API documentation at https://airplanes.live/api-guide/.

Available endpoints:
- `/hex/[hex]` — lookup by ICAO hex
- `/callsign/[callsign]` — lookup by callsign
- `/reg/[reg]` — lookup by registration
- `/type/[type]` — lookup by ICAO type code
- `/squawk/[squawk]` — lookup by squawk
- `/mil` — **all military aircraft globally** ✅
- `/ladd` — **all LADD aircraft globally** ✅
- `/pia` — **all PIA aircraft globally** ✅
- `/point/[lat]/[lon]/[radius]` — aircraft within radius (max 250 nm) ✅

There is no `/all`, `/global`, or equivalent endpoint. Civil aircraft can only be retrieved via `/point`.

### MVP Fetch Strategy

```
Cycle every 5 seconds (4 active requests, 1 req/sec):

  t=0s  GET /v2/mil                          → global military
  t=1s  GET /v2/ladd                         → global LADD
  t=2s  GET /v2/pia                          → global PIA
  t=3s  GET /v2/point/{lat}/{lon}/250        → civil, camera region (250 nm)
  t=4s  idle + housekeeping
```

**Civil aircraft outside 250 nm of camera center are NOT shown.** This is a documented limitation, not a bug.

### Non-Commercial Caveat

GOD EYES MVP is non-commercial/testing only. If GOD EYES ever becomes a commercial product, a new data agreement with Airplanes.live is required before continuing to use this API.

---

## Source 2: OpenSky Network (Historical — Future Only)

**Source:** https://openskynetwork.github.io/opensky-api/trino.html (inspected 2026-05-28)  
**Access method:** Trino SQL interface  
**Table:** `state_vectors_data4`  
**Retention:** Unlimited  

### Access Requirements

- Must apply at https://opensky-network.org/ → My OpenSky → Request Data Access
- Eligibility: university-affiliated researchers, governmental organisations, aviation authorities
- Private/commercial entities must contact for licence
- Access is granted based on application review; may be declined

### Why NOT for MVP Live

- REST API is heavily rate-limited for anonymous users (not suitable for 5s refresh)
- Trino access requires application and approval (not immediately available)
- Historical data only — not a live feed
- Does not replace Airplanes.live for live tracking

### Future Use Case

- Backfill `aviation_aircraft_observations` with historical tracks
- Enable timeline playback for past aircraft positions
- Research/analysis of historical flight patterns

**Do not block MVP on OpenSky access. Implement when access is granted.**

---

## Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|-----------------|
| Tiling globe with /point calls | Would require ~500+ calls/cycle, violates 1 req/sec limit |
| OpenSky REST API for live | Too rate-limited for anonymous; not suitable for 5s refresh |
| Website scraping | Not allowed; no explicit legal/allowed confirmation |
| FlightAware / FlightRadar24 | Commercial APIs; not suitable for non-commercial MVP |
| ADS-B Exchange | Not evaluated for MVP; Airplanes.live preferred |

---

## Data Inclusion Policy

Per user decision: include all publicly available aircraft from the source, including:
- ✅ Military aircraft (via `/mil`)
- ✅ PIA (Privacy ICAO Address) aircraft (via `/pia`)
- ✅ LADD (Limiting Aircraft Data Displayed) aircraft (via `/ladd`)
- ✅ Civil/commercial aircraft (via `/point`, camera region only)
- ✅ Aircraft with `is_interesting` flag

No aircraft are excluded if they are publicly returned by the official API.

---

## Required UI Caveat

When the aviation live layer is active, the following caveat MUST be displayed:

> "Live aircraft data: Airplanes.live (non-commercial/no-SLA). Civil aircraft shown within camera region only. Military/LADD/PIA shown globally. Not authoritative aviation data. Coverage may be incomplete."

---

## Next Steps

1. ✅ Planning complete (WO-079A — Claude Sonnet 4.5 initial plan)
2. ⬜ WO-079B: Database migrations — **Agent: GPT-5.5 (Codex)**
3. ⬜ WO-079C: Airplanes.live fetcher/normalizer — **Agent: MiniMax**
4. ⬜ WO-079D: Aviation live API endpoints — **Agent: DeepSeek**
5. ⬜ WO-079E: Frontend heading-arrow renderer — **Agent: Claude Sonnet 4.6**
6. ⬜ WO-079 Review — **Agent: Claude Haiku 4.5 / Reviewer CLI**
