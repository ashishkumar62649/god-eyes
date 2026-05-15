import React from 'react';
import { AirportObject } from '@god-eyes/contracts';

interface CoordinateSourceCardProps {
  airport: AirportObject;
}

const CoordinateSourceCard: React.FC<CoordinateSourceCardProps> = ({ airport }) => {
  return (
    <div className="coordinate-source-card" style={{ 
      background: 'rgba(255, 255, 255, 0.03)', 
      padding: '16px', 
      borderRadius: '6px',
      border: '1px solid rgba(255, 255, 255, 0.05)'
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="detail-row" style={{ marginBottom: 0 }}>
          <div className="detail-label" style={{ fontSize: '0.55rem' }}>Latitude</div>
          <div className="detail-value" style={{ fontSize: '0.75rem' }}>{airport.position.latitude?.toFixed(6)}°</div>
        </div>
        <div className="detail-row" style={{ marginBottom: 0 }}>
          <div className="detail-label" style={{ fontSize: '0.55rem' }}>Longitude</div>
          <div className="detail-value" style={{ fontSize: '0.75rem' }}>{airport.position.longitude?.toFixed(6)}°</div>
        </div>
      </div>
      
      <div className="detail-row" style={{ marginTop: '16px', marginBottom: '16px' }}>
        <div className="detail-label" style={{ fontSize: '0.55rem' }}>Elevation</div>
        <div className="detail-value" style={{ fontSize: '0.75rem' }}>
          {airport.elevationFt !== null ? `${airport.elevationFt.toLocaleString()} FT` : '—'}
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', marginTop: '12px' }}>
        <div style={{ fontSize: '0.6rem', color: 'var(--shell-text-dim)', marginBottom: '4px' }}>
          COORDINATE SOURCE
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--shell-text-bright)' }}>Source Coordinates</span>
          <span style={{ 
            fontSize: '0.55rem', 
            background: 'rgba(0, 210, 255, 0.1)', 
            color: 'var(--shell-accent)', 
            padding: '2px 6px', 
            borderRadius: '4px',
            fontWeight: 700
          }}>
            VERIFIED
          </span>
        </div>
        <div style={{ fontSize: '0.6rem', opacity: 0.4, marginTop: '8px', fontStyle: 'italic' }}>
          Coordinate overrides supported by API but not enabled in UI.
        </div>
      </div>
    </div>
  );
};

export default CoordinateSourceCard;
