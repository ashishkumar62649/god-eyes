// Converts database row shapes to API response shapes for the aviation aircraft route.
import { toIsoString } from '../../../lib/typeUtils.js';
import type { AircraftLatestRow } from './types.js';

export { toIsoString };

export function rowToLatest(row: AircraftLatestRow) {
  return {
    sourceId: row.sourceId,
    sourceObjectId: row.sourceObjectId,
    callsign: row.callsign,
    registration: row.registration,
    aircraftType: row.aircraftType,
    dbFlags: row.dbFlags,
    isMilitary: row.isMilitary,
    isInteresting: row.isInteresting,
    isPia: row.isPia,
    isLadd: row.isLadd,
    sourceMessageType: row.sourceMessageType,
    lat: row.lat,
    lon: row.lon,
    altitudeBaroFt: row.altitudeBaroFt,
    altitudeGeomFt: row.altitudeGeomFt,
    onGround: row.onGround,
    groundSpeedKt: row.groundSpeedKt,
    trackDeg: row.trackDeg,
    headingMagDeg: row.headingMagDeg,
    headingTrueDeg: row.headingTrueDeg,
    verticalRateFpm: row.verticalRateFpm,
    geomRateFpm: row.geomRateFpm,
    squawk: row.squawk,
    emergency: row.emergency,
    seenSeconds: row.seenSeconds,
    seenPosSeconds: row.seenPosSeconds,
    observedAt: toIsoString(row.observedAt),
    receivedAt: toIsoString(row.receivedAt),
    staleAfter: row.staleAfter ? toIsoString(row.staleAfter) : null,
    firstSeenAt: toIsoString(row.firstSeenAt),
    lastSeenAt: toIsoString(row.lastSeenAt),
  };
}

export function rowToDetail(row: AircraftLatestRow) {
  const detail = rowToLatest(row) as ReturnType<typeof rowToLatest> & { rawJson?: Record<string, unknown> | null };
  if (row.rawJson !== undefined) {
    detail.rawJson = row.rawJson;
  }
  return detail;
}