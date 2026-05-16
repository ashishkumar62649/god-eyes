import React from 'react';
import { RunwayDetail } from '@god-eyes/contracts';
import IntelSection from './IntelSection';

const DISPLAY_LIMIT = 10;

const styles: Record<string, React.CSSProperties> = {
  item: {
    padding: '8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  ident: {
    fontWeight: 700,
    color: 'var(--shell-accent)',
  },
  detail: {
    fontSize: '0.6rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 0',
  },
  label: {
    opacity: 0.6,
  },
  value: {},
  endpoint: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.55rem',
    padding: '2px 0',
    opacity: 0.7,
  },
  more: {
    padding: '8px',
    textAlign: 'center',
    fontSize: '0.6rem',
    color: 'var(--shell-text-dim)',
    fontStyle: 'italic',
  },
  empty: {
    padding: '12px',
    fontSize: '0.65rem',
    color: 'var(--shell-text-dim)',
    textAlign: 'center',
  },
  badge: {
    fontSize: '0.55rem',
    padding: '1px 5px',
    borderRadius: '3px',
    fontWeight: 700,
  },
};

interface RunwaysSectionProps {
  runways: RunwayDetail[];
}

const RunwaysSection: React.FC<RunwaysSectionProps> = ({ runways }) => {
  const displayed = runways.slice(0, DISPLAY_LIMIT);
  const remaining = runways.length - DISPLAY_LIMIT;

  const formatLength = (ft: number | null): string => {
    if (ft === null) return '\u2014';
    return `${ft.toLocaleString()} FT`;
  };

  const formatCoords = (lat: number | null, lon: number | null): string | null => {
    if (lat === null || lon === null) return null;
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  };

  return (
    <IntelSection title="Runways" collapsible defaultOpen={false}>
      {runways.length === 0 ? (
        <div style={styles.empty}>No runway data available</div>
      ) : (
        <>
          {displayed.map((rw) => (
            <div key={rw.id} style={styles.item}>
              <div style={styles.header}>
                <span style={styles.ident}>{rw.ident}</span>
                {rw.closed && (
                  <span style={{ ...styles.badge, background: 'rgba(248, 113, 113, 0.15)', color: '#f87171' }}>
                    CLOSED
                  </span>
                )}
                {rw.lighted && (
                  <span style={{ ...styles.badge, background: 'rgba(250, 204, 21, 0.15)', color: '#facc15' }}>
                    LIGHTED
                  </span>
                )}
              </div>
              <div style={styles.detail}>
                <div style={styles.row}>
                  <span style={styles.label}>Length</span>
                  <span>{formatLength(rw.lengthFt)}</span>
                </div>
                <div style={styles.row}>
                  <span style={styles.label}>Width</span>
                  <span>{rw.widthFt !== null ? `${rw.widthFt} FT` : '\u2014'}</span>
                </div>
                <div style={styles.row}>
                  <span style={styles.label}>Surface</span>
                  <span>{rw.surface || '\u2014'}</span>
                </div>
                {rw.leIdent && (
                  <div style={styles.endpoint}>
                    <span>LE: {rw.leIdent}</span>
                    <span>{formatCoords(rw.leLatitude, rw.leLongitude) ?? '\u2014'}</span>
                  </div>
                )}
                {rw.heIdent && (
                  <div style={styles.endpoint}>
                    <span>HE: {rw.heIdent}</span>
                    <span>{formatCoords(rw.heLatitude, rw.heLongitude) ?? '\u2014'}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {remaining > 0 && (
            <div style={styles.more}>+{remaining} more runway{remaining > 1 ? 's' : ''}</div>
          )}
        </>
      )}
    </IntelSection>
  );
};

export default RunwaysSection;
