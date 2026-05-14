import React, { useState, useEffect } from 'react';
import { fetchLayerStatus } from '../lib/api';
import { LayerStatusResponse } from '@god-eyes/contracts';

interface LayerPanelProps {
  aviationLayerActive: boolean;
  setAviationLayerActive: (active: boolean) => void;
  aviationStats: { loaded: number; visible: number; clustersActive: boolean };
}

const LayerPanel: React.FC<LayerPanelProps> = ({ 
  aviationLayerActive, 
  setAviationLayerActive,
  aviationStats
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [aviationStatus, setAviationStatus] = useState<LayerStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      setLoading(true);
      try {
        const status = await fetchLayerStatus('layer_01_aviation');
        setAviationStatus(status);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch aviation status:', err);
        setError('Aviation API offline');
      } finally {
        setLoading(false);
      }
    }

    loadStatus();
  }, []);

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
          
          <div 
            className={`layer-item ${aviationLayerActive ? 'active' : ''}`} 
            onClick={() => !error && setAviationLayerActive(!aviationLayerActive)}
            style={{ cursor: error ? 'not-allowed' : 'pointer' }}
          >
            <div className="layer-name">Aviation / Airports</div>
            <div className="layer-status">
              {error ? (
                <span style={{ color: '#ff4d4d' }}>{error}</span>
              ) : loading ? (
                'Loading...'
              ) : aviationLayerActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span>Active — {aviationStatus?.objectCounts.airports.toLocaleString() || 0} Records</span>
                  <span style={{ fontSize: '0.6rem', opacity: 0.8, color: 'var(--shell-accent)' }}>
                    Loaded: {aviationStats.loaded} | Visible: {aviationStats.visible}
                  </span>
                  <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>
                    CLUSTERING: {aviationStats.clustersActive ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
              ) : (
                'Ready — Click to Enable'
              )}
            </div>
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
