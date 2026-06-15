export function DetailEmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', color: 'var(--shell-text-dim)', fontSize: '0.75rem',
      letterSpacing: '1px', textAlign: 'center', padding: '0 20px',
    }}>
      <div style={{ opacity: 0.5, marginBottom: '16px', fontSize: '2rem' }}>{'\u2316'}</div>
      SELECT AN OBJECT OR SEARCH TO INSPECT OBJECT INTELLIGENCE
      <div style={{ marginTop: '12px', fontSize: '0.6rem', opacity: 0.45, letterSpacing: '0.5px', lineHeight: 1.6 }}>
        Enable layers in the operations panel<br />to explore global intelligence features.
      </div>
    </div>
  );
}
