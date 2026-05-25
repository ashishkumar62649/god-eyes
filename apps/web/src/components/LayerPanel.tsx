import React, { useState, useEffect } from 'react';
import { fetchLayerStatus } from '../lib/api';
import { AviationFilters, AVIATION_CATEGORIES } from '../lib/aviationCategories';

interface AviationStats {
  loaded: number;
  visible: number;
  clustersActive: boolean;
  renderMode: string;
  fps: number;
  preloadStatus?: string;
}

interface LayerPanelProps {
  aviationLayerActive: boolean;
  setAviationLayerActive: (active: boolean) => void;
  aviationStats: AviationStats;
  aviationFilters: AviationFilters;
  onFiltersChange: (filters: AviationFilters) => void;
}

const FILTER_KEYS: (keyof AviationFilters)[] = [
  'major',
  'regional',
  'local',
  'heliport',
  'seaplane',
  'balloonport',
  'unknown',
  'closed',
];

const LayerPanel: React.FC<LayerPanelProps> = ({
  aviationLayerActive,
  setAviationLayerActive,
  aviationStats,
  aviationFilters,
  onFiltersChange,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      setLoading(true);
      try {
        await fetchLayerStatus('layer_01_aviation');
        setError(null);
      } catch (err) {
        console.error('Failed to fetch aviation status:', err);
        setError('LAYER OFFLINE — DEMO MODE');
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, []);

  const toggleFilter = (key: keyof AviationFilters) => {
    const next = { ...aviationFilters, [key]: !aviationFilters[key] };
    onFiltersChange(next);
  };

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
              borderColor: error ? 'rgba(255, 171, 0, 0.3)' : undefined,
            }}
          >
            <div className="layer-name">Aviation / Airports [L1]</div>
            <div className="layer-status">
              {error ? (
                <span style={{ color: '#ffab00', fontWeight: 600 }}>{error}</span>
              ) : loading ? (
                <span style={{ opacity: 0.7 }}>SYNCING...</span>
              ) : aviationLayerActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  <span style={{ color: 'var(--shell-accent)', fontWeight: 600 }}>ACTIVE — RESIDENT GLOBAL</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', opacity: 0.8 }}>
                    <span>LOADED: {aviationStats.loaded.toLocaleString()}</span>
                    <span>VISIBLE: {aviationStats.visible.toLocaleString()}</span>
                  </div>
                  {aviationStats.preloadStatus && (
                    <div style={{ fontSize: '0.6rem', opacity: 0.7, marginTop: '2px' }}>
                      STATUS: {aviationStats.preloadStatus}
                    </div>
                  )}
                </div>
              ) : (
                <span style={{ opacity: 0.7 }}>READY — CLICK TO ACTIVATE</span>
              )}
            </div>
          </div>

          {/* Coming Soon layers */}
          {([
            'Borders & Boundaries [L2]',
            'Earth Events [L3]',
            'Public / Military Security [L4]',
            'Space & Satellites [L5]',
            'Maritime [L6]',
            'Infrastructure [L7]',
            'News & OSINT [L8]',
            'User Shapes [L9]',
          ] as const).map((label) => (
            <div key={label} className="layer-item" style={{ cursor: 'default', opacity: 0.45 }}>
              <div className="layer-name">{label}</div>
              <div className="layer-status">
                <span style={{ color: '#ffab00', fontSize: '0.6rem', letterSpacing: '1px' }}>COMING SOON</span>
              </div>
            </div>
          ))}

          {aviationLayerActive && (
            <>
              <div className="filter-section">
                <div className="filter-section-header">MARKER FILTERS</div>
                {FILTER_KEYS.map((key) => {
                  const info = AVIATION_CATEGORIES[key];
                  const active = aviationFilters[key];
                  return (
                    <div
                      key={key}
                      className={`filter-toggle ${active ? 'active' : ''}`}
                      onClick={() => toggleFilter(key)}
                    >
                      <span
                        className="filter-toggle-dot"
                        style={{
                          background: active ? info.markerColor : info.dimColor,
                          opacity: active ? 1 : 0.4,
                        }}
                      />
                      <span className="filter-toggle-label">{info.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="legend-section">
                <div className="legend-section-header">MARKER LEGEND</div>
                {FILTER_KEYS.map((key) => {
                  const info = AVIATION_CATEGORIES[key];
                  return (
                    <div key={key} className="legend-item">
                      <span
                        className="legend-marker"
                        style={{
                          display: 'inline-block',
                          width: '10px', height: '10px',
                          borderRadius: '50%',
                          background: info.color,
                          marginRight: '8px',
                          verticalAlign: 'middle',
                          opacity: 0.8,
                        }}
                      />
                      <span className="legend-label">{info.label}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
};

export default LayerPanel;
