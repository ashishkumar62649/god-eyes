import React from 'react';
import Header from './Header';
import LayerPanel from './LayerPanel';
import DetailPanel from './DetailPanel';
import StatusPanel from './StatusPanel';
import '../styles/shell.css';

const Shell: React.FC = () => {
  return (
    <div className="shell-container">
      <Header />
      
      <main className="shell-main">
        <LayerPanel />
        <DetailPanel />
      </main>
      
      <StatusPanel />
    </div>
  );
};

export default Shell;
