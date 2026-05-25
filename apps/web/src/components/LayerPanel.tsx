import React, { useState } from 'react';
import type { LayerRegistryEntry } from '@god-eyes/contracts';
import { AviationFilters, AVIATION_CATEGORIES } from '../lib/aviationCategories';
import { useLayerRegistry } from '../lib/useLayerRegistry';

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
  'major', 'regional', 'local', 'heliport', 'seaplane', 'balloonport', 'unknown', 'closed',
];

function statusLabel(entry: LayerRegistryEntry): string {
  if (entry.status === 'active') return 'ACTIVE';
  if (entry.status === 'coming_soon') return 'COMING SOON';
  return 'NO DATA YET';
}

const LayerPanel: React.FC<LayerPanelProps> = ({
  aviationLayerActive,
  setAviationLayerActive,
  aviationStats,
  aviationFilters,
  onFiltersChange,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { layers, apiAvailable, loading } = useLayerRegistry();

  const toggleFilter = (key: keyof AviationFilters) => {
    onFiltersChange({ ...aviationFilters, [key]: !aviationFilters[key] });
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
          {/* Subtle offline indicator — only shown when API registry is unavailable */}
          {!loading && !apiAvailable && (
            <div style={{ fontSize: '0.55rem', color: '#ffab00', opacity: 0.7, marginBottom: '6px', letterSpacing: '0.5px' }}>
              REGISTRY OFFLINE — LOCAL DATA
            </div>
          )}

          {layers.map((entry) => {
            const isGlobeCore = entry.layerId === 'layer_00_globe_core';
            const isAviation = entry.layerId === 'layer_01_aviation';
            const isInactive = entry.status !== 'active';

            if (isGlobeCore) {
              return (
                <div key={entry.layerId} className="layer-item active" style={{ cursor: 'default' }}>
                  <div className="layer-name">{entry.name} [L0]</div>
                  <div className="layer-status" style={{ opacity: 0.8 }}>ONLINE — ACTIVE</div>
                </div>
              );
            }

            if (isAviation) {
              return (
                <div
                  key={entry.layerId}
                  className={`layer-item ${aviationLayerActive ? 'active' : ''}`}
                  onClick={() => setAviationLayerActive(!aviationLayerActive)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="layer-name">{entry.name} [L1]</div>
                  <div className="layer-status">
                    {aviationLayerActive ? (
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
              );
            }

            // All other layers: coming_soon or no_data
            const layerIndex = entry.layerId.match(/layer_(\d+)/)?.[1] ?? '';
            return (
              <div key={entry.layerId} className="layer-item" style={{ cursor: 'default', opacity: 0.45 }}>
                <div className="layer-name">{entry.name}{layerIndex ? ` [L${parseInt(layerIndex, 10)}]` : ''}</div>
                <div className="layer-status">
                  <span style={{
                    color: isInactive ? '#ffab00' : 'var(--shell-accent)',
                    fontSize: '0.6rem',
                    letterSpacing: '1px',
                  }}>
                    {statusLabel(entry)}
                  </span>
                </div>
              </div>
            );
          })}

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
                        style={{ background: active ? info.markerColor : info.dimColor, opacity: active ? 1 : 0.4 }}
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
                      <span style={{
                        display: 'inline-block', width: '10px', height: '10px',
                        borderRadius: '50%', background: info.color,
                        marginRight: '8px', verticalAlign: 'middle', opacity: 0.8,
                      }} />
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
