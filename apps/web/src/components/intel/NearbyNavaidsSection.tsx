import React from 'react';
import { NavaidDetail } from '@god-eyes/contracts';
import IntelSection from './IntelSection';

const DISPLAY_LIMIT = 20;

const styles: Record<string, React.CSSProperties> = {
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    fontSize: '0.6rem',
  },
  icon: {
    fontSize: '0.8rem',
    color: 'var(--shell-accent)',
    width: '16px',
    textAlign: 'center',
  },
  info: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  ident: {
    fontWeight: 600,
  },
  name: {
    opacity: 0.6,
    fontSize: '0.55rem',
  },
  details: {
    textAlign: 'right',
  },
  navType: {
    display: 'block',
    opacity: 0.7,
    fontSize: '0.5rem',
  },
  freq: {
    fontFamily: 'var(--shell-font-mono)',
  },
  distance: {
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
};

function getTypeIcon(type: string): string {
  const t = type.toUpperCase();
  if (t.includes('VOR')) return '\u25C9';
  if (t.includes('NDB')) return '\u25CE';
  if (t.includes('TACAN')) return '\u25C8';
  return '\u25C7';
}

function formatFrequency(khz: number | null, type: string): string {
  if (khz === null) return '\u2014';
  const t = type.toUpperCase();
  if (t.includes('VOR')) {
    return `${(khz / 1000).toFixed(2)} MHz`;
  }
  return `${khz} KHz`;
}

interface NearbyNavaidsSectionProps {
  navaids: NavaidDetail[];
}

const NearbyNavaidsSection: React.FC<NearbyNavaidsSectionProps> = ({ navaids }) => {
  const displayed = navaids.slice(0, DISPLAY_LIMIT);
  const remaining = navaids.length - DISPLAY_LIMIT;

  return (
    <IntelSection title="Nearby Navaids" collapsible defaultOpen={false}>
      {navaids.length === 0 ? (
        <div style={styles.empty}>No navaids within search radius</div>
      ) : (
        <>
          {displayed.map((nav) => (
            <div key={nav.id} style={styles.item}>
              <span style={styles.icon}>{getTypeIcon(nav.type)}</span>
              <div style={styles.info}>
                <span style={styles.ident}>{nav.ident}</span>
                <span style={styles.name}>{nav.name}</span>
              </div>
              <div style={styles.details}>
                <span style={styles.navType}>{nav.type}</span>
                <span style={styles.freq}>{formatFrequency(nav.frequencyKhz, nav.type)}</span>
                <span style={styles.distance}>
                  {nav.distanceKm !== null ? `${nav.distanceKm.toFixed(1)} KM` : '\u2014'}
                </span>
              </div>
            </div>
          ))}
          {remaining > 0 && (
            <div style={styles.more}>+{remaining} more navaids</div>
          )}
        </>
      )}
    </IntelSection>
  );
};

export default NearbyNavaidsSection;
