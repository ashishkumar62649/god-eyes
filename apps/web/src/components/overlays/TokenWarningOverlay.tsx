export function TokenWarningOverlay() {
  return (
    <div style={{
      position: 'absolute', top: '74px', left: '20px',
      background: 'rgba(255, 165, 0, 0.2)',
      border: '1px solid rgba(255, 165, 0, 0.4)', color: '#ff8c00',
      padding: '6px 12px', borderRadius: '4px', fontSize: '0.7rem',
      zIndex: 1000, pointerEvents: 'none',
      fontFamily: 'JetBrains Mono, monospace', letterSpacing: '1px',
    }}>
      SYSTEM WARNING: CESIUM_ION_TOKEN_ABSENT
    </div>
  );
}
