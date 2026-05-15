import React, { useState, useEffect, useCallback } from 'react';
import CesiumGlobe from './CesiumGlobe';
import Shell from './components/Shell';
import { AirportObject } from '@god-eyes/contracts';
import { SearchResult } from './lib/searchTypes';

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [aviationLayerActive, setAviationLayerActive] = useState(false);
  const [selectedObject, setSelectedObject] = useState<AirportObject | null>(null);
  const [aviationStats, setAviationStats] = useState({ loaded: 0, visible: 0, clustersActive: false });
  const [cameraTarget, setCameraTarget] = useState<{ 
    position: { latitude: number; longitude: number }; 
    type: string; 
    timestamp: number 
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleObjectSelect = useCallback((obj: unknown) => {
    setSelectedObject(obj as AirportObject);
  }, []);

  const handleAviationStatsChange = useCallback((stats: { loaded: number; visible: number; clustersActive: boolean }) => {
    setAviationStats(stats);
  }, []);

  const handleSearchResultSelect = useCallback((result: SearchResult) => {
    // 1. If it's an airport, select it and ensure layer is on
    if (result.type === 'Airport' && result.rawData) {
      setAviationLayerActive(true);
      setSelectedObject(result.rawData);
    } else {
      // Clear selection if it's just a coordinate/place
      setSelectedObject(null);
    }

    // 2. Set camera target to trigger flight in CesiumGlobe
    setCameraTarget({
      position: result.position,
      type: result.type,
      timestamp: Date.now() // Ensure effect triggers even for same position
    });
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      {isBooting && (
        <div className="boot-screen">
          <div className="boot-logo"></div>
          <div className="boot-text">System Initializing...</div>
        </div>
      )}

      <CesiumGlobe 
        aviationLayerActive={aviationLayerActive}
        onObjectSelect={handleObjectSelect}
        onAviationStatsChange={handleAviationStatsChange}
        cameraTarget={cameraTarget}
      />

      <div style={{ 
        opacity: isBooting ? 0 : 1, 
        transition: 'opacity 1s ease-in',
        pointerEvents: isBooting ? 'none' : 'auto'
      }}>
        <Shell 
          aviationLayerActive={aviationLayerActive}
          setAviationLayerActive={setAviationLayerActive}
          selectedObject={selectedObject}
          aviationStats={aviationStats}
          onSearchResultSelect={handleSearchResultSelect}
        />
      </div>
    </div>
  );
};

export default App;
