// Local frontend types for GET /api/airports/:airportId/intelligence
// Do not import from @god-eyes/contracts until contracts package is updated.

export interface AirportIntelMapPopup {
  airportName: string;
  iataCode: string | null;
  icaoCode: string | null;
  city: string | null;
  country: string | null;
  shortSummary: string | null;
  imageUrl: string | null;
  badges: string[];
  openedYear: number | null;
  openedDate: string | null;
  runwayCount: number | null;
  longestRunwayFt: number | null;
  confidenceLabel: string | null;
}

export interface AirportIntelOverview {
  summary: string | null;
  tags: string[];
}

export interface AirportIntelCapability {
  tags: string[];
  jetCapable: boolean | null;
  largeAircraftCapable: boolean | null;
  scheduledService: boolean | null;
  international: boolean | null;
}

export interface AirportIntelInfrastructure {
  runwayCount: number | null;
  longestRunwayFt: number | null;
  runwayCapabilityLabel: string | null;
}

export interface AirportIntelCapacity {
  annualPassengers: number | null;
  dataSource: string | null;
}

export interface AirportIntelTraffic {
  annualMovements: number | null;
  dataSource: string | null;
}

export interface AirportIntelSource {
  sourceId: string;
  label: string;
  confidence: string | null;
}

export interface AirportIntelligenceResponse {
  status: 'ok' | 'partial' | 'no_data' | 'error';
  airportId: string;
  mapPopup: AirportIntelMapPopup | null;
  overview: AirportIntelOverview | null;
  capability: AirportIntelCapability | null;
  infrastructure: AirportIntelInfrastructure | null;
  capacity: AirportIntelCapacity | null;
  traffic: AirportIntelTraffic | null;
  sources: AirportIntelSource[];
  advanced: Record<string, unknown> | null;
}
