import type { VesselObjectRow, VesselDetailRow, PositionHistoryRow } from './types.js';

const LAYER_ID = 'layer_06_maritime';

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const n = Number(value); if (!isNaN(n) && isFinite(n)) return n; }
  return 0;
}

export function toInteger(value: unknown): number { return Math.round(toNumber(value)); }

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const n = Number(value); if (!isNaN(n) && isFinite(n)) return n; }
  return null;
}

export function toIntegerOrNull(value: unknown): number | null {
  const n = toNumberOrNull(value);
  return n === null ? null : Math.round(n);
}

export function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

export function rowToVesselObject(row: VesselObjectRow) {
  const receivedAt = toIsoString(row.receivedAt);
  const receivedMs = new Date(receivedAt).getTime();
  const dataAgeSeconds = isNaN(receivedMs) ? null : Math.floor((Date.now() - receivedMs) / 1000);
  return {
    id: row.id,
    layerId: LAYER_ID,
    sourceId: row.sourceId,
    mmsi: toInteger(row.mmsi),
    dedupeKey: row.dedupeKey,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    speedOverGround: toNumberOrNull(row.speedOverGround),
    courseOverGround: toNumberOrNull(row.courseOverGround),
    trueHeading: toIntegerOrNull(row.trueHeading),
    navigationStatus: toIntegerOrNull(row.navigationStatus),
    navigationStatusText: row.navigationStatusText,
    positionAccuracy: row.positionAccuracy === null ? null : Boolean(row.positionAccuracy),
    receivedAt,
    dataAgeSeconds,
    vesselName: row.vesselName,
    vesselType: row.vesselType,
    vesselTypeCode: toIntegerOrNull(row.vesselTypeCode),
    callsign: row.callsign,
    imo: toIntegerOrNull(row.imo),
    destination: row.destination,
    lengthMeters: toNumberOrNull(row.lengthMeters),
    widthMeters: toNumberOrNull(row.widthMeters),
  };
}

export function rowToVesselDetail(row: VesselDetailRow) {
  return {
    ...rowToVesselObject(row),
    rawEvidenceUri: row.rawEvidenceUri,
    draughtMeters: toNumberOrNull(row.draughtMeters),
    etaMonth: toIntegerOrNull(row.etaMonth),
    etaDay: toIntegerOrNull(row.etaDay),
    etaHour: toIntegerOrNull(row.etaHour),
    etaMinute: toIntegerOrNull(row.etaMinute),
    etaDisplay: row.etaDisplay,
    lastPositionAt: row.lastPositionAt ? toIsoString(row.lastPositionAt) : null,
    lastReceivedAt: row.lastReceivedAt ? toIsoString(row.lastReceivedAt) : null,
  };
}

export function rowToPosition(row: PositionHistoryRow) {
  return {
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    speedOverGround: toNumberOrNull(row.speedOverGround),
    courseOverGround: toNumberOrNull(row.courseOverGround),
    trueHeading: toIntegerOrNull(row.trueHeading),
    receivedAt: toIsoString(row.receivedAt),
  };
}
