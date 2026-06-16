import React from 'react';
import Header from './Header';
import LayerPanel from './LayerPanel';
import DetailPanel from './DetailPanel';
import StatusPanel from './StatusPanel';
import '../styles/shell.css';
import { AirportObject, AirportDetailResponse, MaritimeVesselObject, MaritimeVesselDetail, MaritimeStatsResponse } from '@god-eyes/contracts';
import { SearchResult } from '../lib/searchTypes';
import { AviationFilters } from '../layers/aviation/airports/aviationCategories';
import type { LayoutPhase } from '../layers/aviation/airports/useAirportLayoutFeatures';
import type { EarthEventsPhase } from '../layers/layer_03_earth_events/useEarthEvents';
import type { BordersPhase } from '../layers/layer_02_borders_boundaries/useBordersBoundaries';
import type { LiveAircraftStatus } from '../layers/aviation/aircraft/useLiveAircraftSocket';
import type { SpaceSatellitesStatus } from '../layers/layer_05_space_satellites/satellites/satelliteTypes';
import type { SatelliteFilters } from '../layers/layer_05_space_satellites/satellites/satelliteFilters';
import type { EnergyFilters } from '../layers/energy/infrastructure/energyInfrastructureTypes';
import type { EnergyFeature } from '../layers/energy/infrastructure/energyInfrastructureTypes';
import type { WeatherRenderItem } from '../layers/layer_07_weather/weatherTypes';
import type { NewsRenderMarker, NewsFilterState, NewsStatsResponse } from '../layers/layer_08_news_osint/newsTypes';
import type { NewsItem } from '@god-eyes/contracts';

interface AviationStats {
  loaded: number;
  visible: number;
  clustersActive: boolean;
  renderMode: string;
  fps: number;
}

interface ShellProps {
  aviationLayerActive: boolean;
  setAviationLayerActive: (active: boolean) => void;
  selectedObject: AirportObject | MaritimeVesselObject | null;
  airportDetail: AirportDetailResponse | null;
  detailLoading: boolean;
  detailError: string | null;
  aviationStats: AviationStats;
  onSearchResultSelect: (result: SearchResult) => void;
  aviationFilters: AviationFilters;
  onFiltersChange: (filters: AviationFilters) => void;
  layoutPhase: LayoutPhase;
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
  selectedEnergyFeature: EnergyFeature | null;
  onEnergyFeatureClose: () => void;
  maritimeLayerActive: boolean;
  setMaritimeLayerActive: (active: boolean) => void;
  maritimeStats: MaritimeStatsResponse | null;
  maritimeFilters: { search: string; vesselType: string | null };
  onMaritimeFiltersChange: (filters: { search: string; vesselType: string | null }) => void;
  onMaritimeRefresh: () => void;
  vesselDetail: MaritimeVesselDetail | null;
  weatherLayerActive: boolean;
  setWeatherLayerActive: (active: boolean) => void;
  weatherLoading: boolean;
  weatherError: string | null;
  weatherEmpty: boolean;
  weatherCount: number;
  weatherAttribution: string;
  onWeatherRefresh: () => void;
  selectedWeather: WeatherRenderItem | null;
  onWeatherClose: () => void;
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
  selectedNews: NewsRenderMarker | null;
  onNewsSelect: (item: NewsRenderMarker | null) => void;
  onNewsClose: () => void;
}

const Shell: React.FC<ShellProps> = ({
  aviationLayerActive, setAviationLayerActive,
  selectedObject, airportDetail, detailLoading, detailError,
  aviationStats, onSearchResultSelect, aviationFilters, onFiltersChange,
  layoutPhase,
  earthEventsLayerActive, setEarthEventsLayerActive, earthEventsPhase,
  bordersLayerActive, setBordersLayerActive, bordersPhase,
  liveAircraftLayerActive, setLiveAircraftLayerActive, liveAircraftPhase,
  spaceSatellitesLayerActive, setSpaceSatellitesLayerActive, spaceSatellitesStatus,
  spaceSatelliteFilters, onSpaceFiltersChange,
  energyInfrastructureLayerActive, setEnergyInfrastructureLayerActive, energyInfrastructureFilters, onEnergyFiltersChange,
  selectedEnergyFeature, onEnergyFeatureClose,
  maritimeLayerActive, setMaritimeLayerActive, maritimeStats, maritimeFilters, onMaritimeFiltersChange, onMaritimeRefresh, vesselDetail,
  weatherLayerActive, setWeatherLayerActive, weatherLoading, weatherError, weatherEmpty, weatherCount, weatherAttribution, onWeatherRefresh,
  selectedWeather, onWeatherClose,
  newsLayerActive, setNewsLayerActive, newsLoading, newsError, newsEmpty, newsMarkerCount, newsTotal,
  newsStats, newsFilters, newsItems, onNewsFiltersChange, onNewsRefresh, selectedNews, onNewsSelect, onNewsClose,
}) => {
  const [detailPanelCollapsed, setDetailPanelCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (selectedObject) setDetailPanelCollapsed(false);
  }, [selectedObject]);

  return (
    <div className="shell-container">
      <Header onSearchResultSelect={onSearchResultSelect} />
      <main className="shell-main">
        <LayerPanel
          aviationLayerActive={aviationLayerActive}
          setAviationLayerActive={setAviationLayerActive}
          aviationStats={aviationStats}
          aviationFilters={aviationFilters}
          onFiltersChange={onFiltersChange}
          earthEventsLayerActive={earthEventsLayerActive}
          setEarthEventsLayerActive={setEarthEventsLayerActive}
          earthEventsPhase={earthEventsPhase}
          bordersLayerActive={bordersLayerActive}
          setBordersLayerActive={setBordersLayerActive}
          bordersPhase={bordersPhase}
          liveAircraftLayerActive={liveAircraftLayerActive}
          setLiveAircraftLayerActive={setLiveAircraftLayerActive}
          liveAircraftPhase={liveAircraftPhase}
          spaceSatellitesLayerActive={spaceSatellitesLayerActive}
          setSpaceSatellitesLayerActive={setSpaceSatellitesLayerActive}
          spaceSatellitesStatus={spaceSatellitesStatus}
          spaceSatelliteFilters={spaceSatelliteFilters}
          onSpaceFiltersChange={onSpaceFiltersChange}
          energyInfrastructureLayerActive={energyInfrastructureLayerActive}
          setEnergyInfrastructureLayerActive={setEnergyInfrastructureLayerActive}
          energyInfrastructureFilters={energyInfrastructureFilters}
          onEnergyFiltersChange={onEnergyFiltersChange}
          maritimeLayerActive={maritimeLayerActive}
          setMaritimeLayerActive={setMaritimeLayerActive}
          maritimeStats={maritimeStats}
          maritimeFilters={maritimeFilters}
          onMaritimeFiltersChange={onMaritimeFiltersChange}
          onMaritimeRefresh={onMaritimeRefresh}
          weatherLayerActive={weatherLayerActive}
          setWeatherLayerActive={setWeatherLayerActive}
          weatherLoading={weatherLoading}
          weatherError={weatherError}
          weatherEmpty={weatherEmpty}
          weatherCount={weatherCount}
          weatherAttribution={weatherAttribution}
          onWeatherRefresh={onWeatherRefresh}
          newsLayerActive={newsLayerActive}
          setNewsLayerActive={setNewsLayerActive}
          newsLoading={newsLoading}
          newsError={newsError}
          newsEmpty={newsEmpty}
          newsMarkerCount={newsMarkerCount}
          newsTotal={newsTotal}
          newsStats={newsStats}
          newsFilters={newsFilters}
          newsItems={newsItems}
          onNewsFiltersChange={onNewsFiltersChange}
          onNewsRefresh={onNewsRefresh}
          onNewsSelect={onNewsSelect}
        />
        <DetailPanel
          selectedObject={selectedObject}
          airportDetail={airportDetail}
          detailLoading={detailLoading}
          detailError={detailError}
          isCollapsed={detailPanelCollapsed}
          setIsCollapsed={setDetailPanelCollapsed}
          layoutPhase={layoutPhase}
          selectedEnergyFeature={selectedEnergyFeature}
          onEnergyFeatureClose={onEnergyFeatureClose}
          vesselDetail={vesselDetail}
          selectedWeatherItem={selectedWeather}
          onWeatherClose={onWeatherClose}
          selectedNewsItem={selectedNews}
          onNewsClose={onNewsClose}
        />
      </main>
        <StatusPanel
          aviationLayerActive={aviationLayerActive}
          aviationStats={aviationStats}
          bordersLayerActive={bordersLayerActive}
          bordersPhase={bordersPhase}
          earthEventsLayerActive={earthEventsLayerActive}
          earthEventsPhase={earthEventsPhase}
          liveAircraftLayerActive={liveAircraftLayerActive}
          liveAircraftPhase={liveAircraftPhase}
          spaceSatellitesLayerActive={spaceSatellitesLayerActive}
          spaceSatellitesStatus={spaceSatellitesStatus}
        />
    </div>
  );
};

export default Shell;
