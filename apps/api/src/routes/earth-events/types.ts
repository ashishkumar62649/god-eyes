export interface EarthEventsLatestQuerystring {
  limit?: string;
  bbox?: string;
  event_type?: string;
  since?: string;
}

export interface EarthEventRow {
  id: string;
  layerId: string;
  sourceId: string;
  sourceObjectId: string;
  eventType: string;
  magnitude: string | null;
  magnitudeType: string | null;
  depthKm: string | null;
  place: string | null;
  alertLevel: string | null;
  significance: string | null;
  tsunami: boolean;
  geometry: { type: 'Point'; coordinates: [number, number] };
  sourceUrl: string | null;
  observedAt: string | Date;
  updatedAt: string | Date;
  fetchedAt: string | Date;
}

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}