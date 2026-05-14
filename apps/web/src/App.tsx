import React from 'react';
import CesiumGlobe from './CesiumGlobe';
import Shell from './components/Shell';

const App: React.FC = () => {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <CesiumGlobe />
      <Shell />
    </div>
  );
};

export default App;
