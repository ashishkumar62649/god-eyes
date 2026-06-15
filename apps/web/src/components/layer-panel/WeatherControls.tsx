import { TEMPERATURE_LEGEND } from '../../layers/layer_07_weather/weatherMarker';
import { WEATHER_ATTRIBUTION } from '../../layers/layer_07_weather/weatherTypes';

export function WeatherControls({
  active, setActive, loading, error, empty, count, attribution, onRefresh, entry,
}: {
  active: boolean;
  setActive: (a: boolean) => void;
  loading: boolean;
  error: string | null;
  empty: boolean;
  count: number;
  attribution: string;
  onRefresh: () => void;
  entry: { name: string };
}) {
  const statusText = !active ? 'READY — CLICK TO ACTIVATE'
    : loading ? 'LOADING...'
    : error ? 'ERROR — LAYER OFFLINE'
    : empty ? 'ACTIVE — NO DATA'
    : `ACTIVE — ${count} OBS`;

  return (
    <>
      <div className={`layer-item ${active ? 'active' : ''}`} onClick={() => setActive(!active)} style={{ cursor: 'pointer' }}>
        <div className="layer-name">{entry.name} [L7]</div>
        <div className="layer-status">
          <span style={{ color: active ? (error ? '#ff4d4d' : 'var(--shell-accent)') : undefined, fontWeight: active ? 600 : undefined, opacity: active ? 1 : 0.7 }}>
            {statusText}
          </span>
        </div>
        {active && <div style={{ fontSize: '0.5rem', color: '#ffab00', opacity: 0.65, marginTop: '3px', lineHeight: 1.4 }}>Live weather via Open-Meteo (GOD EYES API). REST polling (10 min).</div>}
      </div>

      {active && (
        <>
          <div className="filter-section">
            <div className="filter-section-header">WEATHER CONTROLS</div>
            <div style={{ fontSize: '0.6rem', lineHeight: 1.5, color: 'var(--shell-text-dim)', marginTop: '4px' }}>
              {loading && <div>Loading observations…</div>}
              {!loading && error && <div style={{ color: '#f87171' }}>Error: {error}</div>}
              {!loading && !error && empty && <div>No weather observations available.</div>}
              {!loading && !error && !empty && <div>Observations loaded: {count}</div>}
            </div>
            <button onClick={onRefresh} style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '3px', color: 'var(--shell-text-dim)', padding: '4px 8px', fontSize: '0.6rem', cursor: 'pointer', marginTop: '6px', textAlign: 'center' }}>
              Refresh Data
            </button>
          </div>

          <div className="legend-section">
            <div className="legend-section-header">TEMPERATURE (°C)</div>
            {TEMPERATURE_LEGEND.map(({ bucket, color, label }) => (
              <div key={bucket} className="legend-item">
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: color, marginRight: '8px', verticalAlign: 'middle', opacity: 0.85 }} />
                <span className="legend-label">{label}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '8px', fontSize: '0.5rem', color: '#888', opacity: 0.8, lineHeight: 1.4 }}>
            {attribution || WEATHER_ATTRIBUTION}
          </div>
        </>
      )}
    </>
  );
}
