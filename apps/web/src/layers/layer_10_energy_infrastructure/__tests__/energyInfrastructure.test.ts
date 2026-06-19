import { describe, expect, it } from 'vitest';
import { LOCAL_LAYER_REGISTRY } from '../../../lib/useLayerRegistry';
import {
  DEFAULT_ENERGY_FILTERS,
  ENERGY_FEATURE_TYPES,
  ENERGY_FUEL_TYPES,
} from '../infrastructure/energyInfrastructureTypes';
import { fetchEnergyInfrastructure } from '../infrastructure/energyInfrastructureApi';
import type { EnergyFeature } from '../infrastructure/energyInfrastructureTypes';

function mockFeature(overrides: Partial<EnergyFeature> = {}): EnergyFeature {
  return {
    id: 'energy-1',
    layerId: 'layer_10_energy_infrastructure',
    sourceId: 'wri',
    sourceObjectId: 'wri-1',
    featureType: 'power_plant',
    category: 'generation',
    geometryType: 'Point',
    name: 'Test Power Plant',
    operator: 'Test Op',
    owner: 'Test Owner',
    country: 'US',
    status: 'operating',
    fuelType: 'gas',
    capacityMw: 500,
    voltageKv: 0,
    pipelineProduct: '',
    pipelineLengthKm: 0,
    terminalType: '',
    geometry: { type: 'Point', coordinates: [-77.0364, 38.8951] },
    centroidLat: 38.8951,
    centroidLon: -77.0364,
    sourceConfidence: 'medium',
    sourceUpdatedAt: '2026-06-12T00:00:00Z',
    firstSeenAt: '2026-06-12T00:00:00Z',
    lastSeenAt: '2026-06-12T00:00:00Z',
    ...overrides,
  };
}

describe('Energy Infrastructure Layer (Layer 10) Tests', () => {
  describe('Layer Registration', () => {
    it('registers layer_10_energy_infrastructure as active, implemented, default ON', () => {
      const layer = LOCAL_LAYER_REGISTRY.find((l) => l.layerId === 'layer_10_energy_infrastructure');
      expect(layer).toBeDefined();
      expect(layer?.status).toBe('active');
      expect(layer?.isImplemented).toBe(true);
      expect(layer?.isEnabled).toBe(true);
      expect(layer?.category).toBe('Infrastructure');
      expect(layer?.dataStatus).toBe('static');
      expect(layer?.sourceRule).toContain('WRI');
    });
  });

  describe('Fuel type palette', () => {
    it('exposes every documented fuel type with a color and a label', () => {
      const expectedFuels = [
        'nuclear',
        'coal',
        'gas',
        'oil',
        'hydro',
        'solar',
        'wind',
        'biomass',
        'geothermal',
        'other',
      ];
      for (const fuel of expectedFuels) {
        expect(ENERGY_FUEL_TYPES[fuel]).toBeDefined();
        expect(ENERGY_FUEL_TYPES[fuel].color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(ENERGY_FUEL_TYPES[fuel].label).toBeTruthy();
      }
    });

    it('uses bright orange for nuclear and yellow for solar (spec colors)', () => {
      expect(ENERGY_FUEL_TYPES.nuclear.color).toBe('#ff8c00');
      expect(ENERGY_FUEL_TYPES.solar.color).toBe('#ffff00');
    });

    it('does not reuse black/white as a primary fuel color (per spec)', () => {
      for (const fuel of Object.keys(ENERGY_FUEL_TYPES)) {
        const color = ENERGY_FUEL_TYPES[fuel].color.toLowerCase();
        expect(color).not.toBe('#000000');
        expect(color).not.toBe('#ffffff');
      }
    });
  });

  describe('Feature type palette', () => {
    it('exposes every documented feature type with a color and a label', () => {
      const expectedFeatureTypes = [
        'power_plant',
        'substation',
        'transmission_line',
        'oil_pipeline',
        'gas_pipeline',
        'lng_terminal',
        'oil_terminal',
        'gas_terminal',
        'unknown',
      ];
      for (const ft of expectedFeatureTypes) {
        expect(ENERGY_FEATURE_TYPES[ft]).toBeDefined();
        expect(ENERGY_FEATURE_TYPES[ft].color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(ENERGY_FEATURE_TYPES[ft].label).toBeTruthy();
      }
    });

    it('uses purple for substation, light blue for transmission line (spec colors)', () => {
      expect(ENERGY_FEATURE_TYPES.substation.color).toBe('#800080');
      expect(ENERGY_FEATURE_TYPES.transmission_line.color).toBe('#87cefa');
    });
  });

  describe('Default filter state', () => {
    it('is a complete filter object with every documented filter null', () => {
      const expectedKeys = [
        'featureType',
        'category',
        'sourceId',
        'fuelType',
        'pipelineProduct',
        'country',
        'minCapacityMw',
        'maxCapacityMw',
        'minVoltageKv',
        'maxVoltageKv',
        'status',
      ];
      for (const key of expectedKeys) {
        expect(DEFAULT_ENERGY_FILTERS).toHaveProperty(key);
        expect(DEFAULT_ENERGY_FILTERS[key as keyof typeof DEFAULT_ENERGY_FILTERS]).toBeNull();
      }
    });

    it('does not contain extra undocumented keys', () => {
      const allowedKeys = new Set([
        'featureType',
        'category',
        'sourceId',
        'fuelType',
        'pipelineProduct',
        'country',
        'minCapacityMw',
        'maxCapacityMw',
        'minVoltageKv',
        'maxVoltageKv',
        'status',
      ]);
      for (const key of Object.keys(DEFAULT_ENERGY_FILTERS)) {
        expect(allowedKeys.has(key)).toBe(true);
      }
    });
  });

  describe('API placeholder (static-data layer)', () => {
    it('returns an empty FeatureCollection-like response', async () => {
      const res = await fetchEnergyInfrastructure();
      expect(res.features).toEqual([]);
      expect(res.metadata.layerId).toBe('layer_10_energy_infrastructure');
      expect(res.metadata.count).toBe(0);
      expect(res.metadata.staticData).toBe(true);
    });

    it('emits an ISO generatedAt timestamp', async () => {
      const res = await fetchEnergyInfrastructure();
      expect(typeof res.metadata.generatedAt).toBe('string');
      expect(() => new Date(res.metadata.generatedAt).toISOString()).not.toThrow();
    });
  });

  describe('EnergyFeature shape invariants', () => {
    it('mock feature carries the required field set used by the layer', () => {
      const f = mockFeature();
      expect(f.layerId).toBe('layer_10_energy_infrastructure');
      expect(f.geometryType).toBe('Point');
      expect(f.geometry.coordinates).toEqual([-77.0364, 38.8951]);
      expect(typeof f.capacityMw).toBe('number');
      expect(typeof f.voltageKv).toBe('number');
    });
  });
});
