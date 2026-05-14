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
}

const Shell: React.FC<ShellProps> = ({ 
  aviationLayerActive, 
  setAviationLayerActive, 
  selectedObject 
}) => {
  return (
    <div className="shell-container">
      <Header />
      
      <main className="shell-main">
        <LayerPanel 
          aviationLayerActive={aviationLayerActive}
          setAviationLayerActive={setAviationLayerActive}
        />
        <DetailPanel selectedObject={selectedObject} />
      </main>
      
      <StatusPanel aviationLayerActive={aviationLayerActive} />
    </div>
  );
};

export default Shell;
