import React, { useState } from 'react';
import type { AirportObject } from '@god-eyes/contracts';
import { useAirportIntelligence } from '../../lib/useAirportIntelligence';
import type { AirportIntelMapPopup } from '../../lib/airportIntelligenceTypes';

interface AirportMapPopupProps {
  airport: AirportObject;
  /** Screen-space position in pixels from top-left of the globe container */
  screenX: number;
  screenY: number;
  onClose: () => void;
}

// ── small spinner ─────────────────────────────────────────────────────────────
const spinnerStyle: React.CSSProperties = {
  display: 'inline-block', width: '8px', height: '8px',
  border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#00d2ff',
  borderRadius: '50%', animation: 'popup-spin 0.8s linear infinite',
};

// ── badge chip ────────────────────────────────────────────────────────────────
function Badge({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: '10px',
      background: 'rgba(0,210,255,0.12)', border: '1px solid rgba(0,210,255,0.3)',
      color: '#00d2ff', fontSize: '0.6rem', letterSpacing: '0.5px',
      fontFamily: 'var(--shell-font-mono)', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── hero image with fallback ──────────────────────────────────────────────────
function PopupImage({ src, code }: { src: string | null; code: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div style={{
        width: '100%', height: '90px', borderRadius: '5px', marginBottom: '10px',
        background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--shell-font-mono)', fontSize: '1.1rem', color: 'rgba(255,255,255,0.25)',
        letterSpacing: '2px',
      }}>
        {code}
      </div>
    );
  }
  return (
    <img
      src={src} alt={code}
      onError={() => setFailed(true)}
      style={{
        width: '100%', height: '90px', objectFit: 'cover',
        borderRadius: '5px', marginBottom: '10px', display: 'block',
      }}
    />
  );
}

// ── stat row ──────────────────────────────────────────────────────────────────
function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.6rem', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ color: '#e0e0e0', fontSize: '0.65rem', fontFamily: 'var(--shell-font-mono)' }}>{value}</span>
    </div>
  );
}

// ── popup content when data is loaded ────────────────────────────────────────
function PopupContent({ popup, airport }: { popup: AirportIntelMapPopup; airport: AirportObject }) {
  const code = popup.iataCode ?? popup.icaoCode ?? airport.ident ?? '';
  const codes = [popup.iataCode, popup.icaoCode].filter(Boolean).join(' / ');
  const location = [popup.city, popup.country].filter(Boolean).join(', ');

  const badges = popup.badges?.length
    ? popup.badges
    : [];

  const openedLabel = popup.openedDate ?? (popup.openedYear ? String(popup.openedYear) : null);

  return (
    <>
      <PopupImage src={popup.imageUrl} code={code} />

      {/* Name */}
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: '2px' }}>
        {popup.airportName || airport.name}
      </div>

      {/* Codes */}
      {codes && (
        <div style={{ fontSize: '0.65rem', color: '#00d2ff', fontFamily: 'var(--shell-font-mono)', letterSpacing: '1px', marginBottom: '4px' }}>
          {codes}
        </div>
      )}

      {/* City / Country */}
      {location && (
        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
          {location}
        </div>
      )}

      {/* Short summary — max 2 lines via CSS */}
      {popup.shortSummary && (
        <div style={{
          fontSize: '0.65rem', lineHeight: 1.5, color: 'rgba(255,255,255,0.7)',
          marginBottom: '8px',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {popup.shortSummary}
        </div>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
          {badges.map((b: string) => <Badge key={b} label={b} />)}
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '6px 0' }} />

      {/* Quick stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <StatRow label="Opened" value={openedLabel ?? 'Not confirmed'} />
        {popup.runwayCount != null && (
          <StatRow label="Runways" value={popup.runwayCount} />
        )}
        {popup.longestRunwayFt != null && (
          <StatRow label="Longest runway" value={`${popup.longestRunwayFt.toLocaleString()} ft`} />
        )}
      </div>

      {/* Confidence */}
      {popup.confidenceLabel && (
        <div style={{
          marginTop: '8px', fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)',
          fontFamily: 'var(--shell-font-mono)', letterSpacing: '0.5px',
        }}>
          {popup.confidenceLabel}
        </div>
      )}
    </>
  );
}

// ── main popup ────────────────────────────────────────────────────────────────
const AirportMapPopup: React.FC<AirportMapPopupProps> = ({ airport, screenX, screenY, onClose }) => {
  const intel = useAirportIntelligence(airport.id);

  // Popup width; position it above and to the right of the dot
  const POPUP_WIDTH = 220;
  const OFFSET_X = 12;
  const OFFSET_Y = 12;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: screenX + OFFSET_X,
    top: screenY - OFFSET_Y,
    transform: 'translateY(-100%)',
    width: POPUP_WIDTH,
    background: 'rgba(5,7,10,0.92)',
    border: '1px solid rgba(0,210,255,0.25)',
    borderRadius: '8px',
    boxShadow: '0 0 20px rgba(0,210,255,0.12), 0 8px 32px rgba(0,0,0,0.7)',
    padding: '12px',
    zIndex: 500,
    pointerEvents: 'auto',
    backdropFilter: 'blur(16px)',
    fontFamily: 'var(--shell-font-family)',
    color: 'var(--shell-text)',
    // Connector line via pseudo-element is not possible in inline styles;
    // we use a small triangle via a border trick on a child div instead.
  };

  // Small caret pointing down toward the airport dot
  const caretStyle: React.CSSProperties = {
    position: 'absolute', bottom: '-6px', left: '20px',
    width: 0, height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '6px solid rgba(0,210,255,0.25)',
  };

  return (
    <>
      <style>{`@keyframes popup-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={style}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '6px', right: '8px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', lineHeight: 1,
            padding: '2px 4px',
          }}
          aria-label="Close popup"
        >
          ✕
        </button>

        {/* Content */}
        {intel.phase === 'loading' && (
          <div>
            {/* Show base info immediately while loading */}
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
              {airport.name}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#00d2ff', fontFamily: 'var(--shell-font-mono)', letterSpacing: '1px', marginBottom: '8px' }}>
              {airport.ident}{airport.iataCode ? ` · ${airport.iataCode}` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>
              <span style={spinnerStyle} />
              Loading intelligence…
            </div>
          </div>
        )}

        {intel.phase === 'ok' && intel.data.mapPopup && (
          <PopupContent popup={intel.data.mapPopup} airport={airport} />
        )}

        {intel.phase === 'ok' && !intel.data.mapPopup && (
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{airport.name}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
              Partial data — no popup summary available.
            </div>
          </div>
        )}

        {intel.phase === 'no_data' && (
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{airport.name}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
              No intelligence data available.
            </div>
          </div>
        )}

        {intel.phase === 'not_found' && (
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{airport.name}</div>
            <div style={{ fontSize: '0.65rem', color: '#f87171' }}>Airport intelligence not found.</div>
          </div>
        )}

        {(intel.phase === 'unavailable' || intel.phase === 'error') && (
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{airport.name}</div>
            <div style={{ fontSize: '0.65rem', color: '#f87171' }}>
              {intel.phase === 'unavailable' ? 'Airport intelligence unavailable.' : intel.message}
            </div>
          </div>
        )}

        {intel.phase === 'idle' && (
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{airport.name}</div>
        )}

        <div style={caretStyle} />
      </div>
    </>
  );
};

export default AirportMapPopup;
