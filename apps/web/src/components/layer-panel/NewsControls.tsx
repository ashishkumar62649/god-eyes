import type { NewsFilterState, NewsStatsResponse, NewsRenderMarker } from '../../layers/layer_08_news_osint/newsTypes';
import { NEWS_SEVERITY_COLORS, mapNewsItemToRenderItem } from '../../layers/layer_08_news_osint/newsTypes';
import type { NewsItem } from '@god-eyes/contracts';

export function NewsControls({
  active, setActive, loading, error, empty, markerCount, total, stats, filters, items, onFiltersChange, onRefresh, onSelect, entry,
}: {
  active: boolean;
  setActive: (a: boolean) => void;
  loading: boolean;
  error: string | null;
  empty: boolean;
  markerCount: number;
  total: number;
  stats: NewsStatsResponse | null;
  filters: NewsFilterState;
  items: NewsItem[];
  onFiltersChange: (f: NewsFilterState) => void;
  onRefresh: () => void;
  onSelect: (item: NewsRenderMarker | null) => void;
  entry: { name: string };
}) {
  const statusText = !active ? 'READY — CLICK TO ACTIVATE'
    : loading ? 'LOADING...'
    : error ? 'ERROR — LAYER OFFLINE'
    : empty ? 'ACTIVE — NO DATA'
    : `ACTIVE — ${markerCount} MARKERS / ${total} ITEMS`;

  const btnStyle = (isActive: boolean, color?: string) => ({
    background: isActive ? (color ?? 'var(--shell-accent)') : 'none',
    border: `1px solid ${color ?? 'rgba(255,255,255,0.2)'}`,
    borderRadius: '3px', cursor: 'pointer', padding: '2px 7px',
    color: isActive ? '#fff' : 'var(--shell-text-dim)', fontSize: '0.6rem',
  });

  return (
    <>
      <div className={`layer-item ${active ? 'active' : ''}`} onClick={() => setActive(!active)} style={{ cursor: 'pointer' }}>
        <div className="layer-name">{entry.name} [L8]</div>
        <div className="layer-status">
          <span style={{ color: active ? (error ? '#ff4d4d' : 'var(--shell-accent)') : undefined, fontWeight: active ? 600 : undefined, opacity: active ? 1 : 0.7 }}>
            {statusText}
          </span>
        </div>
        {active && stats && (
          <div style={{ marginTop: '6px', fontSize: '0.6rem', lineHeight: 1.5, opacity: 0.85 }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span>Total: {stats.total_items}</span>
              <span>Markers: {stats.marker_ready_items}</span>
            </div>
            {stats.fake_coordinate_risk_count > 0 && <div style={{ color: '#f97316', marginTop: '2px' }}>⚠ {stats.fake_coordinate_risk_count} fake-coordinate risk items</div>}
            {stats.by_severity.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                {stats.by_severity.map(({ severity, count }) => (
                  <span key={severity} style={{ background: NEWS_SEVERITY_COLORS[severity.toLowerCase()] ?? '#6b7280', color: '#fff', fontSize: '0.55rem', padding: '1px 5px', borderRadius: '3px', opacity: 0.9 }}>
                    {severity.toUpperCase()} {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {active && <div style={{ fontSize: '0.5rem', color: '#ffab00', opacity: 0.65, marginTop: '3px', lineHeight: 1.4 }}>GDACS disaster data via GOD EYES API. Point markers only on globe.</div>}
      </div>

      {active && (
        <>
          <div className="filter-section">
            <div className="filter-section-header">NEWS FILTERS</div>
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '0.6rem', opacity: 0.7, marginBottom: '3px' }}>SOURCE</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {['', 'gdacs', 'gdelt_event_export'].map((src) => {
                  const isActive = (filters.sourceId ?? '') === src;
                  const label = src === 'gdelt_event_export' ? 'GDELT' : src === 'gdacs' ? 'GDACS' : 'ALL';
                  return (
                    <button key={src || 'all'} onClick={() => onFiltersChange({ ...filters, sourceId: src || null, severity: null })} style={btnStyle(isActive)}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '0.6rem', opacity: 0.7, marginBottom: '3px' }}>SEVERITY</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(filters.sourceId === 'gdelt_event_export' ? ['', 'low', 'medium', 'high', 'critical']
                  : filters.sourceId === 'gdacs' ? ['', 'red', 'orange', 'green']
                  : ['', 'red', 'orange', 'green', 'low', 'medium', 'high', 'critical']
                ).map((sev) => {
                  const isActive = (filters.severity ?? '') === sev;
                  return (
                    <button key={sev || 'all'} onClick={() => onFiltersChange({ ...filters, severity: sev || null })} style={btnStyle(isActive, NEWS_SEVERITY_COLORS[sev] ?? undefined)}>
                      {sev ? sev.toUpperCase() : 'ALL'}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={`filter-toggle ${filters.markerReadyOnly ? 'active' : ''}`} onClick={() => onFiltersChange({ ...filters, markerReadyOnly: !filters.markerReadyOnly })}>
              <span className="filter-toggle-dot" style={{ background: filters.markerReadyOnly ? 'var(--shell-accent)' : 'rgba(255,255,255,0.2)', opacity: filters.markerReadyOnly ? 1 : 0.4 }} />
              <span className="filter-toggle-label">Marker-ready only</span>
            </div>
          </div>

          {items.length > 0 && (
            <div className="filter-section">
              <div className="filter-section-header">RECENT ITEMS ({items.length})</div>
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {items.map((item) => (
                  <div key={item.item_id} onClick={() => onSelect(mapNewsItemToRenderItem(item))}
                    style={{ padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.6rem', lineHeight: 1.45, cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <div style={{ color: 'var(--shell-text)', fontWeight: 500, marginBottom: '1.5px' }}>{item.title}</div>
                    <div style={{ display: 'flex', gap: '6px', opacity: 0.8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ background: item.source_id === 'gdelt_event_export' ? '#7c3aed' : '#2563eb', color: '#fff', padding: '0 4px', borderRadius: '2px', fontSize: '0.5rem', fontWeight: 600 }}>
                        {item.source_id === 'gdelt_event_export' ? 'GDELT' : 'GDACS'}
                      </span>
                      <span style={{ background: NEWS_SEVERITY_COLORS[item.severity?.toLowerCase()] ?? '#6b7280', color: '#fff', padding: '0 4px', borderRadius: '2px', fontSize: '0.5rem' }}>
                        {item.severity?.toUpperCase() ?? '—'}
                      </span>
                      {item.subcategory && <span>{item.subcategory}</span>}
                      {item.location.country_name && <span>{item.location.country_name}</span>}
                      {!item.location.marker_ready && <span style={{ color: '#f97316', fontWeight: 600 }}>list-only</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={onRefresh} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', cursor: 'pointer', padding: '4px 10px', color: 'var(--shell-text-dim)', fontSize: '0.6rem', marginTop: '6px', textAlign: 'center' }}>
            Refresh Data
          </button>

          <div className="legend-section">
            <div className="legend-section-header">SEVERITY LEGEND</div>
            {Object.entries(NEWS_SEVERITY_COLORS).map(([sev, color]) => (
              <div key={sev} className="legend-item">
                <span style={{ display: 'inline-block', width: '10px', height: '10px', background: color, marginRight: '8px', verticalAlign: 'middle', opacity: 0.85, transform: 'rotate(45deg)' }} />
                <span className="legend-label">{sev.charAt(0).toUpperCase() + sev.slice(1)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
