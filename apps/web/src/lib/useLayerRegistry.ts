import { useState, useEffect } from 'react';
import type { LayerRegistryEntry } from '@god-eyes/contracts';
import { fetchLayerRegistry } from './api';

// Local fallback — mirrors MVP_LAYER_REGISTRY.md exactly.
// Used when API is offline so the UI always renders all 11 layers (00-10).
// WO-1-4: `category` values now match the canonical CapitalCase values
// used by the API registry in apps/api/src/routes/layers.ts (Foundation,
// Transportation, Geography, Natural Phenomena, Security, Space,
// Intelligence, User Content, Infrastructure). `apiStatus` values are
// aligned to the same vocabulary the API uses (ready / active /
// coming_soon). Layer IDs, slugs, names, and other fields are unchanged.
export const LOCAL_LAYER_REGISTRY: LayerRegistryEntry[] = [
  {
    layerId: 'layer_00_globe_core',
    name: 'Globe Core',
    category: 'Foundation',
    status: 'active',
    dataStatus: 'static',
    description: '3D globe, camera, base map, layer registry, selection system',
    sourceRule: 'No external sources',
    apiStatus: 'ready',
    frontendStatus: 'active',
    safetyNotes: 'No data. No secrets.',
    isEnabled: true,
    isImplemented: true,
  },
  {
    layerId: 'layer_01_aviation',
    name: 'Aviation',
    category: 'Transportation',
    status: 'active',
    dataStatus: 'live',
    description: 'Aircraft positions, airports, flight routes, details panel',
    sourceRule: 'OurAirports, ADS-B Exchange',
    apiStatus: 'ready',
    frontendStatus: 'active',
    safetyNotes: 'Public civil aviation only',
    isEnabled: true,
    isImplemented: true,
  },
  {
    layerId: 'layer_02_borders_boundaries',
    name: 'Borders & Boundaries',
    category: 'Geography',
    status: 'active',
    dataStatus: 'static',
    description: 'Country borders, disputed territories',
    sourceRule: 'Natural Earth, OpenStreetMap',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'Disputed territories must be labeled as disputed',
    isEnabled: true,
    isImplemented: true,
  },
  {
    layerId: 'layer_03_earth_events',
    name: 'Earth Events',
    category: 'Natural Phenomena',
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
    category: 'Security',
    status: 'coming_soon',
    dataStatus: 'static',
    description: 'Publicly known military installations (static only)',
    sourceRule: 'Public-domain sources only',
    apiStatus: 'coming_soon',
    frontendStatus: 'coming_soon',
    safetyNotes: 'Static-only permanently. No real-time tracking.',
    isEnabled: false,
    isImplemented: false,
  },
  {
    layerId: 'layer_05_space_satellites',
    name: 'Space & Satellites',
    category: 'Space',
    status: 'active',
    dataStatus: 'live',
    description: 'Satellite positions, orbital paths',
    sourceRule: 'CelesTrak TLE, Space-Track.org',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'Public catalog satellites only',
    isEnabled: false,
    isImplemented: true,
  },
  {
    layerId: 'layer_06_maritime',
    name: 'Maritime / Live Ships',
    category: 'Transportation',
    status: 'active',
    dataStatus: 'live',
    description: 'Vessel positions, ports',
    sourceRule: 'AISStream',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'Public AIS only',
    isEnabled: false,
    isImplemented: true,
  },
  {
    layerId: 'layer_07_weather',
    name: 'Weather / Live Weather',
    category: 'Natural Phenomena',
    status: 'active',
    dataStatus: 'live',
    description: 'Live weather observations from Open-Meteo through the GOD EYES API.',
    sourceRule: 'Open-Meteo',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'Model/grid-based weather (not street-level exact). Open-Meteo CC-BY 4.0 attribution required.',
    isEnabled: false,
    isImplemented: true,
  },
  {
    layerId: 'layer_08_news_osint',
    name: 'News & OSINT',
    category: 'Intelligence',
    status: 'active',
    dataStatus: 'live',
    description: 'Geolocated disaster/news events from GDACS and GDELT. Globe markers for Point records; list for all records.',
    sourceRule: 'GDACS and GDELT Event Export',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'No PII. Source attribution required. No real-time tracking.',
    isEnabled: false,
    isImplemented: true,
  },
  {
    layerId: 'layer_09_user_shapes',
    name: 'User Shapes',
    category: 'User Content',
    status: 'coming_soon',
    dataStatus: 'static',
    description: 'User-drawn polygons, lines, points',
    sourceRule: 'User-generated only',
    apiStatus: 'coming_soon',
    frontendStatus: 'coming_soon',
    safetyNotes: 'User-private by default',
    isEnabled: false,
    isImplemented: false,
  },
  {
    layerId: 'layer_10_energy_infrastructure',
    name: 'Energy Infrastructure',
    category: 'Infrastructure',
    status: 'active',
    dataStatus: 'static',
    description: 'Power plants, transmission lines, pipelines, terminals',
    sourceRule: 'WRI, OpenStreetMap, Global Energy Monitor',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'Static public-source data only. Not live operational status.',
    isEnabled: true,
    isImplemented: true,
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
          // Merge API layers with local registry so frontend-only layers
          // (e.g. layer_07_weather) are never dropped when the API
          // does not yet include them.
          const apiMap = new Map(res.layers.map((l) => [l.layerId, l]));
          const merged = LOCAL_LAYER_REGISTRY.map((local) => {
            const apiEntry = apiMap.get(local.layerId);
            return apiEntry ?? local;
          });
          // Append any API-only layers not present in local (future-proofing)
          for (const apiEntry of res.layers) {
            if (!merged.some((m) => m.layerId === apiEntry.layerId)) {
              merged.push(apiEntry);
            }
          }
          setLayers(merged);
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
