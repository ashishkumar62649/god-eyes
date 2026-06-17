import React from 'react';
import type { LayoutPhase } from '../../layers/layer_01_aviation/airports/useAirportLayoutFeatures';

interface AirportLayoutOverlayToggleProps {
  layoutPhase: LayoutPhase;
}

const AirportLayoutOverlayToggle: React.FC<AirportLayoutOverlayToggleProps> = ({ layoutPhase }) => {
  if (layoutPhase.phase === 'idle' || layoutPhase.phase === 'no_data') return null;

  const runwayCount =
    layoutPhase.phase === 'ok'
      ? (layoutPhase.data.summary?.byType?.runway ?? 0)
      : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 8px', borderRadius: '3px',
      background: 'rgba(0,200,120,0.08)',
      border: '1px solid rgba(0,200,120,0.25)',
      fontSize: '0.65rem', fontFamily: 'var(--shell-font-mono)',
      color: 'var(--shell-text-dim)', letterSpacing: '0.5px',
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: layoutPhase.phase === 'ok' ? '#00c878' : '#888',
        flexShrink: 0,
      }} />
      <span>Layout overlay</span>
      {layoutPhase.phase === 'loading' && <span style={{ opacity: 0.5 }}>…</span>}
      {layoutPhase.phase === 'ok' && runwayCount != null && runwayCount > 0 && (
        <span style={{ color: '#00c878' }}>· Runways: {runwayCount}</span>
      )}
      {layoutPhase.phase === 'error' && (
        <span style={{ color: '#f87171' }}>· unavailable</span>
      )}
    </div>
  );
};

export default AirportLayoutOverlayToggle;
