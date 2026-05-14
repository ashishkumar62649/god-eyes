import React, { useState } from 'react';

const StatusPanel: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <footer className={`shell-panel shell-footer shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        {!isCollapsed && <span>System Telemetry</span>}
        <button className="panel-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '▲' : '▼'}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="panel-content" style={{ display: 'flex', gap: '48px', alignItems: 'center' }}>
          <div className="detail-row" style={{ marginBottom: 0 }}>
            <div className="detail-label">Node Status</div>
            <div className="detail-value" style={{ color: 'var(--shell-accent)' }}>CONNECTED / LOCAL</div>
          </div>
          
          <div className="detail-row" style={{ marginBottom: 0 }}>
            <div className="detail-label">Active Layers</div>
            <div className="detail-value">L0: GLOBE CORE</div>
          </div>
          
          <div className="detail-row" style={{ marginBottom: 0 }}>
            <div className="detail-label">Data Ingestion</div>
            <div className="detail-value" style={{ opacity: 0.6 }}>AWAITING L1</div>
          </div>
          
          <div className="detail-row" style={{ marginBottom: 0 }}>
            <div className="detail-label">Engine</div>
            <div className="detail-value">CESIUMJS / VITE</div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
             <div style={{ width: '4px', height: '16px', background: 'var(--shell-accent)', opacity: 0.2 }}></div>
             <div style={{ width: '4px', height: '16px', background: 'var(--shell-accent)', opacity: 0.5 }}></div>
             <div style={{ width: '4px', height: '16px', background: 'var(--shell-accent)' }}></div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default StatusPanel;
