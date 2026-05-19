export type ResponseStatus = 'ok' | 'partial' | 'not_found' | 'no_data' | 'error';
export type ModuleStatus = 'ok' | 'missing' | 'partial' | 'no_data';

export interface MapPopupQuickStats {
  runwayCount: number | null;
  longestRunwayFt: number | null;
  passengers: number | null;
}

export interface MapPopup {
  airportName: string | null;
  iata: string | null;
  icao: string | null;
  city: string | null;
  country: string | null;
  imageUrl: string | null;
  shortSummary: string | null;
  badges: string[];
  openedDate: string | null;
  openedYear: number | null;
  quickStats: MapPopupQuickStats;
  confidenceLabel: string | null;
}

export interface Overview {
  status: ModuleStatus;
  summary: string | null;
  imageUrl: string | null;
  openedDate: string | null;
  openedYear: number | null;
  source: string | null;
}

export interface Capability {
  status: ModuleStatus;
  airportClass: string | null;
  runwayCapability: string | null;
  operatingRole: string | null;
  tags: string[];
}

export interface Infrastructure {
  status: ModuleStatus;
  runwayCount: number | null;
  longestRunwayFt: number | null;
  surfaces: string[];
  runwayCapability: string | null;
}

export interface CapacityData {
  annualPassengerCapacity: number | null;
  terminalCapacity: number | null;
  runwayMovementCapacityPerHour: number | null;
  terminalCount: number | null;
  gateCount: number | null;
  standCount: number | null;
  aircraftStandCount: number | null;
  checkInCounterCount: number | null;
  baggageBeltCount: number | null;
  capacityYear: number | null;
  capacityBasis: string | null;
  confidenceLabel: string | null;
  confidenceScore: number | null;
  capacityStatus: string | null;
  notes: string | null;
}

export interface Capacity {
  status: ModuleStatus;
  data: CapacityData | null;
}

export interface TrafficMetric {
  metricType: string;
  periodYear: number;
  metricValue: number;
  metricUnit: string;
  confidenceLabel: string | null;
  confidenceScore: number | null;
}

export interface Traffic {
  status: ModuleStatus;
  data: TrafficMetric[];
}

export interface SourceItem {
  sourceType: string;
  sourceName: string;
  sourceUrl: string | null;
  sourceEntityId: string | null;
  attributionText: string | null;
  isPrimary: boolean;
  confidenceLabel: string | null;
}

export interface Sources {
  status: ModuleStatus;
  items: SourceItem[];
}

export interface ModuleStatusEntry {
  moduleKey: string;
  moduleStatus: string;
  cacheState: string;
  confidenceLabel: string | null;
  confidenceScore: number | null;
}

export interface Advanced {
  moduleStatuses: ModuleStatusEntry[];
  cache: Record<string, unknown>;
  confidence: Record<string, unknown>;
}

export interface AirportIntelligenceResponse {
  status: ResponseStatus;
  airportId: string;
  generatedAt: string;
  mapPopup: MapPopup;
  overview: Overview;
  capability: Capability;
  infrastructure: Infrastructure;
  capacity: Capacity;
  traffic: Traffic;
  sources: Sources;
  advanced: Advanced;
}
