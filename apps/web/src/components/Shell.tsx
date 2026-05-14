import React from 'react';
import Header from './Header';
import LayerPanel from './LayerPanel';
import DetailPanel from './DetailPanel';
import StatusPanel from './StatusPanel';
import '../styles/shell.css';
import { AirportObject } from '@god-eyes/contracts';

interface ShellProps {
  aviationLayerActive: boolean;
  setAviationLayerActive: (active: boolean) => void;
  selectedObject: AirportObject | null;
  aviationStats: { loaded: number; visible: number; clustersActive: boolean };
}

const Shell: React.FC<ShellProps> = ({ 
  aviationLayerActive, 
  setAviationLayerActive, 
  selectedObject,
  aviationStats
}) => {
  const [detailPanelCollapsed, setDetailPanelCollapsed] = React.useState(false);

  // Auto-open detail panel when a new object is selected
  React.useEffect(() => {
    if (selectedObject) {
      setDetailPanelCollapsed(false);
    }
  }, [selectedObject]);

  return (
    <div className="shell-container">
      <Header />
      
      <main className="shell-main">
        <LayerPanel 
          aviationLayerActive={aviationLayerActive}
          setAviationLayerActive={setAviationLayerActive}
          aviationStats={aviationStats}
        />
        <DetailPanel 
          selectedObject={selectedObject} 
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
