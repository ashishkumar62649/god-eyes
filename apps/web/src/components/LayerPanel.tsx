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
            <div>Layer 0: Globe Core</div>
            <div className="layer-status">Active</div>
          </div>
          
          <div className="layer-item" style={{ opacity: 0.5 }}>
            <div>Layer 1: Aviation</div>
            <div className="layer-status">Coming Next</div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default LayerPanel;
