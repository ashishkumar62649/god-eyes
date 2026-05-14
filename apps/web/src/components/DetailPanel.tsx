import React, { useState } from 'react';

const DetailPanel: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`shell-panel shell-panel-right shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        <button className="panel-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '«' : '»'}
        </button>
        {!isCollapsed && <span>Object Intel</span>}
      </div>
      
      {isCollapsed ? (
        <div className="collapsed-label">INTEL</div>
      ) : (
        <div className="panel-content">
          <div style={{ 
            textAlign: 'center', 
            color: 'var(--shell-text-dim)', 
            marginTop: '40px',
            fontSize: '0.75rem',
            letterSpacing: '1px'
          }}>
            NO OBJECT SELECTED
          </div>
          
          <div style={{ marginTop: '40px' }}>
            <div className="detail-row">
              <div className="detail-label">Identity</div>
              <div className="detail-value">—</div>
            </div>
            
            <div className="detail-row">
              <div className="detail-label">Location / Coords</div>
              <div className="detail-value">—</div>
            </div>
            
            <div className="detail-row">
              <div className="detail-label">Data Source</div>
              <div className="detail-value">—</div>
            </div>
            
            <div className="detail-row">
              <div className="detail-label">Evidence Chain</div>
              <div className="detail-value">—</div>
            </div>
            
            <div className="detail-row">
              <div className="detail-label">Operational Status</div>
              <div className="detail-value">—</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default DetailPanel;
