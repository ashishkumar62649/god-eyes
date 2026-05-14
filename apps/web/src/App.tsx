import React, { useState, useEffect, useCallback } from 'react';
import CesiumGlobe from './CesiumGlobe';
import Shell from './components/Shell';
import { AirportObject } from '@god-eyes/contracts';

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [aviationLayerActive, setAviationLayerActive] = useState(false);
  const [selectedObject, setSelectedObject] = useState<AirportObject | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleObjectSelect = useCallback((obj: unknown) => {
    setSelectedObject(obj as AirportObject);
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
        />
      </div>
    </div>
  );
};

export default App;
