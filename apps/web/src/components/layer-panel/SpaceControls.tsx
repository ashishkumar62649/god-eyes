import { SatelliteFilters, SAFE_RENDER_CAP } from '../../layers/space/satellites/satelliteFilters';
import type { SpaceSatellitesStatus } from '../../layers/space/satellites/satelliteTypes';

function spaceSatellitesStatusText(active: boolean, status: SpaceSatellitesStatus): string {
  if (!active) return 'READY — CLICK TO ACTIVATE';
  const { phase, count, lastSuccessAt, errorMessage } = status;
  const secs = lastSuccessAt > 0 ? Math.max(0, Math.round((Date.now() - lastSuccessAt) / 1000)) : null;
  const ago = secs !== null ? ` (${secs}s AGO)` : '';
  switch (phase) {
    case 'connecting': return 'CONNECTING — SPACE & SATELLITES';
    case 'reconnecting': return count > 0 ? `RECONNECTING — ${count} OBJECTS${ago}` : 'RECONNECTING...';
    case 'live': return `LIVE — ${count.toLocaleString()} OBJECTS${ago}`;
    case 'error': return count > 0 ? `ERROR — LAST SNAPSHOT ${count} OBJECTS${ago}` : `ERROR — ${errorMessage}`;
    default: return 'ACTIVE';
  }
}

export function SpaceControls({
  active, setActive, status, filters, onFiltersChange,
}: {
  active: boolean;
  setActive: (a: boolean) => void;
  status: SpaceSatellitesStatus;
  filters: SatelliteFilters;
  onFiltersChange: (f: SatelliteFilters) => void;
  entry: { name: string };
}) {
  const toggle = (key: keyof SatelliteFilters, value?: unknown) => {
    if (value !== undefined) onFiltersChange({ ...filters, [key]: value });
    else onFiltersChange({ ...filters, [key]: !(filters as any)[key] });
  };

  return (
    <>
      <div className={`layer-item ${active ? 'active' : ''}`} onClick={() => setActive(!active)} style={{ cursor: 'pointer' }}>
        <div className="layer-name">Space & Satellites [L5]</div>
        <div className="layer-status">
          <span style={{
            color: active ? (status.phase === 'error' ? '#ff4d4d' : 'var(--shell-accent)') : undefined,
            fontWeight: active ? 600 : undefined, opacity: active ? 1 : 0.7,
          }}>
            {spaceSatellitesStatusText(active, status)}
          </span>
        </div>
      </div>

      {active && (
        <div className="filter-section">
          <div className="filter-section-header">SPACE FILTERS</div>
          <div className={`filter-toggle ${filters.extremeMode ? 'active' : ''}`} onClick={() => toggle('extremeMode')} style={{ marginBottom: '4px' }}>
            <span className="filter-toggle-dot" style={{ background: filters.extremeMode ? '#ff4d4d' : '#555', opacity: filters.extremeMode ? 1 : 0.4 }} />
            <span className="filter-toggle-label" style={{ color: filters.extremeMode ? '#ff4d4d' : undefined }}>
              {filters.extremeMode ? 'ALL OBJECTS ON' : 'Show all objects'}
            </span>
          </div>
          {filters.extremeMode && <div style={{ fontSize: '0.48rem', color: '#ff6b6b', lineHeight: 1.3, marginBottom: '6px', paddingLeft: '18px' }}>Extreme mode may reduce FPS or crash slower browsers.</div>}
          {!filters.extremeMode && <div style={{ fontSize: '0.48rem', color: '#ffab00', opacity: 0.65, lineHeight: 1.3, marginBottom: '6px', paddingLeft: '18px' }}>Default: capped to {SAFE_RENDER_CAP.toLocaleString()} objects.</div>}

          {([
            { key: 'showSatellites' as const, label: 'Satellites / Payloads', color: '#00e5ff' },
            { key: 'showDebris' as const, label: 'Debris', color: '#ff6b35' },
            { key: 'showRocketBodies' as const, label: 'Rocket Bodies', color: '#ffd166' },
            { key: 'showInactive' as const, label: 'Inactive Objects', color: '#a8dadc' },
            { key: 'importantOnly' as const, label: 'Important Only', color: '#ff2d55' },
            { key: 'showStarlink' as const, label: 'Starlink', color: '#00e676' },
          ]).map(({ key, label, color }) => {
            const isActive = key === 'importantOnly' ? filters.importantOnly : key === 'showStarlink' ? filters.showStarlink : (filters as any)[key];
            return (
              <div key={key} className={`filter-toggle ${isActive ? 'active' : ''}`} onClick={() => toggle(key)}>
                <span className="filter-toggle-dot" style={{ background: isActive ? color : '#555', opacity: isActive ? 1 : 0.4 }} />
                <span className="filter-toggle-label">{label}</span>
              </div>
            );
          })}

          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>SOURCE</div>
            {([
              { value: 'all' as const, label: 'All' },
              { value: 'celestrak' as const, label: 'CelesTrak' },
              { value: 'space-track' as const, label: 'Space-Track' },
            ]).map(({ value, label }) => (
              <div key={value} className={`filter-toggle ${filters.sourceFilter === value ? 'active' : ''}`} onClick={() => toggle('sourceFilter', value)}>
                <span className="filter-toggle-dot" style={{ background: filters.sourceFilter === value ? '#8a2be2' : '#555', opacity: filters.sourceFilter === value ? 1 : 0.4 }} />
                <span className="filter-toggle-label">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
