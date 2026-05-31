import React from 'react';
import Header from './Header';
import LayerPanel from './LayerPanel';
import DetailPanel from './DetailPanel';
import StatusPanel from './StatusPanel';
import '../styles/shell.css';
import { AirportObject, AirportDetailResponse } from '@god-eyes/contracts';
import { SearchResult } from '../lib/searchTypes';
import { AviationFilters } from '../layers/aviation/airports/aviationCategories';
import type { LayoutPhase } from '../layers/aviation/airports/useAirportLayoutFeatures';
import type { EarthEventsPhase } from '../layers/earth-events/useEarthEvents';
import type { BordersPhase } from '../layers/borders/useBordersBoundaries';
import type { LiveAircraftStatus } from '../layers/aviation/aircraft/useLiveAircraftSocket';

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
  bordersLayerActive: boolean;
  setBordersLayerActive: (active: boolean) => void;
  bordersPhase: BordersPhase;
  liveAircraftLayerActive: boolean;
  setLiveAircraftLayerActive: (active: boolean) => void;
  liveAircraftPhase: LiveAircraftStatus;
}

const Shell: React.FC<ShellProps> = ({
  aviationLayerActive, setAviationLayerActive,
  selectedObject, airportDetail, detailLoading, detailError,
  aviationStats, onSearchResultSelect, aviationFilters, onFiltersChange,
  layoutPhase,
  earthEventsLayerActive, setEarthEventsLayerActive, earthEventsPhase,
  bordersLayerActive, setBordersLayerActive, bordersPhase,
  liveAircraftLayerActive, setLiveAircraftLayerActive, liveAircraftPhase,
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
        bordersLayerActive={bordersLayerActive}
        bordersPhase={bordersPhase}
        earthEventsLayerActive={earthEventsLayerActive}
        earthEventsPhase={earthEventsPhase}
        liveAircraftLayerActive={liveAircraftLayerActive}
        liveAircraftPhase={liveAircraftPhase}
      />
    </div>
  );
};

export default Shell;
