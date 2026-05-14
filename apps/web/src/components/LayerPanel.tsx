import React, { useState } from 'react';

const LayerPanel: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`shell-panel shell-panel-left shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        {!isCollapsed && <span>Layers</span>}
        <button className="panel-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '»' : '«'}
        </button>
      </div>
      
      {isCollapsed ? (
        <div className="collapsed-label">LAYERS</div>
      ) : (
        <div className="panel-content">
          <div className="layer-item active">
            <div className="layer-name">Globe Core</div>
            <div className="layer-status">Active — Primary</div>
          </div>
          
          <div className="layer-item" style={{ opacity: 0.6, cursor: 'default' }}>
            <div className="layer-name">Aviation</div>
            <div className="layer-status">Coming Next</div>
          </div>

          <div className="layer-item" style={{ opacity: 0.3, cursor: 'default' }}>
            <div className="layer-name">Satellite</div>
            <div className="layer-status">Pending</div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default LayerPanel;
