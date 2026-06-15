import React from 'react';
import type { MaritimeVesselObject, MaritimeVesselDetail } from '@god-eyes/contracts';

const spinner: React.CSSProperties = {
  display: 'inline-block', width: '8px', height: '8px',
  border: '2px solid var(--shell-text-dim)', borderTopColor: 'var(--shell-accent)',
  borderRadius: '50%', animation: 'spin 1s linear infinite',
};

export function MaritimeDetail({
  vessel,
  detail,
  loading,
  error,
}: {
  vessel: MaritimeVesselObject;
  detail: MaritimeVesselDetail | null;
  loading: boolean;
  error: string | null;
}) {
  const name = vessel.vesselName || 'Unknown vessel';

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--shell-accent)', lineHeight: 1.2, marginBottom: '2px' }}>{name}</div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '10px', fontFamily: 'var(--shell-font-mono)', letterSpacing: '1px' }}>
        MMSI: {vessel.mmsi}
      </div>

      <div className="detail-row"><div className="detail-label">Vessel Type</div><div className="detail-value">{vessel.vesselType || 'N/A'}</div></div>
      {vessel.callsign && <div className="detail-row"><div className="detail-label">Callsign</div><div className="detail-value">{vessel.callsign}</div></div>}
      {vessel.imo && <div className="detail-row"><div className="detail-label">IMO</div><div className="detail-value">{vessel.imo}</div></div>}
      {vessel.speedOverGround !== null && <div className="detail-row"><div className="detail-label">Speed Over Ground</div><div className="detail-value">{vessel.speedOverGround.toFixed(1)} kn</div></div>}
      {vessel.courseOverGround !== null && <div className="detail-row"><div className="detail-label">Course Over Ground</div><div className="detail-value">{vessel.courseOverGround.toFixed(1)}°</div></div>}
      {vessel.trueHeading !== null && <div className="detail-row"><div className="detail-label">True Heading</div><div className="detail-value">{vessel.trueHeading.toFixed(1)}°</div></div>}
      {vessel.navigationStatusText && <div className="detail-row"><div className="detail-label">Status</div><div className="detail-value">{vessel.navigationStatusText}</div></div>}
      {vessel.destination && <div className="detail-row"><div className="detail-label">Destination</div><div className="detail-value">{vessel.destination}</div></div>}
      {vessel.lengthMeters !== null && <div className="detail-row"><div className="detail-label">Length</div><div className="detail-value">{vessel.lengthMeters} m</div></div>}
      {vessel.widthMeters !== null && <div className="detail-row"><div className="detail-label">Width</div><div className="detail-value">{vessel.widthMeters} m</div></div>}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--shell-text-dim)', fontSize: '0.65rem', marginTop: '10px' }}>
          <span style={spinner} />
          Loading voyage details…
        </div>
      )}
      {error && <div style={{ color: '#f87171', fontSize: '0.6rem', marginTop: '10px' }}>Failed to load voyage details: {error}</div>}

      {detail && (
        <>
          {detail.draughtMeters !== null && <div className="detail-row"><div className="detail-label">Draught</div><div className="detail-value">{detail.draughtMeters.toFixed(2)} m</div></div>}
          {detail.etaDisplay && <div className="detail-row"><div className="detail-label">ETA</div><div className="detail-value">{detail.etaDisplay}</div></div>}
        </>
      )}

      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, marginBottom: '6px', color: 'var(--shell-accent)' }}>SOURCE & PROVENANCE</div>
        <div className="detail-row"><div className="detail-label">Source Attribution</div><div className="detail-value">AISStream</div></div>
        <div className="detail-row"><div className="detail-label">Source ID</div><div className="detail-value">{vessel.sourceId}</div></div>
        {vessel.dataAgeSeconds !== null && <div className="detail-row"><div className="detail-label">Data Age</div><div className="detail-value">{vessel.dataAgeSeconds}s</div></div>}
        <div className="detail-row"><div className="detail-label">Received At</div><div className="detail-value">{new Date(vessel.receivedAt).toLocaleTimeString()}</div></div>
      </div>

      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', opacity: 0.3, fontSize: '0.6rem', fontFamily: 'var(--shell-font-mono)' }}>
        SYSTEM ID: {vessel.id}
      </div>
    </div>
  );
}
