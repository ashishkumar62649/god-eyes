import type { EarthEvent } from '@god-eyes/contracts';

interface EarthquakeInfoOverlayProps {
  earthquake: EarthEvent;
  onClose: () => void;
}

export function EarthquakeInfoOverlay({ earthquake, onClose }: EarthquakeInfoOverlayProps) {
  return (
    <div style={{
      position: 'absolute', bottom: '80px', right: '20px',
      background: 'rgba(10, 14, 20, 0.92)',
      border: '1px solid rgba(255, 61, 0, 0.4)',
      color: '#e0e0e0', padding: '10px 14px', borderRadius: '4px',
      fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace',
      letterSpacing: '0.5px', zIndex: 1000, maxWidth: '260px',
      lineHeight: '1.6',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ color: '#ff3d00', fontWeight: 700, letterSpacing: '1px' }}>
          EARTHQUAKE M{earthquake.magnitude?.toFixed(1) ?? '?'}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
        >✕</button>
      </div>
      {earthquake.place && <div>{earthquake.place}</div>}
      {earthquake.depthKm != null && <div>DEPTH: {earthquake.depthKm} km</div>}
      <div>TIME: {new Date(earthquake.observedAt).toUTCString()}</div>
      {earthquake.sourceUrl && (
        <div style={{ marginTop: '4px' }}>
          <a href={earthquake.sourceUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: '#64b5f6', textDecoration: 'none' }}>
            SOURCE ↗
          </a>
        </div>
      )}
    </div>
  );
}
