# Normalization Design - Layer 08 News & OSINT

## Common Normalized Event Shape

```typescript
interface NormalizedNewsItem {
  // Core identifiers
  id: string;                    // UUID
  source_id: string;            // e.g., "gdacs", "gdelt", "reliefweb"
  source_object_id: string;     // ID from original source
  source_url: string;           // Link to original content
  
  // Content
  title: string;                // Headline or event name
  summary?: string;             // Brief description if available
  content_type: 'event' | 'report' | 'article' | 'alert';
  
  // Timing
  published_at: string;         // ISO timestamp when published
  updated_at?: string;          // ISO timestamp when last updated
  fetched_at: string;           // ISO timestamp when we fetched it
  
  // Location
  location: {
    confidence: 'exact_coordinate' | 'city_level' | 'region_level' | 'country_level' | 'unknown';
    country_code?: string;      // ISO 3166-1 alpha-2
    country_name?: string;
    region?: string;            // Continent or major region
    city?: string;
    latitude?: number;
    longitude?: number;
    geo_source: 'provided' | 'extracted' | 'geocoded' | 'inferred';
  };
  
  // Categorization
  category: 'disaster' | 'health' | 'security' | 'humanitarian' | 'infrastructure' | 'environment' | 'other';
  subcategory?: string;         // e.g., "earthquake", "flood", "outbreak"
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  
  // Source metadata
  source_domain?: string;       // e.g., "cnn.com", "bbc.com"
  source_language?: string;     // ISO 639-1
  source_country?: string;      // ISO 3166-1 alpha-2
  
  // Media
  image_url?: string;           // Primary image if available
  
  // Quality metrics
  duplicate_of?: string;        // ID of original item if duplicate
  confidence_score?: number;    // 0-1 confidence in normalization
}
```

## Source-Specific Field Mapping

### GDACS → NormalizedNewsItem

| GDACS Field | Normalized Field | Transformation |
|-------------|------------------|----------------|
| `properties.eventid` | `source_object_id` | Direct mapping |
| `properties.eventtype` | `category`, `subcategory` | Map: EQ→disaster/earthquake, FL→disaster/flood, etc. |
| `properties.alertlevel` | `severity` | Map: RED→critical, ORANGE→high, GREEN→medium |
| `properties.country` | `location.country_code` | Direct mapping (2-letter code) |
| `geometry.coordinates` | `location.latitude`, `location.longitude` | GeoJSON coordinates |
| `properties.humanReadable` | `title` | Use as event name |
| `properties.description` | `summary` | Use as description |
| `properties.from` | `published_at` | Convert to ISO |
| `properties.to` | `updated_at` | Convert to ISO |
| N/A | `content_type` | Set to 'event' |
| N/A | `location.confidence` | Set to 'exact_coordinate' |
| N/A | `location.geo_source` | Set to 'provided' |

### GDELT DOC 2.0 → NormalizedNewsItem

| GDELT Field | Normalized Field | Transformation |
|-------------|------------------|----------------|
| `url` | `source_url` | Direct mapping |
| `title` | `title` | Direct mapping |
| `seendate` | `published_at` | Convert YYYYMMDDHHMMSS to ISO |
| `domain` | `source_domain` | Direct mapping |
| `language` | `source_language` | Map 3-letter to 2-letter code |
| `sourcecountry` | `source_country` | Map country name to code |
| `socialimage` | `image_url` | Direct mapping |
| N/A | `category` | Infer from query terms or set to 'other' |
| N/A | `severity` | Set to 'unknown' |
| N/A | `location.confidence` | Set to 'country_level' (from sourcecountry) |
| N/A | `content_type` | Set to 'article' |

### ReliefWeb → NormalizedNewsItem

| ReliefWeb Field | Normalized Field | Transformation |
|-----------------|------------------|----------------|
| `id` | `source_object_id` | Convert to string |
| `fields.title` | `title` | Direct mapping |
| `fields.url` | `source_url` | Construct from id |
| `fields.body` | `summary` | Truncate to 500 chars |
| `fields.date` | `published_at` | Convert to ISO |
| `fields.source.name` | `source_domain` | Use organization name |
| `fields.country.name` | `location.country_name` | Direct mapping |
| `fields.country.iso3` | `location.country_code` | Map to 2-letter code |
| `fields.disaster.name` | `subcategory` | Direct mapping |
| N/A | `category` | Infer from disaster type |
| N/A | `severity` | Set to 'unknown' (not provided) |
| N/A | `location.confidence` | Set to 'country_level' |
| N/A | `content_type` | Set to 'report' |

### RSS/Atom → NormalizedNewsItem

| RSS Field | Normalized Field | Transformation |
|-----------|------------------|----------------|
| `link` | `source_url` | Direct mapping |
| `title` | `title` | Direct mapping |
| `pubDate` or `published` | `published_at` | Convert to ISO |
| `description` or `summary` | `summary` | Clean HTML, truncate |
| Feed source | `source_domain` | Use feed domain |
| N/A | `category` | Infer from feed topic or set to 'other' |
| N/A | `severity` | Set to 'unknown' |
| N/A | `location.confidence` | Set to 'unknown' |
| N/A | `content_type` | Set to 'article' |

## Location Confidence Levels

### exact_coordinate
- **Source**: GDACS (direct coordinates)
- **Accuracy**: Within meters
- **Display**: Exact point on globe
- **Use case**: Disaster markers, precise locations

### city_level
- **Source**: Extracted from text, geocoded
- **Accuracy**: Within city bounds
- **Display**: City marker or general area
- **Use case**: City-specific events

### region_level
- **Source**: Extracted from text, inferred
- **Accuracy**: Within region/state
- **Display**: Region highlight
- **Use case**: Regional disasters, conflicts

### country_level
- **Source**: GDELT sourcecountry, ReliefWeb country
- **Accuracy**: Within country borders
- **Display**: Country marker or highlight
- **Use case**: Country-level reports, general events

### unknown
- **Source**: No location info available
- **Accuracy**: N/A
- **Display**: List only (no globe marker)
- **Use case**: Global events, opinion pieces

## Severity Normalization

### Severity Levels
```typescript
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';
```

### Source Mapping

**GDACS:**
- RED → critical
- ORANGE → high
- GREEN → medium
- Default → unknown

**GDELT:**
- No severity field → unknown
- Could infer from tone metric in future

**ReliefWeb:**
- No severity field → unknown
- Could infer from disaster type in future

**RSS Feeds:**
- No severity field → unknown

## Category Normalization

### Category Hierarchy
```typescript
type Category = 'disaster' | 'health' | 'security' | 'humanitarian' | 'infrastructure' | 'environment' | 'other';

type Subcategory = 
  | 'earthquake' | 'flood' | 'cyclone' | 'wildfire' | 'volcano' | 'drought'  // disaster
  | 'outbreak' | 'pandemic' | 'health_emergency'                              // health
  | 'conflict' | 'protest' | 'terrorism' | 'crime'                            // security
  | 'displacement' | 'famine' | 'humanitarian_crisis'                         // humanitarian
  | 'power_outage' | 'transport_disruption' | 'communication_failure'        // infrastructure
  | 'climate_event' | 'pollution' | 'environmental_hazard'                   // environment
  | 'other';                                                                   // other
```

### Source Mapping

**GDACS:**
- EQ → disaster/earthquake
- FL → disaster/flood
- TC → disaster/cyclone
- WF → disaster/wildfire
- VO → disaster/volcano
- DR → disaster/drought

**GDELT:**
- Infer from query terms
- Default to 'other'

**ReliefWeb:**
- Map disaster.name to subcategory
- Default to 'other'

**RSS Feeds:**
- Infer from feed topic
- Default to 'other'

## Deduplication Approach

### Deduplication Strategy
1. **Exact URL Match**: Same source_url = duplicate
2. **Title Similarity**: Levenshtein distance > 0.8 = potential duplicate
3. **Source + Time**: Same source within 1 hour = potential duplicate
4. **Content Fingerprint**: Hash of title + source = duplicate detection

### Deduplication Rules
- Keep the earliest occurrence as original
- Mark later occurrences as duplicates
- Store duplicate_of reference
- Display original in list, hide duplicates
- Allow override for significant updates

### Deduplication Window
- **GDACS**: 24 hours (events update frequently)
- **GDELT**: 7 days (articles persist)
- **ReliefWeb**: 30 days (reports are stable)
- **RSS**: 7 days (feeds may repeat)

## Quality Metrics

### Confidence Score Calculation
```typescript
function calculateConfidence(item: NormalizedNewsItem): number {
  let score = 0.5; // Base score
  
  // Source reliability
  if (['gdacs', 'reliefweb'].includes(item.source_id)) score += 0.2;
  
  // Location confidence
  if (item.location.confidence === 'exact_coordinate') score += 0.2;
  else if (item.location.confidence === 'country_level') score += 0.1;
  
  // Content completeness
  if (item.title && item.summary) score += 0.1;
  if (item.published_at) score += 0.05;
  if (item.image_url) score += 0.05;
  
  return Math.min(1.0, score);
}
```

### Quality Flags
- `missing_coordinates`: No lat/lon available
- `missing_summary`: No description available
- `low_confidence`: Confidence score < 0.5
- `potential_duplicate`: Similar to another item
- `stale_data`: Published > 7 days ago
- `unverified_source`: Source not in trusted list

---

## WO-NEWS-N1 Implementation Notes (2026-06-11)

GDACS normalizer implemented and proven.

**Module**: `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdacs_normalizer.py`

**Functions**:
- `normalize_gdacs_feature(feature, fetched_at, raw_evidence_uri=None)` → normalized dict or None
- `normalize_gdacs_payload(payload, fetched_at, raw_evidence_uri=None)` → result dict with items + counts

**Key decisions**:
- Only Point geometry items get `marker_ready=True` and extracted lat/lon.
- LineString and Polygon geometries: `marker_ready=False`, `location.latitude/longitude=None`, geometry_type preserved in `provider_metadata`.
- Title fallback priority: `humanReadable`/`title` → `"{Type} alert in {country}"` → `"{Type} alert"` → `"GDACS disaster alert"`.
- `dedupe_key` format: `gdacs:{eventid}:{episodeid}:{eventtype}`.
- All 171 features normalized (0 skipped) in live proof run.
