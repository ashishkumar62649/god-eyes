import React from 'react';
import CesiumGlobe from './CesiumGlobe';

const App: React.FC = () => {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <CesiumGlobe />
    </div>
  );
};

export default App;
