import React, { useState } from 'react';
import { AirportObject, AirportDetailResponse } from '@god-eyes/contracts';
import IntelSection from './intel/IntelSection';
import RunwaysSection from './intel/RunwaysSection';
import FrequenciesSection from './intel/FrequenciesSection';
import NearbyNavaidsSection from './intel/NearbyNavaidsSection';
import DataQualityCard from './intel/DataQualityCard';
import { useAirportPublicProfile } from '../lib/useAirportPublicProfile';
import type { PublicProfileData, PublicProfileAttribution } from '../lib/airportPublicProfileTypes';

interface DetailPanelProps {
  selectedObject: AirportObject | null;
  airportDetail: AirportDetailResponse | null;
  detailLoading: boolean;
  detailError: string | null;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

// ── error boundary ────────────────────────────────────────────────────────────
class IntelBoundary extends React.Component<
  { children: React.ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(err: Error) { console.error('[IntelBoundary]', err); }
  render() {
    if (this.state.crashed) {
      return <div style={{ padding: '16px', fontSize: '0.65rem', color: 'var(--shell-text-dim)', textAlign: 'center' }}>Object Intel unavailable.</div>;
    }
    return this.props.children;
  }
}

// ── shared styles ─────────────────────────────────────────────────────────────
const dim: React.CSSProperties = { color: 'var(--shell-text-dim)', fontSize: '0.65rem' };
const accentLink: React.CSSProperties = { color: 'var(--shell-accent)', textDecoration: 'none' };
const ghostBtn: React.CSSProperties = {
  background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px',
  cursor: 'pointer', padding: '3px 8px', color: 'var(--shell-text-dim)', fontSize: '0.65rem', marginTop: '6px',
};
const spinner: React.CSSProperties = {
  display: 'inline-block', width: '8px', height: '8px',
  border: '2px solid var(--shell-text-dim)', borderTopColor: 'var(--shell-accent)',
  borderRadius: '50%', animation: 'spin 1s linear infinite',
};

// ── hero image ────────────────────────────────────────────────────────────────
function HeroImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      style={{
        width: '100%', height: '120px', objectFit: 'cover',
        borderRadius: '4px', marginBottom: '10px', display: 'block',
      }}
    />
  );
}

// ── overview section ──────────────────────────────────────────────────────────
function AirportOverviewSection({
  airport,
  profile,
  profilePhase,
  onRetry,
}: {
  airport: AirportObject;
  profile: PublicProfileData | null;
  profilePhase: string;
  onRetry: () => void;
}) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Image: prefer facts.imageUrl, then facts.image
  const imageUrl = profile?.facts
    ? (profile.facts['imageUrl'] ?? profile.facts['image'] ?? null)
    : null;
  const imageStr = typeof imageUrl === 'string' ? imageUrl : null;

  // Opened/built date from facts
  const openedRaw = profile?.facts
    ? (profile.facts['opened'] ?? profile.facts['openedDate'] ?? profile.facts['built'] ?? null)
    : null;
  const openedStr = openedRaw != null ? String(openedRaw) : null;

  const summary = profile?.summary ?? null;
  const displaySummary = summary && summary.length > 280 && !summaryExpanded
    ? summary.slice(0, 280) + '…'
    : summary;

  return (
    <div>
      {imageStr && <HeroImage src={imageStr} alt={`${airport.name} image`} />}

      {/* Name + codes */}
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--shell-accent)', lineHeight: 1.2, marginBottom: '2px' }}>
        {airport.name}
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '10px', fontFamily: 'var(--shell-font-mono)', letterSpacing: '1px' }}>
        {airport.ident}{airport.iataCode ? ` · ${airport.iataCode}` : ''}
      </div>

      {/* Opened date */}
      {openedStr && (
        <div className="detail-row">
          <div className="detail-label">Opened</div>
          <div className="detail-value">{openedStr}</div>
        </div>
      )}

      {/* Profile summary / status */}
      {(profilePhase === 'loading' || profilePhase === 'fetching') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', ...dim, marginTop: '6px' }}>
          <span style={spinner} />
          Building public profile…
        </div>
      )}

      {profilePhase === 'error' && (
        <div style={{ ...dim, marginTop: '6px' }}>
          Public profile unavailable.{' '}
          <button style={{ ...ghostBtn, marginTop: 0, display: 'inline' }} onClick={onRetry}>Retry</button>
        </div>
      )}

      {profilePhase === 'no_profile_found' && (
        <div style={{ ...dim, marginTop: '6px', fontStyle: 'italic' }}>No public profile found.</div>
      )}

      {profilePhase === 'low_confidence' && (
        <div style={{ color: '#eab308', fontSize: '0.65rem', marginTop: '6px' }}>
          ⚠ Profile match uncertain — data may not correspond to this airport.
        </div>
      )}

      {displaySummary && (
        <div style={{ fontSize: '0.7rem', lineHeight: 1.55, marginTop: '8px' }}>
          {displaySummary}
          {summary && summary.length > 280 && (
            <button
              onClick={() => setSummaryExpanded(e => !e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', ...accentLink, fontSize: '0.65rem' }}
            >
              {summaryExpanded ? 'Less' : 'More'}
            </button>
          )}
        </div>
      )}

      {/* Key facts from profile (excluding image/opened already shown) */}
      {profile?.facts && (() => {
        const skip = new Set(['imageUrl', 'image', 'opened', 'openedDate', 'built']);
        const entries = Object.entries(profile.facts).filter(([k]) => !skip.has(k));
        if (entries.length === 0) return null;
        return (
          <div style={{ marginTop: '10px' }}>
            {entries.map(([k, v]) => (
              <div key={k} className="detail-row">
                <div className="detail-label">{k}</div>
                <div className="detail-value">{String(v)}</div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ── sources section ───────────────────────────────────────────────────────────
function SourcesSection({
  attribution,
  fetchedAt,
}: {
  attribution: PublicProfileAttribution | null | undefined;
  fetchedAt: string | null | undefined;
}) {
  if (!attribution && !fetchedAt) {
    return <div style={{ ...dim, fontStyle: 'italic' }}>Source attribution unavailable.</div>;
  }

  const src = typeof attribution?.source === 'string' ? attribution.source.toLowerCase() : '';

  return (
    <div style={{ fontSize: '0.65rem', lineHeight: 1.6 }}>
      {attribution ? (
        <>
          <div style={dim}>
            📋 {attribution.source}
            {attribution.matchMethod ? ` · ${attribution.matchMethod}` : ''}
            {attribution.matchConfidence ? ` (${attribution.matchConfidence})` : ''}
          </div>
          {src.includes('wikipedia') && (
            <div style={{ marginTop: '4px', ...dim }}>
              Text available under{' '}
              <a
                href="https://en.wikipedia.org/wiki/Wikipedia:Text_of_the_Creative_Commons_Attribution-ShareAlike_4.0_International_License"
                target="_blank" rel="noopener noreferrer" style={accentLink}
              >
                Creative Commons Attribution-ShareAlike License
              </a>
            </div>
          )}
          {src.includes('wikidata') && (
            <div style={{ marginTop: '4px', ...dim }}>Data from Wikidata (CC0).</div>
          )}
        </>
      ) : (
        <div style={{ ...dim, fontStyle: 'italic' }}>Source attribution unavailable.</div>
      )}
      {fetchedAt && (
        <div style={{ ...dim, marginTop: '4px', opacity: 0.5 }}>
          Last checked: {new Date(fetchedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ── main panel ────────────────────────────────────────────────────────────────
const DetailPanel: React.FC<DetailPanelProps> = ({
  selectedObject,
  airportDetail,
  detailLoading,
  detailError,
  isCollapsed,
  setIsCollapsed,
}) => {
  const { state: profileState, retry } = useAirportPublicProfile(selectedObject?.id ?? null);

  const profile =
    profileState.phase === 'ok' || profileState.phase === 'stale' || profileState.phase === 'low_confidence'
      ? profileState.data
      : null;

  const attribution =
    profileState.phase === 'ok' || profileState.phase === 'stale' || profileState.phase === 'low_confidence'
      ? profileState.attribution
      : null;

  const fetchedAt =
    profileState.phase === 'ok' || profileState.phase === 'stale'
      ? profileState.fetchedAt
      : null;

  const headerContent = detailLoading ? (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ ...spinner, width: '10px', height: '10px' }} />
      Object Intel
    </span>
  ) : 'Object Intel';

  return (
    <aside className={`shell-panel shell-panel-right shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="panel-header">
        <button className="panel-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '\u00AB' : '\u00BB'}
        </button>
        {!isCollapsed && headerContent}
      </div>

      {isCollapsed ? (
        <div className="collapsed-label">INTEL</div>
      ) : (
        <div className="panel-content">
          {!selectedObject ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: 'var(--shell-text-dim)', fontSize: '0.75rem',
              letterSpacing: '1px', textAlign: 'center', padding: '0 20px',
            }}>
              <div style={{ opacity: 0.5, marginBottom: '16px', fontSize: '2rem' }}>{'\u2316'}</div>
              SELECT AN AIRPORT OR SEARCH TO INSPECT OBJECT INTELLIGENCE
            </div>
          ) : (
            <IntelBoundary key={selectedObject.id}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>

                {/* ── OVERVIEW (merged with public profile) ── */}
                <IntelSection title="Overview">
                  <AirportOverviewSection
                    airport={selectedObject}
                    profile={profile}
                    profilePhase={profileState.phase}
                    onRetry={retry}
                  />
                </IntelSection>

                {/* ── RUNWAYS / FREQUENCIES / NAVAIDS ── */}
                {detailError && !detailLoading && (
                  <div style={{ padding: '8px 0', fontSize: '0.6rem', color: '#f87171', textAlign: 'center' }}>
                    {detailError.includes('Failed to fetch') ? 'Offline — details unavailable' : detailError}
                  </div>
                )}

                {airportDetail && (
                  <>
                    <RunwaysSection runways={airportDetail.runways} />
                    <FrequenciesSection frequencies={airportDetail.frequencies} />
                    <NearbyNavaidsSection navaids={airportDetail.nearbyNavaids} />
                    <IntelSection title="">
                      <DataQualityCard
                        sourceId={selectedObject.sourceId}
                        metadata={airportDetail.metadata}
                      />
                    </IntelSection>
                  </>
                )}

                {/* ── SOURCES & DETAILS ── */}
                <IntelSection title="Sources & Details" collapsible defaultOpen={false}>
                  <SourcesSection attribution={attribution} fetchedAt={fetchedAt} />
                </IntelSection>

                <div style={{
                  marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)',
                  paddingTop: '20px', opacity: 0.3, fontSize: '0.6rem',
                  fontFamily: 'var(--shell-font-mono)',
                }}>
                  SYSTEM ID: {selectedObject.id}
                </div>
              </div>
            </IntelBoundary>
          )}
        </div>
      )}
    </aside>
  );
};

export default DetailPanel;
