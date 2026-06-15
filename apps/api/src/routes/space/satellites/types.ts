export interface SpaceListQuerystring {
  limit?: string; category?: string; objectType?: string; orbitClass?: string;
  sourceId?: string; importantOnly?: string; minAltitude?: string; maxAltitude?: string;
}

export interface SatelliteParams { satelliteId: string; }

export interface SatelliteRow {
  satelliteId: string;
  noradId: number | null;
  name: string;
  objectType: string;
  category: string;
  orbitClass: string;
  country: string | null;
  launchDate: string | null;
  latitude: number;
  longitude: number;
  altitudeKm: number | null;
  velocityKms: number | null;
  headingDeg: number | null;
  visualShape: string;
  visualColor: string;
  important: boolean;
  estimatedAt: string;
  sourceId: string;
  sourceObjectId: string;
  sourceAgeSeconds: number | null;
  operator?: string | null;
}
