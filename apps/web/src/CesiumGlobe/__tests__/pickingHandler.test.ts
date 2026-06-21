import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { MutableRefObject } from 'react';

import { createPickClickHandler } from '../picking';
import { PICKING_FIELDS } from '../pickingFields';
import type { CreatePickClickHandlerParams } from '../picking';

// Mock cesiumVisibility visibility checks to always return true
vi.mock('../../globe/cesiumVisibility', () => ({
  isPositionVisible: vi.fn(() => true),
}));

// Mock aviation global renderer check
vi.mock('../../layers/layer_01_aviation/airports/aviationGlobalRenderer', () => ({
  isGlobalDot: vi.fn(() => false),
  getGlobalDotPosition: vi.fn(),
}));

// Mock aviation objects cache
vi.mock('../../layers/layer_01_aviation/airports/aviationObjectStore', () => ({
  getAllObjects: vi.fn(() => []),
}));

describe('createPickClickHandler unit tests', () => {
  let mockViewer: any;
  let params: CreatePickClickHandlerParams;
  let onObjectSelectSpy: any;
  let setSelectedAircraftSpy: any;
  let setSelectedEarthquakeSpy: any;
  let setSelectedSatelliteSpy: any;
  let onWeatherSelectSpy: any;
  let onNewsSelectSpy: any;
  let onEnergyFeatureSelectSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    onObjectSelectSpy = vi.fn();
    setSelectedAircraftSpy = vi.fn();
    setSelectedEarthquakeSpy = vi.fn();
    setSelectedSatelliteSpy = vi.fn();
    onWeatherSelectSpy = vi.fn();
    onNewsSelectSpy = vi.fn();
    onEnergyFeatureSelectSpy = vi.fn();

    mockViewer = {
      scene: {
        pick: vi.fn(),
      },
      clock: {
        currentTime: {},
      },
      camera: {
        positionCartographic: {
          height: 10000,
        },
        flyTo: vi.fn(),
      },
    };

    params = {
      viewer: mockViewer as any,
      onObjectSelectRef: { current: onObjectSelectSpy } as MutableRefObject<any>,
      setSelectedAircraft: setSelectedAircraftSpy,
      setSelectedEarthquake: setSelectedEarthquakeSpy,
      setSelectedSatellite: setSelectedSatelliteSpy,
      onWeatherSelectRef: { current: onWeatherSelectSpy } as MutableRefObject<any>,
      onNewsSelectRef: { current: onNewsSelectSpy } as MutableRefObject<any>,
      onEnergyFeatureSelectRef: { current: onEnergyFeatureSelectSpy } as MutableRefObject<any>,
    };
  });

  it('handles satellite dot picking when data is directly on pickedObject.id', () => {
    const satelliteData = { satelliteId: 'sat-1', name: 'Sat 1', altitudeKm: 500, longitude: 10, latitude: 20 };
    mockViewer.scene.pick.mockReturnValue({
      id: {
        [PICKING_FIELDS.satelliteData]: satelliteData,
      },
    });

    const handler = createPickClickHandler(params);
    handler({ position: { x: 100, y: 100 } as any });

    expect(setSelectedSatelliteSpy).toHaveBeenCalledWith(satelliteData);
    expect(onObjectSelectSpy).toHaveBeenCalledWith(null);
    expect(setSelectedAircraftSpy).toHaveBeenCalledWith(null);
    expect(setSelectedEarthquakeSpy).toHaveBeenCalledWith(null);
  });

  it('handles satellite dot picking when data is on pickedObject.primitive.id', () => {
    const satelliteData = { satelliteId: 'sat-2', name: 'Sat 2', altitudeKm: 600, longitude: 15, latitude: 25 };
    mockViewer.scene.pick.mockReturnValue({
      primitive: {
        id: {
          [PICKING_FIELDS.satelliteData]: satelliteData,
        },
      },
    });

    const handler = createPickClickHandler(params);
    handler({ position: { x: 100, y: 100 } as any });

    expect(setSelectedSatelliteSpy).toHaveBeenCalledWith(satelliteData);
    expect(onObjectSelectSpy).toHaveBeenCalledWith(null);
    expect(setSelectedAircraftSpy).toHaveBeenCalledWith(null);
    expect(setSelectedEarthquakeSpy).toHaveBeenCalledWith(null);
  });

  it('clears all selected overlays when clicking on empty space', () => {
    mockViewer.scene.pick.mockReturnValue(null);

    const handler = createPickClickHandler(params);
    handler({ position: { x: 100, y: 100 } as any });

    expect(onObjectSelectSpy).toHaveBeenCalledWith(null);
    expect(setSelectedAircraftSpy).toHaveBeenCalledWith(null);
    expect(setSelectedEarthquakeSpy).toHaveBeenCalledWith(null);
    expect(setSelectedSatelliteSpy).toHaveBeenCalledWith(null);
    expect(onWeatherSelectSpy).toHaveBeenCalledWith(null);
    expect(onNewsSelectSpy).toHaveBeenCalledWith(null);
    expect(onEnergyFeatureSelectSpy).toHaveBeenCalledWith(null);
  });

  it('clears all selected overlays when picked object has no picking id', () => {
    mockViewer.scene.pick.mockReturnValue({
      someOtherField: {},
    });

    const handler = createPickClickHandler(params);
    handler({ position: { x: 100, y: 100 } as any });

    expect(onObjectSelectSpy).toHaveBeenCalledWith(null);
    expect(setSelectedAircraftSpy).toHaveBeenCalledWith(null);
    expect(setSelectedEarthquakeSpy).toHaveBeenCalledWith(null);
    expect(setSelectedSatelliteSpy).toHaveBeenCalledWith(null);
    expect(onWeatherSelectSpy).toHaveBeenCalledWith(null);
    expect(onNewsSelectSpy).toHaveBeenCalledWith(null);
    expect(onEnergyFeatureSelectSpy).toHaveBeenCalledWith(null);
  });

  it('handles live aircraft picking and clears other overlays', () => {
    const aircraftData = { sourceObjectId: 'ac-1', callsign: 'AC1', lon: 12, lat: 34 };
    mockViewer.scene.pick.mockReturnValue({
      id: {
        [PICKING_FIELDS.aircraftData]: aircraftData,
      },
    });

    const handler = createPickClickHandler(params);
    handler({ position: { x: 100, y: 100 } as any });

    expect(setSelectedAircraftSpy).toHaveBeenCalledWith(aircraftData);
    expect(onObjectSelectSpy).toHaveBeenCalledWith(null);
    expect(setSelectedEarthquakeSpy).toHaveBeenCalledWith(null);
    expect(setSelectedSatelliteSpy).toHaveBeenCalledWith(null);
  });
});
