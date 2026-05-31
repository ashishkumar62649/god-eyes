import React from 'react';
import { AirportObject } from '@god-eyes/contracts';
import { getCategoryLabel } from '../../layers/aviation/airports/aviationCategories';

interface AirportOverviewProps {
  airport: AirportObject;
}

const AirportOverview: React.FC<AirportOverviewProps> = ({ airport }) => {
  return (
    <div className="airport-overview">
      <div style={{
        fontSize: '1.2rem',
        fontWeight: 700,
        color: 'var(--shell-accent)',
        marginBottom: '4px',
        lineHeight: 1.2,
      }}>
        {airport.name}
      </div>

      <div style={{
        fontSize: '0.8rem',
        opacity: 0.8,
        marginBottom: '20px',
        fontFamily: 'var(--shell-font-mono)',
        letterSpacing: '1px',
      }}>
        {airport.ident} {airport.iataCode ? `· ${airport.iataCode}` : ''}
      </div>

      <div className="detail-row">
        <div className="detail-label">Category</div>
        <div className="detail-value">{getCategoryLabel(airport)}</div>
      </div>

      <div className="detail-row">
        <div className="detail-label">Location</div>
        <div className="detail-value">
          {airport.municipality ? `${airport.municipality}, ` : ''}
          {airport.region ? `${airport.region}, ` : ''}
          {airport.country}
        </div>
      </div>

      <div className="detail-row">
        <div className="detail-label">Source System</div>
        <div className="detail-value">{airport.sourceId}</div>
      </div>

      {airport.updatedAt && (
        <div className="detail-row">
          <div className="detail-label">Last Synchronized</div>
          <div className="detail-value" style={{ fontSize: '0.7rem' }}>
            {new Date(airport.updatedAt).toUTCString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default AirportOverview;
