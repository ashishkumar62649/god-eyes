export interface ObjectsQuerystring {
  bbox?: string;
  vessel_type?: string;
  min_speed?: string;
  max_speed?: string;
  updated_since?: string;
  mmsi?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export interface ObjectIdParams { objectId: string; }
export interface MmsiParams { mmsi: string; }
export interface PositionsQuerystring { hours?: string; limit?: string; }

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface VesselObjectRow {
  id: string;
  layerId: string;
  sourceId: string;
  mmsi: number;
  dedupeKey: string;
  latitude: number;
  longitude: number;
  speedOverGround: number | null;
  courseOverGround: number | null;
  trueHeading: number | null;
  navigationStatus: number | null;
  navigationStatusText: string | null;
  positionAccuracy: boolean | null;
  receivedAt: Date | string;
  vesselName: string | null;
  vesselType: string | null;
  vesselTypeCode: number | null;
  callsign: string | null;
  imo: number | null;
  destination: string | null;
  lengthMeters: number | null;
  widthMeters: number | null;
}

export interface VesselDetailRow extends VesselObjectRow {
  rawEvidenceUri: string | null;
  draughtMeters: number | null;
  etaMonth: number | null;
  etaDay: number | null;
  etaHour: number | null;
  etaMinute: number | null;
  etaDisplay: string | null;
  lastPositionAt: Date | string | null;
  lastReceivedAt: Date | string | null;
}

export interface StatsRow {
  totalVessels: number;
  activeVessels: number;
  staleVessels: number;
  lastUpdated: Date | string | null;
}

export interface VesselTypeRow {
  vesselType: string | null;
  count: number;
}

export interface PositionHistoryRow {
  latitude: number;
  longitude: number;
  speedOverGround: number | null;
  courseOverGround: number | null;
  trueHeading: number | null;
  receivedAt: Date | string;
}

export interface VesselNameRow {
  vesselName: string | null;
}
