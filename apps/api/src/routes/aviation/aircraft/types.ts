// Route-local TypeScript types for the aviation aircraft route.

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface LatestAircraftQuerystring {
  limit?: string;
  includeStale?: string;
  bbox?: string;
}

export interface AircraftParams {
  sourceObjectId: string;
}

export interface AircraftLatestRow {
  sourceId: string;
  sourceObjectId: string;
  callsign: string | null;
  registration: string | null;
  aircraftType: string | null;
  dbFlags: number | null;
  isMilitary: boolean;
  isInteresting: boolean;
  isPia: boolean;
  isLadd: boolean;
  sourceMessageType: string | null;
  lat: number | null;
  lon: number | null;
  altitudeBaroFt: number | null;
  altitudeGeomFt: number | null;
  onGround: boolean | null;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  headingMagDeg: number | null;
  headingTrueDeg: number | null;
  verticalRateFpm: number | null;
  geomRateFpm: number | null;
  squawk: string | null;
  emergency: string | null;
  seenSeconds: number | null;
  seenPosSeconds: number | null;
  observedAt: Date | string;
  receivedAt: Date | string;
  staleAfter: Date | string | null;
  firstSeenAt: Date | string;
  lastSeenAt: Date | string;
  rawJson?: Record<string, unknown> | null;
}