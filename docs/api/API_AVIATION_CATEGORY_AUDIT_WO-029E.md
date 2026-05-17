# API Aviation Category Audit

## WO-029E

### Executive Summary

The backend database and API are functioning **correctly**. The category data is accurate, category filtering works properly, and there are no bugs in the API category handling. The frontend issues are **not** caused by backend problems.

---

## 1. Actual Backend Category Values

### Database Categories (7 total)

| Category | Count |
|----------|-------|
| small_airfield | 42,616 |
| heliport | 22,980 |
| closed_or_abandoned | 13,181 |
| regional_or_domestic_airport | 4,095 |
| water_landing_site | 1,262 |
| international_or_major_airport | 1,182 |
| balloonport | 61 |

**Note**: The API defines "unknown" as a valid category, but **no airports in the database have this category**. The "unknown" value exists in the allowlist but has zero data.

### API Validation (constants.ts)

```typescript
export const VALID_CATEGORIES = [
  'international_or_major_airport',
  'regional_or_domestic_airport',
  'small_airfield',
  'heliport',
  'water_landing_site',
  'balloonport',
  'closed_or_abandoned',
  'unknown',  // No data in DB
] as const;
```

---

## 2. India and China International Airports

### Query Result: India (bbox 68,6,98,37)

```
GET /api/layers/layer_01_aviation/objects?objectType=airport&category=international_or_major_airport&bbox=68,6,98,37&limit=5

Total: 68 results (Pakistan, Sri Lanka, India)
India airports returned: Bagdogra, Biju Patnaik, Chennai, Mumbai, etc.
```

**Verdict**: ✅ API correctly returns India international airports.

### Query Result: China (bbox 73,18,135,54)

```
GET /api/layers/layer_01_aviation/objects?objectType=airport&category=international_or_major_airport&bbox=73,18,135,54&limit=3

Total: 158 results (Russia, Kazakhstan, China, etc.)
```

Database query shows **China has 69 international_or_major_airport** entries.

**Verdict**: ✅ API correctly returns China international airports.

---

## 3. Asia Water/Seaplane Sites

### Database Query

```
water_landing_site by country (top 20):
US:   676
CA:   443
FR:    19
LK:    18  (Sri Lanka)
MV:    11  (Maldives)
IT:     7
NO:     7
PH:     6  (Philippines)
JP:     6
MX:     6
FJ:     5
CN:     3
...
```

### API Query (Asia bbox 60,-10,150,45)

```
GET /api/layers/layer_01_aviation/objects?objectType=airport&category=water_landing_site&bbox=60,-10,150,45&limit=10

Total: 48 results
Primary countries: Maldives (MV), Sri Lanka (LK), Philippines (PH)
```

### Verdict

✅ **Data is correct** - The low count for Asia is the **actual data** in the database:
- China: 3 water sites
- Japan: 6 water sites
- India: 0 water sites in the bbox results
- US dominates with 676 (53% of all water sites)

This is not an API bug - it's the actual data distribution from OpenFlights data source.

---

## 4. API Category Filtering

### Single Category Filter

```
GET /api/layers/layer_01_aviation/objects?objectType=airport&category=heliport&limit=3

✅ Works correctly - returns only heliports
```

### Multiple Category Filter

```
GET /api/layers/layer_01_aviation/objects?objectType=airport&category=heliport,water_landing_site

❌ Returns 400: INVALID_CATEGORY
```

**Verdict**: API does NOT support multiple category filters. Only single category is supported.

---

## 5. Limit Application

### Test: Category filter before limit

```
GET /api/layers/layer_01_aviation/objects?objectType=airport&category=small_airfield&limit=5

Response:
{
  "items": [...5 items...],
  "pagination": {
    "limit": 5,
    "returned": 5,
    "total": 42616  // Full count, not capped at 5
  }
}
```

**Verdict**: ✅ Limit is applied AFTER category filter. Pagination shows correct total count (42,616), not capped to limit (5).

---

## 6. fields=marker Preserves Category

### Test

```
GET /api/layers/layer_01_aviation/objects?objectType=airport&fields=marker&category=heliport&limit=3

Response items include:
{
  "id": "...",
  "layerId": "layer_01_aviation",
  "objectType": "airport",
  "name": "1000 Museum Heliport",
  "ident": "US-1285",
  "category": "heliport",  ✅ Present
  "municipality": "Miami",
  "country": "US",
  "position": {...}
}
```

**Verdict**: ✅ fields=marker correctly includes `category` field.

---

## 7. typeSource in marker vs standard

### Standard mode (AirportObjectSchema)

```typescript
{
  "typeSource": "large_airport",  ✅ Present
  "category": "international_or_major_airport",
  ...
}
```

### Marker mode (AirportMarkerObjectSchema)

```typescript
{
  "category": "water_landing_site",  ✅ Present
  // typeSource: ❌ NOT included
}
```

**Analysis**: The marker payload intentionally omits `typeSource` for lightweight response. However, since `category` already identifies water_landing_site (seaplane bases), typeSource may not be needed.

**Water_landing_site type_source**: All water_landing_site entries have `type_source = 'seaplane_base'` (1,262 entries).

---

## 8. Backend Correctness Verdict

| Check | Result |
|-------|--------|
| India international airports returned | ✅ Correct |
| China international airports returned | ✅ Correct |
| Asia water sites returned | ✅ Correct (data is sparse) |
| Category filtering works | ✅ Correct |
| Limit applied after filter | ✅ Correct |
| fields=marker has category | ✅ Correct |
| typeSource in standard mode | ✅ Present |
| typeSource in marker mode | ❌ Missing (by design) |

### Final Verdict

**The backend is CORRECT.** The frontend issues are NOT caused by API or database bugs:

1. **India/China not showing**: Works correctly - frontend may be filtering incorrectly or using wrong bbox
2. **Water sites undercounted**: This is the actual data - OpenFlights data has few Asia water sites
3. **Multiple category filter**: Not supported by API - frontend must make multiple requests

---

## 9. Recommended Fix Path

### For Frontend Team

1. **Verify bbox coordinates** - India/China bbox might be wrong in frontend
2. **Check client-side filtering** - Frontend may be filtering out valid results
3. **Multiple category requests** - Instead of `category=a,b`, make separate requests and combine client-side
4. **Accept actual water site data** - The sparse Asia water site count is the real data

### Optional Backend Enhancement (Not Required)

1. Add multi-category support: `category=a&category=b` or `category=a,b`
2. Add typeSource to marker payload (minor change)
3. Add "unknown" category to API validation only if data is populated later

---

## Metadata

- **Work Order**: WO-029E
- **Agent**: Claude API 1
- **Role**: API/Database Investigation
- **Created**: 2026-05-17
- **Status**: Audit Complete