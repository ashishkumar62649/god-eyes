import React, { useState } from 'react';

const StatusPanel: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <footer className={`shell-panel shell-footer shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        {!isCollapsed && <span>System Status & Timeline</span>}
        <button className="panel-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '▲' : '▼'}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="panel-content" style={{ display: 'flex', gap: '40px' }}>
          <div className="detail-row">
            <div className="detail-label">Current Mode</div>
            <div className="detail-value">Globe Core</div>
          </div>
          
          <div className="detail-row">
            <div className="detail-label">Data Layers</div>
            <div className="detail-value">1 Active / Aviation Pending</div>
          </div>
          
          <div className="detail-row">
            <div className="detail-label">Time Control</div>
            <div className="detail-value" style={{ opacity: 0.5 }}>Disabled</div>
          </div>
          
          <div className="detail-row">
            <div className="detail-label">Runtime Status</div>
            <div className="detail-value">Local Development</div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default StatusPanel;
