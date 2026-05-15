# Aviation Coordinate Quality And Overrides

WO-014 adds the data-side foundation for tracking aviation coordinate quality and
future manual coordinate corrections.

## Why Coordinate Offsets Happen

Airport and heliport markers can appear offset from visible satellite imagery for
several reasons:

- The source record may use an approximate field, airport centroid, building
  centroid, parcel location, or legacy coordinate.
- Rooftop heliports can be difficult to place from public reference data because
  the intended landing point may not be the visual center of the roof marking.
- Satellite imagery tiles can be misaligned, stale, orthorectified differently,
  or captured before a facility changed.
- Normalized database coordinates are numeric values derived from source CSV
  fields, so the original string precision is not preserved after normalization.

## Source-Data Preservation Rule

Raw source coordinates must never be overwritten. OurAirports raw CSV records and
the normalized `aviation_airports.latitude_deg`, `aviation_airports.longitude_deg`,
and `aviation_airports.geom` values remain source-derived data.

Corrections must be stored separately with provenance, confidence, reviewer, and
approval fields. Rollback should mean disabling or superseding an override, not
editing source-derived rows.

## Manual Override Strategy

The `aviation_coordinate_overrides` table stores optional corrected coordinates
without mutating source coordinates.

Each override records:

- `source_id` and `source_object_id` for source identity.
- `airport_ident` for human review and lookup.
- original latitude and longitude copied from the source-derived row at review
  time.
- override latitude and longitude.
- override reason, evidence URL, confidence score, reviewer, approver, and
  active flag.

Only active, approved overrides should be eligible for future API/frontend use.
Inactive rows remain useful audit history.

## Review Statuses

The `aviation_coordinate_quality_reviews` table supports these statuses:

- `unreviewed`: candidate is known but has not been checked.
- `visually_verified`: marker placement was reviewed and accepted.
- `approximate`: coordinate is usable but intentionally approximate.
- `suspected_offset`: coordinate may be offset and needs deeper review.
- `source_error`: evidence indicates the source coordinate is wrong.
- `closed_or_obsolete`: facility appears closed, moved, renamed, or obsolete.

## Override Approval Flow

1. A user or tester reports an airport or heliport marker offset.
2. A data reviewer compares the source record, visible imagery, official airport
   material where available, and any other acceptable evidence.
3. The reviewer creates a quality review row and, if justified, proposes an
   override row with an evidence URL and confidence score.
4. A separate approver marks the selected override active after review.
5. A later API task may prefer the active override coordinate for map output
   while still exposing source provenance.

## Future API And Frontend Consumption

This task does not change API routes or frontend behavior. A future backend task
can join `aviation_airports` to the single active override for the same
`source_id` and `source_object_id`, then expose effective coordinates like:

- source latitude and longitude for audit/reference.
- effective latitude and longitude for display.
- an `is_coordinate_overridden` flag.
- override confidence and review metadata when appropriate.

The frontend should not connect directly to these tables. API routes should own
the layer-aware query and decide when an active override is safe to surface.

## Risk Of Blind Corrections

Visually moving a marker to match one imagery provider can introduce false
precision. Imagery alignment and source data can both be imperfect. Some airport
records intentionally represent a property, airport center, entrance, or closed
facility rather than a precise touchdown point.

Every correction should have evidence, reviewer accountability, and an easy
rollback path. Suspected offsets without sufficient evidence should remain
quality review notes, not active overrides.

## Example Workflow

1. User reports that a heliport marker appears offset from the rooftop marking.
2. Data reviewer verifies satellite/source evidence and records a
   `suspected_offset` review.
3. Reviewer proposes an override with original coordinates, proposed corrected
   coordinates, reason, evidence URL, and confidence score.
4. Approver reviews the evidence and marks one override active.
5. API may later prefer the active override coordinate while retaining the raw
   source-derived coordinates for audit.

## Known Limitation

The existence of a visible offset is not proof of a source error. Satellite
imagery alignment, source coordinate precision, facility changes, and rooftop
ambiguity can all affect the apparent marker position.
