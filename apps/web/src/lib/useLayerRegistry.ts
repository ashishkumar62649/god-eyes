import { useState, useEffect } from 'react';
import type { LayerRegistryEntry } from '@god-eyes/contracts';
import { fetchLayerRegistry } from './api';

// Local fallback — mirrors MVP_LAYER_REGISTRY.md exactly.
// Used when API is offline so the UI always renders all 10 layers.
export const LOCAL_LAYER_REGISTRY: LayerRegistryEntry[] = [
  {
    layerId: 'layer_00_globe_core',
    name: 'Globe Core',
    category: 'core',
    status: 'active',
    dataStatus: 'static',
    description: '3D globe, camera, base map, layer registry, selection system',
    sourceRule: 'No external sources',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'No data. No secrets.',
    isEnabled: true,
    isImplemented: true,
  },
  {
    layerId: 'layer_01_aviation',
    name: 'Aviation',
    category: 'transport',
    status: 'active',
    dataStatus: 'live',
    description: 'Aircraft positions, airports, flight routes, details panel',
    sourceRule: 'OurAirports, ADS-B Exchange',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'Public civil aviation only',
    isEnabled: true,
    isImplemented: true,
  },
  {
    layerId: 'layer_02_borders_boundaries',
    name: 'Borders & Boundaries',
    category: 'geo',
    status: 'coming_soon',
    dataStatus: 'static',
    description: 'Country borders, disputed territories',
    sourceRule: 'Natural Earth, OpenStreetMap',
    apiStatus: 'not_implemented',
    frontendStatus: 'coming_soon',
    safetyNotes: 'Disputed territories must be labeled as disputed',
    isEnabled: false,
    isImplemented: false,
  },
  {
    layerId: 'layer_03_earth_events',
    name: 'Earth Events',
    category: 'environment',
    status: 'active',
    dataStatus: 'live',
    description: 'Earthquakes, natural disasters, weather alerts',
    sourceRule: 'USGS, NASA EONET, GDACS',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'Authoritative public sources only',
    isEnabled: true,
    isImplemented: true,
  },
  {
    layerId: 'layer_04_public_military_security',
    name: 'Public Military & Security',
    category: 'security',
    status: 'coming_soon',
    dataStatus: 'static',
    description: 'Publicly known military installations (static only)',
    sourceRule: 'Public-domain sources only',
    apiStatus: 'not_implemented',
    frontendStatus: 'coming_soon',
    safetyNotes: 'Static-only permanently. No real-time tracking.',
    isEnabled: false,
    isImplemented: false,
  },
  {
    layerId: 'layer_05_space_satellites',
    name: 'Space & Satellites',
    category: 'space',
    status: 'coming_soon',
    dataStatus: 'live',
    description: 'Satellite positions, orbital paths',
    sourceRule: 'CelesTrak TLE, Space-Track.org',
    apiStatus: 'not_implemented',
    frontendStatus: 'coming_soon',
    safetyNotes: 'Public catalog satellites only',
    isEnabled: false,
    isImplemented: false,
  },
  {
    layerId: 'layer_06_maritime',
    name: 'Maritime',
    category: 'transport',
    status: 'coming_soon',
    dataStatus: 'live',
    description: 'Vessel positions, ports',
    sourceRule: 'AIS via MarineTraffic, AISHub',
    apiStatus: 'not_implemented',
    frontendStatus: 'coming_soon',
    safetyNotes: 'Public AIS only',
    isEnabled: false,
    isImplemented: false,
  },
  {
    layerId: 'layer_07_infrastructure',
    name: 'Infrastructure',
    category: 'infrastructure',
    status: 'no_data',
    dataStatus: 'static',
    description: 'Power, telecom, transport, water infrastructure',
    sourceRule: 'OpenStreetMap, government open-data',
    apiStatus: 'not_implemented',
    frontendStatus: 'no_data',
    safetyNotes: 'Do not expose precise critical infrastructure locations',
    isEnabled: false,
    isImplemented: false,
  },
  {
    layerId: 'layer_08_news_osint',
    name: 'News & OSINT',
    category: 'intelligence',
    status: 'no_data',
    dataStatus: 'live',
    description: 'Geolocated news events, conflict data',
    sourceRule: 'GDELT, NewsAPI, ACLED',
    apiStatus: 'not_implemented',
    frontendStatus: 'no_data',
    safetyNotes: 'No PII. Source attribution required.',
    isEnabled: false,
    isImplemented: false,
  },
  {
    layerId: 'layer_09_user_shapes',
    name: 'User Shapes',
    category: 'user',
    status: 'no_data',
    dataStatus: 'static',
    description: 'User-drawn polygons, lines, points',
    sourceRule: 'User-generated only',
    apiStatus: 'not_implemented',
    frontendStatus: 'no_data',
    safetyNotes: 'User-private by default',
    isEnabled: false,
    isImplemented: false,
  },
];

interface UseLayerRegistryResult {
  layers: LayerRegistryEntry[];
  apiAvailable: boolean;
  loading: boolean;
}

export function useLayerRegistry(): UseLayerRegistryResult {
  const [layers, setLayers] = useState<LayerRegistryEntry[]>(LOCAL_LAYER_REGISTRY);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchLayerRegistry()
      .then((res) => {
        if (cancelled) return;
        if (res.layers && res.layers.length > 0) {
          setLayers(res.layers);
          setApiAvailable(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setApiAvailable(false);
        // Keep LOCAL_LAYER_REGISTRY already set as default
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { layers, apiAvailable, loading };
}
