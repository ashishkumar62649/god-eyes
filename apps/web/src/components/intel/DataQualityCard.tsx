import React from 'react';
import { AirportDetailMetadata } from '@god-eyes/contracts';

interface DataQualityCardProps {
  sourceId: string;
  metadata: AirportDetailMetadata;
}

const DataQualityCard: React.FC<DataQualityCardProps> = ({ sourceId, metadata }) => {
  if (!sourceId && metadata.runwayCount === 0 && metadata.frequencyCount === 0 && metadata.nearbyNavaidCount === 0) {
    return null;
  }

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      padding: '12px',
      borderRadius: '6px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      fontSize: '0.7rem',
    }}>
      <div style={{
        fontSize: '0.55rem',
        color: 'var(--shell-text-dim)',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
      }}>
        Data Quality / Provenance
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {sourceId && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ opacity: 0.6 }}>Source</span>
            <span style={{ fontFamily: 'var(--shell-font-mono)' }}>{sourceId}</span>
          </div>
        )}
        {metadata.runwayCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ opacity: 0.6 }}>Runways</span>
            <span>{metadata.runwayCount}</span>
          </div>
        )}
        {metadata.frequencyCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ opacity: 0.6 }}>Frequencies</span>
            <span>{metadata.frequencyCount}</span>
          </div>
        )}
        {metadata.nearbyNavaidCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ opacity: 0.6 }}>Navaids</span>
            <span>{metadata.nearbyNavaidCount} (within {metadata.navaidRadiusKm}km)</span>
          </div>
        )}
        {metadata.generatedAt && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: '4px',
            paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)',
            opacity: 0.4, fontSize: '0.6rem',
          }}>
            <span>Generated</span>
            <span>{new Date(metadata.generatedAt).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataQualityCard;
