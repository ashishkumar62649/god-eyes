import type { MaritimeStatsResponse } from '@god-eyes/contracts';

export function MaritimeControls({
  active, setActive, stats, filters, onFiltersChange, onRefresh, entry,
}: {
  active: boolean;
  setActive: (a: boolean) => void;
  stats: MaritimeStatsResponse | null;
  filters: { search: string; vesselType: string | null };
  onFiltersChange: (f: { search: string; vesselType: string | null }) => void;
  onRefresh: () => void;
  entry: { name: string };
}) {
  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '3px', color: 'var(--shell-text-dim)', padding: '4px 8px', fontSize: '0.6rem', marginBottom: '4px',
  };

  return (
    <>
      <div className={`layer-item ${active ? 'active' : ''}`} onClick={() => setActive(!active)} style={{ cursor: 'pointer' }}>
        <div className="layer-name">{entry.name} [L6]</div>
        <div className="layer-status">
          <span style={{ color: active ? 'var(--shell-accent)' : undefined, fontWeight: active ? 600 : undefined, opacity: active ? 1 : 0.7 }}>
            {active ? 'ACTIVE' : 'READY — CLICK TO ACTIVATE'}
          </span>
        </div>
        {active && <div style={{ fontSize: '0.5rem', color: '#ffab00', opacity: 0.65, marginTop: '3px', lineHeight: 1.4 }}>Live vessel data via AISStream. REST polling (30s).</div>}
      </div>

      {active && (
        <>
          <div className="filter-section">
            <div className="filter-section-header">MARITIME CONTROLS</div>
            <div style={{ marginTop: '4px' }}>
              <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>SEARCH VESSEL</div>
              <input type="text" placeholder="Search name, MMSI, callsign..." value={filters.search || ''}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginTop: '4px' }}>
              <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>VESSEL TYPE</div>
              <select value={filters.vesselType || ''} onChange={(e) => onFiltersChange({ ...filters, vesselType: e.target.value || null })}
                style={{ ...inputStyle, outline: 'none' }}>
                <option value="">All Types</option>
                {['cargo','tanker','passenger','fishing','tug','military','pleasure','sailing','high speed craft'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <button onClick={onRefresh} style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '3px', color: 'var(--shell-text-dim)', padding: '4px 8px', fontSize: '0.6rem', cursor: 'pointer', marginTop: '6px', textAlign: 'center' }}>
              Refresh Data
            </button>
          </div>

          {stats && (
            <div className="legend-section" style={{ marginTop: '10px' }}>
              <div className="legend-section-header">MARITIME STATS</div>
              <div style={{ fontSize: '0.6rem', lineHeight: 1.5, color: 'var(--shell-text-dim)' }}>
                <div>Total Vessels: {stats.totalVessels}</div>
                <div>Active: {stats.activeVessels}</div>
                <div>Stale: {stats.staleVessels}</div>
                {stats.lastUpdated && <div style={{ fontSize: '0.5rem', opacity: 0.6, marginTop: '4px' }}>Updated: {new Date(stats.lastUpdated).toLocaleString()}</div>}
              </div>
            </div>
          )}

          <div className="legend-section">
            <div className="legend-section-header">VESSEL TYPES</div>
            {[
              { color: '#3b82f6', label: 'Cargo' }, { color: '#f97316', label: 'Tanker' }, { color: '#a855f7', label: 'Passenger' },
              { color: '#22c55e', label: 'Fishing' }, { color: '#eab308', label: 'Tug' }, { color: '#ef4444', label: 'Military' },
              { color: '#06b6d4', label: 'Pleasure / Sailing' }, { color: '#00e5ff', label: 'High Speed Craft' }, { color: '#9ca3af', label: 'Unknown' },
            ].map(({ color, label }) => (
              <div key={label} className="legend-item">
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: color, marginRight: '8px', verticalAlign: 'middle', opacity: 0.8 }} />
                <span className="legend-label">{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
