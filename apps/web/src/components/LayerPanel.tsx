import React, { useState } from 'react';
import type { LayerRegistryEntry } from '@god-eyes/contracts';
import { AviationFilters, AVIATION_CATEGORIES } from '../lib/aviationCategories';
import { useLayerRegistry } from '../lib/useLayerRegistry';
import type { EarthEventsPhase } from '../lib/useEarthEvents';
import type { BordersPhase } from '../lib/useBordersBoundaries';
import type { LiveAircraftStatus } from '../lib/useLiveAircraftSocket';

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
  earthEventsLayerActive: boolean;
  setEarthEventsLayerActive: (active: boolean) => void;
  earthEventsPhase: EarthEventsPhase;
  bordersLayerActive: boolean;
  setBordersLayerActive: (active: boolean) => void;
  bordersPhase: BordersPhase;
  liveAircraftLayerActive: boolean;
  setLiveAircraftLayerActive: (active: boolean) => void;
  liveAircraftPhase: LiveAircraftStatus;
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
  aviationLayerActive, setAviationLayerActive,
  aviationStats, aviationFilters, onFiltersChange,
  earthEventsLayerActive, setEarthEventsLayerActive, earthEventsPhase,
  bordersLayerActive, setBordersLayerActive, bordersPhase,
  liveAircraftLayerActive, setLiveAircraftLayerActive, liveAircraftPhase,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { layers, apiAvailable, loading } = useLayerRegistry();

  const toggleFilter = (key: keyof AviationFilters) =>
    onFiltersChange({ ...aviationFilters, [key]: !aviationFilters[key] });

  function earthEventsStatusText(): string {
    if (!earthEventsLayerActive) return 'READY — CLICK TO ACTIVATE';
    switch (earthEventsPhase.phase) {
      case 'loading': return 'LOADING...';
      case 'ok': return `ACTIVE — ${earthEventsPhase.events.length} EVENTS`;
      case 'empty': return 'ACTIVE — NO DATA';
      case 'error': return 'ERROR — LAYER OFFLINE';
      default: return 'ACTIVE';
    }
  }

  function bordersStatusText(): string {
    if (!bordersLayerActive) return 'READY — CLICK TO ACTIVATE';
    switch (bordersPhase.phase) {
      case 'loading': return 'LOADING...';
      case 'ok': return `ACTIVE — ${bordersPhase.data.features.length} COUNTRIES`;
      case 'error': return 'ERROR — LAYER OFFLINE';
      default: return 'ACTIVE';
    }
  }

  function liveAircraftStatusText(): string {
    if (!liveAircraftLayerActive) return 'READY — CLICK TO ACTIVATE';
    const { phase, renderedCount, totalReceived, lastSuccessAt, errorMessage } = liveAircraftPhase;
    const secs = lastSuccessAt > 0 ? Math.max(0, Math.round((Date.now() - lastSuccessAt) / 1000)) : null;
    const ago = secs !== null ? ` (${secs}s AGO)` : '';
    switch (phase) {
      case 'connecting': return 'CONNECTING — LIVE AIRCRAFT';
      case 'reconnecting':
        return renderedCount > 0
          ? `RECONNECTING — SHOWING LAST SNAPSHOT FROM ${secs ?? '?'}s AGO`
          : 'RECONNECTING...';
      case 'live':
        if (totalReceived > renderedCount && renderedCount > 0) {
          return `LIVE — ${renderedCount} / ${totalReceived} AIRCRAFT RENDERED${ago}`;
        }
        return `LIVE — ${renderedCount} AIRCRAFT${ago}`;
      case 'empty': return `LIVE — NO AIRCRAFT IN VIEW${ago}`;
      case 'error':
        return renderedCount > 0
          ? `API UNAVAILABLE — SHOWING LAST GOOD SNAPSHOT FROM ${secs ?? '?'}s AGO`
          : `API UNAVAILABLE — ${errorMessage}`;
      default: return 'ACTIVE';
    }
  }

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
          {!loading && !apiAvailable && (
            <div style={{ fontSize: '0.55rem', color: '#ffab00', opacity: 0.7, marginBottom: '6px', letterSpacing: '0.5px' }}>
              REGISTRY OFFLINE — LOCAL DATA
            </div>
          )}

          {layers.map((entry) => {
            const isGlobeCore = entry.layerId === 'layer_00_globe_core';
            const isAviation = entry.layerId === 'layer_01_aviation';
            const isBorders = entry.layerId === 'layer_02_borders_boundaries';
            const isEarthEvents = entry.layerId === 'layer_03_earth_events';
            const isInactive = entry.status !== 'active';
            const layerIndex = entry.layerId.match(/layer_(\d+)/)?.[1] ?? '';

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
                <React.Fragment key={entry.layerId}>
                <div className={`layer-item ${aviationLayerActive ? 'active' : ''}`}
                  onClick={() => setAviationLayerActive(!aviationLayerActive)} style={{ cursor: 'pointer' }}>
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
                <div className={`layer-item ${liveAircraftLayerActive ? 'active' : ''}`}
                  onClick={() => setLiveAircraftLayerActive(!liveAircraftLayerActive)}
                  style={{ cursor: 'pointer', marginLeft: '10px' }}>
                  <div className="layer-name">↳ Live Aircraft [L1]</div>
                  <div className="layer-status">
                    <span style={{
                      color: liveAircraftLayerActive
                        ? (liveAircraftPhase.phase === 'error' ? '#ff4d4d' : 'var(--shell-accent)')
                        : undefined,
                      fontWeight: liveAircraftLayerActive ? 600 : undefined,
                      opacity: liveAircraftLayerActive ? 1 : 0.7,
                    }}>
                      {liveAircraftStatusText()}
                    </span>
                  </div>
                  {liveAircraftLayerActive && (
                    <div style={{ fontSize: '0.5rem', color: '#ffab00', opacity: 0.65, marginTop: '3px', lineHeight: 1.4 }}>
                      Live aircraft data: Airplanes.live (non-commercial/no-SLA). Not complete global coverage.
                    </div>
                  )}
                </div>
                </React.Fragment>
              );
            }

            if (isBorders) {
              return (
                <div key={entry.layerId} className={`layer-item ${bordersLayerActive ? 'active' : ''}`}
                  onClick={() => setBordersLayerActive(!bordersLayerActive)} style={{ cursor: 'pointer' }}>
                  <div className="layer-name">Borders &amp; Boundaries [L2]</div>
                  <div className="layer-status">
                    <span style={{
                      color: bordersLayerActive ? 'var(--shell-accent)' : undefined,
                      fontWeight: bordersLayerActive ? 600 : undefined,
                      opacity: bordersLayerActive ? 1 : 0.7,
                    }}>
                      {bordersStatusText()}
                    </span>
                  </div>
                  {bordersLayerActive && (
                    <div style={{ fontSize: '0.5rem', color: '#ffab00', opacity: 0.65, marginTop: '3px', lineHeight: 1.4 }}>
                      Natural Earth MVP/local/dev boundaries. Not production-approved. Not Survey of India compliant.
                    </div>
                  )}
                </div>
              );
            }

            if (isEarthEvents) {
              return (
                <div key={entry.layerId} className={`layer-item ${earthEventsLayerActive ? 'active' : ''}`}
                  onClick={() => setEarthEventsLayerActive(!earthEventsLayerActive)} style={{ cursor: 'pointer' }}>
                  <div className="layer-name">{entry.name} [L3]</div>
                  <div className="layer-status">
                    <span style={{
                      color: earthEventsLayerActive ? 'var(--shell-accent)' : undefined,
                      fontWeight: earthEventsLayerActive ? 600 : undefined,
                      opacity: earthEventsLayerActive ? 1 : 0.7,
                    }}>
                      {earthEventsStatusText()}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div key={entry.layerId} className="layer-item" style={{ cursor: 'default', opacity: 0.45 }}>
                <div className="layer-name">{entry.name}{layerIndex ? ` [L${parseInt(layerIndex, 10)}]` : ''}</div>
                <div className="layer-status">
                  <span style={{ color: isInactive ? '#ffab00' : 'var(--shell-accent)', fontSize: '0.6rem', letterSpacing: '1px' }}>
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
                    <div key={key} className={`filter-toggle ${active ? 'active' : ''}`} onClick={() => toggleFilter(key)}>
                      <span className="filter-toggle-dot"
                        style={{ background: active ? info.markerColor : info.dimColor, opacity: active ? 1 : 0.4 }} />
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
