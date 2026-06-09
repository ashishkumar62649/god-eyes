# Source Decisions — Layer 06 Maritime

**WO-MAR-R** — Maritime Source Research
**Date**: 2026-06-09

---

## Decision Summary

| Source | Decision | Rationale |
|--------|----------|-----------|
| **AISStream** | **READY_FOR_FETCH_PROOF** | Free API key, WebSocket real-time, global coverage, docs verified |
| **BarentsWatch** | **FUTURE_SOURCE** | Regional (Norway), not global enough for MVP |
| **AISHub** | **FUTURE_SOURCE** | Requires AIS hardware/data contribution |
| **Danish Maritime Authority** | **FUTURE_ANALYSIS_SOURCE** | Historical only, not live |
| **NOAA AccessAIS** | **FUTURE_ANALYSIS_SOURCE** | Historical only, US waters |
| **Global Fishing Watch** | **FUTURE_ANALYSIS_SOURCE** | Delayed (5+ days), fishing-vessel focus |
| **MarineTraffic** | **REJECT_FOR_MVP** | Paid API required, no free tier |

---

## AISStream — READY_FOR_FETCH_PROOF

### Why AISStream

1. **Free API key** available with sign-up (GitHub or other auth)
2. **WebSocket real-time** — messages arrive as ships transmit
3. **Global coverage** — AIS receivers worldwide
4. **Well-documented** — clear API reference, code examples
5. **Multiple message types** — PositionReport, ShipStaticData, ClassB, etc.
6. **OpenAPI models** — type definitions available for validation

### Verified Facts

| Fact | Value |
|------|-------|
| Endpoint | `wss://stream.aisstream.io/v0/stream` |
| Auth | API key required |
| Env var | `AISSTREAM_API_KEY` |
| BoundingBoxes | Required (use `[[-90,-180],[90,180]]` for global) |
| Subscription timeout | 3 seconds |
| Free tier throughput | ~300 msg/s (global) |
| MMSI filter max | 50 values |
| Update throttle | 1 per second |

### Discrepancies Found

| # | Issue | Resolution |
|---|-------|------------|
| 1 | BoundingBoxes required (not optional as planned) | Always include bbox in subscription |
| 2 | Timestamp is integer (not ISO string) | Parse seconds-since-minute |
| 3 | Dimensions are A/B/C/D (not length/width) | Compute length/width from A+B and C+D |
| 4 | ETA is object (not ISO string) | Reconstruct ISO datetime, year unknown |
| 5 | Field names differ (Sog/Cog vs Speed/Course) | Map accordingly in normalizer |

### Risks Accepted for MVP

1. BETA service — no SLA, no uptime guarantee
2. Unstable API — object models may change
3. Free tier limit not precisely documented
4. ShipStaticData not guaranteed for every vessel
5. Connection may drop without warning

### Conditions for Proceeding

- [ ] WO-MAR-S must verify free tier throughput is sufficient
- [ ] WO-MAR-S must verify global subscription works
- [ ] WO-MAR-S must capture actual message samples
- [ ] Normalizer must handle all discrepancies documented above

---

## BarentsWatch — FUTURE_SOURCE

### Why Not MVP

- Regional coverage only (Norwegian waters)
- Docs URL returned 404 (uncertain availability)
- REST API (not real-time WebSocket)
- Would require separate integration

### Future Use

- Regional fallback if AISStream fails for Norwegian waters
- Historical position data for Norwegian vessels

---

## AISHub — FUTURE_SOURCE

### Why Not MVP

- Requires contributing AIS data (hardware receiver)
- Coverage depends on contributors
- Not guaranteed available without hardware

### Future Use

- Crowdsourced AIS data for regions with poor coverage
- Backup if AISStream free tier is insufficient

---

## Danish Maritime Authority — FUTURE_ANALYSIS_SOURCE

### Why Not MVP

- Historical only (bulk downloads)
- Not real-time
- Regional (Danish waters)

### Future Use

- Historical vessel movement analysis
- Danish waters replay/visualization

---

## NOAA AccessAIS — FUTURE_ANALYSIS_SOURCE

### Why Not MVP

- Historical only
- US waters primarily
- Not real-time

### Future Use

- US waters historical analysis
- Training data for vessel behavior models

---

## Global Fishing Watch — FUTURE_ANALYSIS_SOURCE

### Why Not MVP

- Delayed data (5+ days)
- Fishing-vessel focus
- Not suitable for live ship tracking

### Future Use

- Fishing activity analytics
- Vessel behavior analysis

---

## MarineTraffic — REJECT_FOR_MVP

### Why Rejected

- No free API tier
- Paid subscription required
- Commercial terms may restrict reuse
- Not suitable for open-source project

---

## Next Steps

1. **WO-MAR-S**: Fetch proof with AISStream
2. Verify free tier throughput
3. Capture actual message samples
4. Confirm all field mappings
5. Document any additional discrepancies

---

**Created by**: Fetching Worker (WO-MAR-R)
**Date**: 2026-06-09
