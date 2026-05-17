import React from 'react';
import { FrequencyDetail } from '@god-eyes/contracts';
import IntelSection from './IntelSection';

const DISPLAY_LIMIT = 10;

const styles: Record<string, React.CSSProperties> = {
  item: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '6px 8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    fontSize: '0.65rem',
  },
  type: {
    fontWeight: 600,
    minWidth: '70px',
  },
  freq: {
    fontFamily: 'var(--shell-font-mono)',
  },
  desc: {
    width: '100%',
    opacity: 0.6,
    fontSize: '0.55rem',
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

const typeColors: Record<string, string> = {
  ATIS: 'var(--shell-accent)',
  TOWER: '#4ade80',
  APPROACH: '#facc15',
  GROUND: '#60a5fa',
  CLEARANCE: '#c084fc',
};

function getTypeColor(type: string): string {
  const t = type.toUpperCase();
  for (const [key, color] of Object.entries(typeColors)) {
    if (t.includes(key)) return color;
  }
  return 'var(--shell-text-bright)';
}

interface FrequenciesSectionProps {
  frequencies: FrequencyDetail[];
}

const FrequenciesSection: React.FC<FrequenciesSectionProps> = ({ frequencies }) => {
  const displayed = frequencies.slice(0, DISPLAY_LIMIT);
  const remaining = frequencies.length - DISPLAY_LIMIT;

  return (
    <IntelSection title="Frequencies" collapsible defaultOpen={false}>
      {frequencies.length === 0 ? (
        <div style={styles.empty}>No frequency data available</div>
      ) : (
        <>
          {displayed.map((freq) => (
            <div key={freq.id} style={styles.item}>
              <span style={{ ...styles.type, color: getTypeColor(freq.type) }}>
                {freq.type}
              </span>
              <span style={styles.freq}>
                {freq.frequencyMhz !== null ? `${freq.frequencyMhz.toFixed(3)} MHz` : '\u2014'}
              </span>
              {freq.description && <span style={styles.desc}>{freq.description}</span>}
            </div>
          ))}
          {remaining > 0 && (
            <div style={styles.more}>+{remaining} more frequency{remaining > 1 ? 'ies' : 'y'}</div>
          )}
        </>
      )}
    </IntelSection>
  );
};

export default FrequenciesSection;
