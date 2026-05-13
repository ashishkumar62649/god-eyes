import React, { useState } from 'react';

const DetailPanel: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`shell-panel shell-panel-right shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        <button className="panel-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '«' : '»'}
        </button>
        {!isCollapsed && <span>Details</span>}
      </div>
      
      {isCollapsed ? (
        <div className="collapsed-label">DETAILS</div>
      ) : (
        <div className="panel-content">
          <div style={{ textAlign: 'center', color: 'var(--shell-text-dim)', marginTop: '20px' }}>
            No object selected
          </div>
          
          <div style={{ marginTop: '30px' }}>
            <div className="detail-row">
              <div className="detail-label">Identity</div>
              <div className="detail-value">—</div>
            </div>
            
            <div className="detail-row">
              <div className="detail-label">Coordinates</div>
              <div className="detail-value">—</div>
            </div>
            
            <div className="detail-row">
              <div className="detail-label">Source</div>
              <div className="detail-value">—</div>
            </div>
            
            <div className="detail-row">
              <div className="detail-label">Evidence</div>
              <div className="detail-value">—</div>
            </div>
            
            <div className="detail-row">
              <div className="detail-label">Status</div>
              <div className="detail-value">—</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default DetailPanel;
