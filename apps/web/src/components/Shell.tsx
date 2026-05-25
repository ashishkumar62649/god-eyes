import React from 'react';
import Header from './Header';
import LayerPanel from './LayerPanel';
import DetailPanel from './DetailPanel';
import StatusPanel from './StatusPanel';
import '../styles/shell.css';
import { AirportObject, AirportDetailResponse } from '@god-eyes/contracts';
import { SearchResult } from '../lib/searchTypes';
import { AviationFilters } from '../lib/aviationCategories';
import type { LayoutPhase } from '../lib/useAirportLayoutFeatures';
import type { EarthEventsPhase } from '../lib/useEarthEvents';

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
  selectedObject: AirportObject | null;
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
}

const Shell: React.FC<ShellProps> = ({
  aviationLayerActive,
  setAviationLayerActive,
  selectedObject,
  airportDetail,
  detailLoading,
  detailError,
  aviationStats,
  onSearchResultSelect,
  aviationFilters,
  onFiltersChange,
  layoutPhase,
  earthEventsLayerActive,
  setEarthEventsLayerActive,
  earthEventsPhase,
}) => {
  const [detailPanelCollapsed, setDetailPanelCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (selectedObject) {
      setDetailPanelCollapsed(false);
    }
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
        />
        <DetailPanel
          selectedObject={selectedObject}
          airportDetail={airportDetail}
          detailLoading={detailLoading}
          detailError={detailError}
          isCollapsed={detailPanelCollapsed}
          setIsCollapsed={setDetailPanelCollapsed}
          layoutPhase={layoutPhase}
        />
      </main>

      <StatusPanel
        aviationLayerActive={aviationLayerActive}
        aviationStats={aviationStats}
      />
    </div>
  );
};

export default Shell;
