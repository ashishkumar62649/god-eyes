// Energy Infrastructure Layer Types

export interface EnergyFeature {
  id: string;
  layerId: string;
  sourceId: string;
  sourceObjectId: string;
  featureType: string;
  category: string;
  geometryType: string;
  name: string;
  operator: string;
  owner: string;
  country: string;
  status: string;
  fuelType: string;
  capacityMw: number;
  voltageKv: number;
  pipelineProduct: string;
  pipelineLengthKm: number;
  terminalType: string;
  geometry: {
    type: string;
    coordinates: [number, number] | [number, number][] | [number, number][][]; // Point, LineString, or Polygon
  };
  centroidLat: number;
  centroidLon: number;
  sourceConfidence: string;
  sourceUpdatedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface EnergyInfrastructureResponse {
  features: EnergyFeature[];
  metadata: {
    layerId: string;
    count: number;
    limit: number;
    offset: number;
    activeFilters: Record<string, unknown>;
    generatedAt: string;
    staticData: boolean;
  };
}

export interface EnergyInfrastructureDetailResponse extends EnergyFeature {
  metadata: {
    layerId: string;
    staticData: boolean;
    sourceUpdatedAt: string;
    firstSeenAt: string;
    lastSeenAt: string;
  };
}

export interface EnergyFilters {
  featureType: string | null;
  category: string | null;
  sourceId: string | null;
  fuelType: string | null;
  pipelineProduct: string | null;
  country: string | null;
  minCapacityMw: number | null;
  maxCapacityMw: number | null;
  minVoltageKv: number | null;
  maxVoltageKv: number | null;
  status: string | null;
}

export const DEFAULT_ENERGY_FILTERS: EnergyFilters = {
  featureType: null,
  category: null,
  sourceId: null,
  fuelType: null,
  pipelineProduct: null,
  country: null,
  minCapacityMw: null,
  maxCapacityMw: null,
  minVoltageKv: null,
  maxVoltageKv: null,
  status: null,
};

export const ENERGY_FUEL_TYPES: Record<string, { color: string; label: string }> = {
  nuclear: { color: '#ff8c00', label: 'Nuclear' }, // bright orange
  coal: { color: '#8b0000', label: 'Coal' }, // dark red
  gas: { color: '#ffa500', label: 'Gas' }, // orange-yellow
  oil: { color: '#8b4513', label: 'Oil' }, // brown
  hydro: { color: '#4169e1', label: 'Hydro' }, // blue
  solar: { color: '#ffff00', label: 'Solar' }, // yellow
  wind: { color: '#90ee90', label: 'Wind' }, // light green
  biomass: { color: '#556b2f', label: 'Biomass/Other' }, // olive/earth tone
  geothermal: { color: '#556b2f', label: 'Geothermal' }, // olive/earth tone
  other: { color: '#556b2f', label: 'Other' }, // olive/earth tone
};

export const ENERGY_FEATURE_TYPES: Record<string, { color: string; label: string }> = {
  power_plant: { color: '#90ee90', label: 'Power Plant' },
  substation: { color: '#800080', label: 'Substation' }, // purple
  transmission_line: { color: '#87cefa', label: 'Transmission Line' }, // light blue
  oil_pipeline: { color: '#ff0000', label: 'Oil Pipeline' }, // red
  gas_pipeline: { color: '#ffa500', label: 'Gas Pipeline' }, // orange
  lng_terminal: { color: '#ffc0cb', label: 'LNG Terminal' }, // pink
  oil_terminal: { color: '#ff0000', label: 'Oil Terminal' }, // red
  gas_terminal: { color: '#ffa500', label: 'Gas Terminal' }, // orange
  unknown: { color: '#808080', label: 'Unknown' }, // gray
};