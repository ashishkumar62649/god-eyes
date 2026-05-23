// Local frontend types for GET /api/airports/:airportId/layout-features
// Do not import from @god-eyes/contracts until contracts package is updated.

export interface LayoutFeatureGeometry {
  type: 'LineString' | 'Point' | 'Polygon';
  coordinates: number[][] | number[] | number[][][];
}

export interface AirportLayoutFeature {
  id: string;
  featureType: 'runway' | 'taxiway' | 'apron' | 'terminal' | string;
  featureSubtype: string | null;
  featureName: string | null;
  sourceType: string;
  geometryType: 'line' | 'point' | 'polygon';
  geometry: LayoutFeatureGeometry;
  centroid: number[] | null;
  bbox: number[] | null;
  confidenceLabel: string | null;
  confidenceScore: number | null;
  rank: number | null;
  isPrimary: boolean;
  fetchedAt: string | null;
  lastCheckedAt: string | null;
  expiresAt: string | null;
}

export interface AirportLayoutSummary {
  totalFeatures: number;
  byType: Record<string, number>;
  sourceTypes: string[];
  hasRunways: boolean;
  hasTaxiways: boolean;
  hasAprons: boolean;
  hasTerminals: boolean;
}

export interface AirportLayoutFeaturesResponse {
  status: 'ok' | 'no_data' | 'not_found' | 'error';
  airportId: string;
  generatedAt: string | null;
  features: AirportLayoutFeature[];
  summary: AirportLayoutSummary | null;
}
