import { AviationFilters, AVIATION_CATEGORIES } from '../../layers/layer_01_aviation/airports/aviationCategories';
import type { AviationStats } from './layerPanelTypes';
import type { LiveAircraftStatus } from '../../layers/layer_01_aviation/aircraft/useLiveAircraftSocket';

const FILTER_KEYS: (keyof AviationFilters)[] = [
  'major', 'regional', 'local', 'heliport', 'seaplane', 'balloonport', 'unknown', 'closed',
];

function liveAircraftStatusText(active: boolean, phase: LiveAircraftStatus): string {
  if (!active) return 'READY — CLICK TO ACTIVATE';
  const { phase: p, renderedCount, totalReceived, lastSuccessAt, errorMessage } = phase;
  const secs = lastSuccessAt > 0 ? Math.max(0, Math.round((Date.now() - lastSuccessAt) / 1000)) : null;
  const ago = secs !== null ? ` (${secs}s AGO)` : '';
  switch (p) {
    case 'connecting': return 'CONNECTING — LIVE AIRCRAFT';
    case 'reconnecting': return renderedCount > 0 ? `RECONNECTING — SHOWING LAST SNAPSHOT FROM ${secs ?? '?'}s AGO` : 'RECONNECTING...';
    case 'live':
      if (totalReceived > renderedCount && renderedCount > 0) return `LIVE — ${renderedCount} / ${totalReceived} AIRCRAFT RENDERED${ago}`;
      return `LIVE — ${renderedCount} AIRCRAFT${ago}`;
    case 'empty': return `LIVE — NO AIRCRAFT IN VIEW${ago}`;
    case 'error': return renderedCount > 0 ? `API UNAVAILABLE — SHOWING LAST GOOD SNAPSHOT FROM ${secs ?? '?'}s AGO` : `API UNAVAILABLE — ${errorMessage}`;
    default: return 'ACTIVE';
  }
}

export function AviationControls({
  aviationLayerActive, setAviationLayerActive, aviationStats, aviationFilters, onFiltersChange,
  liveAircraftLayerActive, setLiveAircraftLayerActive, liveAircraftPhase, entry,
}: {
  aviationLayerActive: boolean;
  setAviationLayerActive: (a: boolean) => void;
  aviationStats: AviationStats;
  aviationFilters: AviationFilters;
  onFiltersChange: (f: AviationFilters) => void;
  liveAircraftLayerActive: boolean;
  setLiveAircraftLayerActive: (a: boolean) => void;
  liveAircraftPhase: LiveAircraftStatus;
  entry: { name: string };
}) {
  const toggleFilter = (key: keyof AviationFilters) =>
    onFiltersChange({ ...aviationFilters, [key]: !aviationFilters[key] });

  return (
    <>
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
              {aviationStats.preloadStatus && <div style={{ fontSize: '0.6rem', opacity: 0.7, marginTop: '2px' }}>STATUS: {aviationStats.preloadStatus}</div>}
            </div>
          ) : <span style={{ opacity: 0.7 }}>READY — CLICK TO ACTIVATE</span>}
        </div>
      </div>

      <div className={`layer-item ${liveAircraftLayerActive ? 'active' : ''}`}
        onClick={() => setLiveAircraftLayerActive(!liveAircraftLayerActive)}
        style={{ cursor: 'pointer', marginLeft: '10px' }}>
        <div className="layer-name">↳ Live Aircraft [L1]</div>
        <div className="layer-status">
          <span style={{
            color: liveAircraftLayerActive ? (liveAircraftPhase.phase === 'error' ? '#ff4d4d' : 'var(--shell-accent)') : undefined,
            fontWeight: liveAircraftLayerActive ? 600 : undefined,
            opacity: liveAircraftLayerActive ? 1 : 0.7,
          }}>
            {liveAircraftStatusText(liveAircraftLayerActive, liveAircraftPhase)}
          </span>
        </div>
        {liveAircraftLayerActive && (
          <div style={{ fontSize: '0.5rem', color: '#ffab00', opacity: 0.65, marginTop: '3px', lineHeight: 1.4 }}>
            Live aircraft data: Airplanes.live (non-commercial/no-SLA). Not complete global coverage.
          </div>
        )}
      </div>

      {aviationLayerActive && (
        <>
          <div className="filter-section">
            <div className="filter-section-header">MARKER FILTERS</div>
            {FILTER_KEYS.map((key) => {
              const info = AVIATION_CATEGORIES[key];
              const active = aviationFilters[key];
              return (
                <div key={key} className={`filter-toggle ${active ? 'active' : ''}`} onClick={() => toggleFilter(key)}>
                  <span className="filter-toggle-dot" style={{ background: active ? info.markerColor : info.dimColor, opacity: active ? 1 : 0.4 }} />
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
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: info.color, marginRight: '8px', verticalAlign: 'middle', opacity: 0.8 }} />
                  <span className="legend-label">{info.label}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
