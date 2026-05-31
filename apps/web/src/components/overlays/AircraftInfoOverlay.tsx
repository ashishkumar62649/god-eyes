import type { AircraftLatest } from '@god-eyes/contracts';

interface AircraftInfoOverlayProps {
  aircraft: AircraftLatest;
  onClose: () => void;
}

export function AircraftInfoOverlay({ aircraft, onClose }: AircraftInfoOverlayProps) {
  const headingDeg = aircraft.trackDeg ?? aircraft.headingTrueDeg ?? aircraft.headingMagDeg;

  return (
    <div style={{
      position: 'absolute', bottom: '80px', right: '20px',
      background: 'rgba(10, 14, 20, 0.92)',
      border: '1px solid rgba(0, 229, 255, 0.4)',
      color: '#e0e0e0', padding: '10px 14px', borderRadius: '4px',
      fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace',
      letterSpacing: '0.5px', zIndex: 1000, maxWidth: '280px',
      lineHeight: '1.6',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ color: '#00e5ff', fontWeight: 700, letterSpacing: '1px' }}>
          {aircraft.callsign?.trim() || aircraft.registration || aircraft.sourceObjectId}
          {aircraft.isMilitary ? ' • MIL' : ''}
          {aircraft.emergency && aircraft.emergency !== 'none' ? ' • EMERGENCY' : ''}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
        >✕</button>
      </div>
      {aircraft.registration && <div>REG: {aircraft.registration}</div>}
      {aircraft.aircraftType && <div>TYPE: {aircraft.aircraftType}</div>}
      {aircraft.altitudeBaroFt != null && <div>ALT: {aircraft.altitudeBaroFt.toLocaleString()} ft</div>}
      {aircraft.groundSpeedKt != null && <div>SPEED: {Math.round(aircraft.groundSpeedKt)} kt</div>}
      {headingDeg != null && (
        <div>HEADING: {Math.round(headingDeg)}°</div>
      )}
      <div style={{ opacity: 0.7 }}>ID: {aircraft.sourceObjectId}</div>
      <div style={{ opacity: 0.7 }}>OBSERVED: {new Date(aircraft.observedAt).toUTCString()}</div>
      <div style={{ marginTop: '6px', fontSize: '0.55rem', color: '#ffab00', opacity: 0.7, lineHeight: 1.4 }}>
        Live aircraft data: Airplanes.live (non-commercial/no-SLA). Not complete global coverage.
      </div>
    </div>
  );
}
