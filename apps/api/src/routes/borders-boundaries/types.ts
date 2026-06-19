// Route-local TypeScript types for the borders-boundaries route.

export interface BordersBoundariesQuerystring {
  limit?: string;
  bbox?: string;
  source_id?: string;
  simplify?: string;
}

export interface SourceRow {
  sourceId: string;
  sourceName: string | null;
}

export interface BorderBoundaryRow {
  id: string;
  layerId: string;
  sourceId: string;
  sourceObjectId: string | null;
  boundaryType: string;
  boundaryLevel: string | null;
  adminLevel: number | null;
  countryIso2: string | null;
  countryIso3: string | null;
  name: string;
  displayName: string | null;
  disputed: boolean;
  indiaSensitive: boolean;
  indiaComplianceStatus: string;
  geometry: Record<string, unknown>;
}

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}
