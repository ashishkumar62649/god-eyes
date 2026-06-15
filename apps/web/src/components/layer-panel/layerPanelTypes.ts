// Route-local types for the LayerPanel and its sub-components.
import type { MaritimeStatsResponse } from '@god-eyes/contracts';
import type { AviationFilters } from '../../layers/aviation/airports/aviationCategories';
import type { EarthEventsPhase } from '../../layers/earth-events/useEarthEvents';
import type { BordersPhase } from '../../layers/borders/useBordersBoundaries';
import type { LiveAircraftStatus } from '../../layers/aviation/aircraft/useLiveAircraftSocket';
import type { SpaceSatellitesStatus } from '../../layers/space/satellites/satelliteTypes';
import type { SatelliteFilters } from '../../layers/space/satellites/satelliteFilters';
import type { EnergyFilters } from '../../layers/energy/infrastructure/energyInfrastructureTypes';
import type { NewsFilterState, NewsStatsResponse, NewsRenderMarker } from '../../layers/layer_08_news_osint/newsTypes';
import type { NewsItem } from '@god-eyes/contracts';

export interface AviationStats {
  loaded: number;
  visible: number;
  clustersActive: boolean;
  renderMode: string;
  fps: number;
  preloadStatus?: string;
}

export interface LayerPanelProps {
  aviationLayerActive: boolean;
  setAviationLayerActive: (active: boolean) => void;
  aviationStats: AviationStats;
  aviationFilters: AviationFilters;
  onFiltersChange: (filters: AviationFilters) => void;
  earthEventsLayerActive: boolean;
  setEarthEventsLayerActive: (active: boolean) => void;
  earthEventsPhase: EarthEventsPhase;
  bordersLayerActive: boolean;
  setBordersLayerActive: (active: boolean) => void;
  bordersPhase: BordersPhase;
  liveAircraftLayerActive: boolean;
  setLiveAircraftLayerActive: (active: boolean) => void;
  liveAircraftPhase: LiveAircraftStatus;
  spaceSatellitesLayerActive: boolean;
  setSpaceSatellitesLayerActive: (active: boolean) => void;
  spaceSatellitesStatus: SpaceSatellitesStatus;
  spaceSatelliteFilters: SatelliteFilters;
  onSpaceFiltersChange: (filters: SatelliteFilters) => void;
  energyInfrastructureLayerActive: boolean;
  setEnergyInfrastructureLayerActive: (active: boolean) => void;
  energyInfrastructureFilters: EnergyFilters;
  onEnergyFiltersChange: (filters: EnergyFilters) => void;
  maritimeLayerActive: boolean;
  setMaritimeLayerActive: (active: boolean) => void;
  maritimeStats: MaritimeStatsResponse | null;
  maritimeFilters: { search: string; vesselType: string | null };
  onMaritimeFiltersChange: (filters: { search: string; vesselType: string | null }) => void;
  onMaritimeRefresh: () => void;
  weatherLayerActive: boolean;
  setWeatherLayerActive: (active: boolean) => void;
  weatherLoading: boolean;
  weatherError: string | null;
  weatherEmpty: boolean;
  weatherCount: number;
  weatherAttribution: string;
  onWeatherRefresh: () => void;
  newsLayerActive: boolean;
  setNewsLayerActive: (active: boolean) => void;
  newsLoading: boolean;
  newsError: string | null;
  newsEmpty: boolean;
  newsMarkerCount: number;
  newsTotal: number;
  newsStats: NewsStatsResponse | null;
  newsFilters: NewsFilterState;
  newsItems: NewsItem[];
  onNewsFiltersChange: (f: NewsFilterState) => void;
  onNewsRefresh: () => void;
  onNewsSelect: (item: NewsRenderMarker | null) => void;
}
