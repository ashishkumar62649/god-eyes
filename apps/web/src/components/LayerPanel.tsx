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
        setError('API OFFLINE');
      } finally {
        setLoading(false);
      }
    }

    loadStatus();
  }, []);

  return (
    <aside className={`shell-panel shell-panel-left shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        {!isCollapsed && <span>Operations</span>}
        <button className="panel-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '»' : '«'}
        </button>
      </div>
      
      {isCollapsed ? (
        <div className="collapsed-label">OPERATIONS</div>
      ) : (
        <div className="panel-content">
          <div className="layer-item active" style={{ cursor: 'default' }}>
            <div className="layer-name">Globe Core [L0]</div>
            <div className="layer-status" style={{ opacity: 0.8 }}>ONLINE — ACTIVE</div>
          </div>
          
          <div 
            className={`layer-item ${aviationLayerActive ? 'active' : ''}`} 
            onClick={() => !error && setAviationLayerActive(!aviationLayerActive)}
            style={{ 
              cursor: error ? 'not-allowed' : 'pointer',
              borderColor: error ? 'rgba(255, 77, 77, 0.3)' : undefined
            }}
          >
            <div className="layer-name">Aviation / Airports [L1]</div>
            <div className="layer-status">
              {error ? (
                <span style={{ color: '#ff4d4d', fontWeight: 600 }}>{error}</span>
              ) : loading ? (
                <span style={{ opacity: 0.7 }}>SYNCING...</span>
              ) : aviationLayerActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  <span style={{ color: 'var(--shell-accent)', fontWeight: 600 }}>ACTIVE</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', opacity: 0.8 }}>
                    <span>LOADED: {aviationStats.loaded} / {aviationStatus?.objectCounts.airports.toLocaleString() || 0}</span>
                    <span>VISIBLE: {aviationStats.visible}</span>
                  </div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.6, marginTop: '2px' }}>
                    MODE: {aviationStats.clustersActive ? 'CLUSTER AGGREGATION' : 'POINT RENDER'}
                  </div>
                </div>
              ) : (
                <span style={{ opacity: 0.7 }}>READY — CLICK TO ENABLE</span>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default LayerPanel;
