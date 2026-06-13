# Database Planning - Layer 08 News & OSINT

## Implementation Status

WO-NEWS-D1 adds the Layer 08 PostgreSQL/PostGIS schema in:

`database/migrations/layers/layer_08_news_osint/001_news_tables.sql`

The migration is additive and source-flexible. It seeds only GDACS, but the
tables accept additional source IDs and source families without schema changes.
No ingestion, API, or frontend behavior is included in this work order.

## Tables

### `news_sources`

Stores source configuration, attribution, license, rate limits, source family,
health timestamps, and provider-specific JSONB metadata. `source_id` is the
text primary key. The migration seeds the GDACS event-list endpoint
idempotently with CC BY 4.0 attribution.

### `news_fetch_runs`

Tracks proof and future ingestion runs by source. Supported states are
`running`, `success`, `partial`, and `failed`. Counts are non-negative, marker
counts cannot exceed normalized counts, and normalized counts cannot exceed
fetched counts.

### `news_items_latest`

Stores one latest row per `dedupe_key` for every normalized item, including
items that cannot render as point markers. The table preserves source identity,
content, source timestamps, location confidence, geometry type,
categorization, attribution, raw evidence URI, and provider metadata.

The normalized source timestamp is stored as `source_updated_at`. The database
row-maintenance timestamp remains `updated_at`, avoiding two meanings for the
same column name.

Coordinate rules:

- Latitude and longitude are nullable and must appear as a pair.
- `has_coordinates=true` requires a valid coordinate pair.
- Latitude is constrained to -90 through 90.
- Longitude is constrained to -180 through 180.
- `marker_ready=true` requires coordinates and `geometry_type='Point'`.
- A trigger creates `geom GEOMETRY(Point, 4326)` from marker-ready coordinates.
- Non-marker-ready rows have `geom=NULL`.
- Stored geometry must match the row latitude and longitude.

This allows all 171 normalized GDACS proof items to be stored. The 47 Point
items can be marker-ready, while the 48 LineString and 76 Polygon items remain
available for lists, audit, and future shape handling without invented
coordinates.

### `news_item_history`

Stores versioned JSONB snapshots for audit and replay. Rows link to the latest
item, source, and optional fetch run. `(item_id, version)` is unique.

### `news_raw_message_refs`

Stores references to raw evidence objects, not raw response bodies. References
may include a fetch run, source object ID, dedupe key, byte offset, line number,
and provider metadata.

## Index Strategy

The migration provides:

- Unique dedupe lookup on `news_items_latest.dedupe_key`.
- Source, published time, fetched time, category, subcategory, severity,
  country, and marker-ready indexes.
- Composite marker-ready and published-time index.
- Partial GiST index on marker-ready non-null Point geometry.
- GIN index on latest-item provider metadata.
- Version, dedupe, source, and recorded-time history indexes.
- Fetch-run and raw-reference lookup indexes.

## Source Flexibility

No source-specific item table or closed source-family enum is used. The schema
can support GDACS disaster events now and future article, report, and feed
sources such as GDELT, ReliefWeb, and RSS after their own approved fetcher and
normalizer work orders.

## Retention

Retention and partitioning remain operational decisions for a later work order.
The MVP schema does not delete or archive rows automatically.

## Validation

Static migration tests verify table, column, constraint, seed, index, scope,
and safety contracts. Optional local PostGIS integration tests apply the
migration twice and exercise marker, non-marker, rejection, dedupe, fetch-run,
history, raw-reference, and future-source inserts.

## GDELT Event Export Ingestion

The existing source-flexible tables support GDELT Event Export records without
destructive schema changes. The migration now also seeds the active
`gdelt_event_export` source with `source_family=global_event`, no authentication,
source attribution, public dataset terms, and structured event-export metadata.
The existing GDACS seed remains unchanged.

`database/ingestion/layers/layer_08_news_osint/gdelt_db_ingestion.py` adapts the
flat GDELT normalizer output to the shared News tables:

- `source_event_id` is stored as `source_object_id`.
- `gdelt_event_export:<global_event_id>` remains the unique dedupe identity.
- Compact GDELT timestamps are parsed into UTC `source_updated_at` values.
- Valid coordinates are stored as provided; no coordinates are synthesized.
- The existing trigger creates Point geometry only when `marker_ready=true`.
- List-only rows retain null geometry.
- Raw references store the export object URI and compact identity metadata, not CSV rows.
- Fetch run, latest, history, raw-reference, and run-completion writes commit once per batch.
- `first_seen_at` is preserved, while `last_seen_at` advances on every successful repeat.

The ingestion rejects source identity drift, malformed timestamps, invalid coordinate
pairs, invalid marker-ready records, and duplicate dedupe keys within one batch.
