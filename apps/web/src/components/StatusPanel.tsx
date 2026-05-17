import React, { useState } from 'react';

interface StatusPanelProps {
  aviationLayerActive: boolean;
  aviationStats: { loaded: number; visible: number; clustersActive: boolean; renderMode: string };
}

const StatusPanel: React.FC<StatusPanelProps> = ({ aviationLayerActive, aviationStats }) => {
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
        <div className="panel-content" style={{ display: 'flex', gap: '32px', alignItems: 'center', padding: '16px 20px' }}>
          <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
            <div className="detail-label">Node Status</div>
            <div className="detail-value" style={{ color: 'var(--shell-accent)' }}>CONNECTED</div>
          </div>
          
          <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
            <div className="detail-label">Active Layers</div>
            <div className="detail-value">
              L0
              {aviationLayerActive && ' / L1'}
            </div>
          </div>
          
          <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
            <div className="detail-label">Render Mode</div>
            <div className="detail-value" style={{ color: ['clusters', 'density'].includes(aviationStats.renderMode) ? 'var(--shell-accent)' : 'inherit' }}>
              {aviationStats.renderMode === 'density' ? 'DENSITY' : aviationStats.clustersActive ? 'CLUSTERED' : 'POINTS'}
            </div>
          </div>
          
          <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
            <div className="detail-label">Data Stream</div>
            <div className="detail-value" style={{ opacity: 0.8 }}>
              {aviationLayerActive ? `L1 [${aviationStats.loaded}]` : 'AWAITING L1'}
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
             <div style={{ width: '4px', height: '14px', background: 'var(--shell-accent)', opacity: aviationLayerActive ? 0.3 : 0.1 }}></div>
             <div style={{ width: '4px', height: '14px', background: 'var(--shell-accent)', opacity: aviationLayerActive ? 0.6 : 0.3 }}></div>
             <div style={{ width: '4px', height: '14px', background: 'var(--shell-accent)', opacity: aviationLayerActive ? 1.0 : 0.5 }}></div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default StatusPanel;
