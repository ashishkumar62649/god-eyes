// Route-local types for the DetailPanel and its sub-components.
import type { AirportObject, AirportDetailResponse, MaritimeVesselObject, MaritimeVesselDetail } from '@god-eyes/contracts';
import type { LayoutPhase } from '../../layers/aviation/airports/useAirportLayoutFeatures';
import type { EnergyFeature } from '../../layers/energy/infrastructure/energyInfrastructureTypes';
import type { WeatherRenderItem } from '../../layers/layer_07_weather/weatherTypes';
import type { NewsRenderMarker } from '../../layers/layer_08_news_osint/newsTypes';

export interface DetailPanelProps {
  selectedObject: AirportObject | MaritimeVesselObject | null;
  airportDetail: AirportDetailResponse | null;
  detailLoading: boolean;
  detailError: string | null;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  layoutPhase: LayoutPhase;
  selectedEnergyFeature: EnergyFeature | null;
  onEnergyFeatureClose: () => void;
  vesselDetail: MaritimeVesselDetail | null;
  selectedWeatherItem: WeatherRenderItem | null;
  onWeatherClose: () => void;
  selectedNewsItem: NewsRenderMarker | null;
  onNewsClose: () => void;
}
