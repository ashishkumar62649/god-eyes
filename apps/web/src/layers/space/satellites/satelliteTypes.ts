// satelliteTypes.ts — WO-082E
// Frontend satellite item type mirroring SpaceSatelliteItem from @god-eyes/contracts.
// Using local type to keep rendering code self-contained.

export type SatelliteObjectType = 'satellite' | 'debris' | 'rocket_body' | 'inactive_payload' | 'unknown';
export type SatelliteVisualShape = 'dot' | 'triangle';

export interface SatelliteFrontendItem {
  satelliteId: string;
  noradId: number | null;
  name: string;
  objectType: SatelliteObjectType;
  category: string;
  orbitClass: string;
  country: string | null;
  launchDate: string | null;
  latitude: number;
  longitude: number;
  altitudeKm: number | null;
  velocityKms: number | null;
  headingDeg: number | null;
  visualShape: SatelliteVisualShape;
  visualColor: string;
  important: boolean;
  estimatedAt: string;
  sourceId: string;
  sourceObjectId: string;
  sourceAgeSeconds: number | null;
}

export interface SpaceSatellitesStatus {
  phase: 'idle' | 'connecting' | 'live' | 'reconnecting' | 'error';
  count: number;
  lastSuccessAt: number;
  errorMessage: string;
}

export const INITIAL_SPACE_STATUS: SpaceSatellitesStatus = {
  phase: 'idle',
  count: 0,
  lastSuccessAt: 0,
  errorMessage: '',
};
