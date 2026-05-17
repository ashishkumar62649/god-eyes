import React from 'react';
import Header from './Header';
import LayerPanel from './LayerPanel';
import DetailPanel from './DetailPanel';
import StatusPanel from './StatusPanel';
import '../styles/shell.css';
import { AirportObject, AirportDetailResponse } from '@god-eyes/contracts';
import { SearchResult } from '../lib/searchTypes';
import { AviationFilters } from '../lib/aviationCategories';

interface ShellProps {
  aviationLayerActive: boolean;
  setAviationLayerActive: (active: boolean) => void;
  selectedObject: AirportObject | null;
  airportDetail: AirportDetailResponse | null;
  detailLoading: boolean;
  detailError: string | null;
  aviationStats: { loaded: number; visible: number; clustersActive: boolean; renderMode: string };
  onSearchResultSelect: (result: SearchResult) => void;
  aviationFilters: AviationFilters;
  onFiltersChange: (filters: AviationFilters) => void;
  aviationRenderMode: 'density' | 'clusters';
  onRenderModeChange: (mode: 'density' | 'clusters') => void;
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
  aviationRenderMode,
  onRenderModeChange,
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
          aviationRenderMode={aviationRenderMode}
          onRenderModeChange={onRenderModeChange}
        />
        <DetailPanel
          selectedObject={selectedObject}
          airportDetail={airportDetail}
          detailLoading={detailLoading}
          detailError={detailError}
          isCollapsed={detailPanelCollapsed}
          setIsCollapsed={setDetailPanelCollapsed}
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
