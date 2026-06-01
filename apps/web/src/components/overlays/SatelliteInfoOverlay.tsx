// SatelliteInfoOverlay.tsx — WO-082E
// Info overlay shown when user clicks a satellite or debris object.
// Follows AircraftInfoOverlay pattern.

import type { SatelliteFrontendItem } from '../../layers/space/satellites/satelliteTypes';

interface SatelliteInfoOverlayProps {
  satellite: SatelliteFrontendItem;
  onClose: () => void;
}

export function SatelliteInfoOverlay({ satellite, onClose }: SatelliteInfoOverlayProps) {
  const isDebris = satellite.objectType === 'debris' || satellite.objectType === 'rocket_body';
  const accentColor = isDebris ? '#ff6b35' : '#00e5ff';
  const borderColor = isDebris ? 'rgba(255, 107, 53, 0.4)' : 'rgba(0, 229, 255, 0.4)';

  const typeLabel: Record<string, string> = {
    satellite: 'SATELLITE',
    debris: 'DEBRIS',
    rocket_body: 'ROCKET BODY',
    inactive_payload: 'INACTIVE PAYLOAD',
    unknown: 'UNKNOWN',
  };

  const dataAgeLabel = (): string => {
    if (satellite.sourceAgeSeconds === null || satellite.sourceAgeSeconds === undefined) return 'UNKNOWN';
    const s = satellite.sourceAgeSeconds;
    if (s < 60) return `${s}s AGO`;
    if (s < 3600) return `${Math.round(s / 60)}m AGO`;
    return `${Math.round(s / 3600)}h AGO`;
  };

  return (
    <div style={{
      position: 'absolute', bottom: '80px', right: '20px',
      background: 'rgba(10, 14, 20, 0.92)',
      border: `1px solid ${borderColor}`,
      color: '#e0e0e0', padding: '10px 14px', borderRadius: '4px',
      fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace',
      letterSpacing: '0.5px', zIndex: 1000, maxWidth: '290px',
      lineHeight: '1.6',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ color: accentColor, fontWeight: 700, letterSpacing: '1px' }}>
          {satellite.name || satellite.sourceObjectId}
          {satellite.important ? ' ★' : ''}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
        >✕</button>
      </div>

      <div>TYPE: {typeLabel[satellite.objectType] ?? satellite.objectType.toUpperCase()}</div>
      {satellite.noradId !== null && <div>NORAD ID: {satellite.noradId}</div>}
      {satellite.category && <div>CATEGORY: {satellite.category}</div>}
      {satellite.orbitClass && <div>ORBIT: {satellite.orbitClass}</div>}
      {satellite.altitudeKm !== null && satellite.altitudeKm !== undefined && (
        <div>ALTITUDE: {Math.round(satellite.altitudeKm).toLocaleString()} km</div>
      )}
      {satellite.velocityKms !== null && satellite.velocityKms !== undefined && (
        <div>SPEED: {satellite.velocityKms.toFixed(2)} km/s</div>
      )}
      <div>LAT: {satellite.latitude.toFixed(4)}°</div>
      <div>LON: {satellite.longitude.toFixed(4)}°</div>
      {satellite.country && <div>COUNTRY: {satellite.country}</div>}
      <div style={{ opacity: 0.7 }}>SOURCE: {satellite.sourceId}</div>
      <div style={{ opacity: 0.7 }}>DATA AGE: {dataAgeLabel()}</div>
      <div style={{ opacity: 0.7 }}>ESTIMATED AT: {new Date(satellite.estimatedAt).toUTCString()}</div>

      <div style={{ marginTop: '6px', fontSize: '0.55rem', color: '#ffab00', opacity: 0.75, lineHeight: 1.4 }}>
        {isDebris
          ? 'Estimated orbital position computed from TLE data. Not confirmed live tracking. No active control or communication.'
          : 'Estimated orbital position computed from TLE data (CelesTrak). Not confirmed real-time sensor tracking.'}
      </div>
    </div>
  );
}
