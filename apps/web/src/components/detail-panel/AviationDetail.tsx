import React, { useState } from 'react';
import type { AirportObject, AirportDetailResponse } from '@god-eyes/contracts';
import IntelSection from '../intel/IntelSection';
import RunwaysSection from '../intel/RunwaysSection';
import FrequenciesSection from '../intel/FrequenciesSection';
import NearbyNavaidsSection from '../intel/NearbyNavaidsSection';
import DataQualityCard from '../intel/DataQualityCard';
import AirportImageSlider from '../intel/AirportImageSlider';
import AirportLayoutOverlayToggle from '../intel/AirportLayoutOverlayToggle';
import type { PublicProfileData, PublicProfileAttribution } from '../../layers/layer_01_aviation/airports/airportPublicProfileTypes';
import type { AirportIntelImages } from '../../layers/layer_01_aviation/airports/airportIntelligenceTypes';
import type { LayoutPhase } from '../../layers/layer_01_aviation/airports/useAirportLayoutFeatures';
import { SourcesSection } from './SourcesSection';

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

function HeroImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img src={src} alt={alt} onError={() => setFailed(true)}
      style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px', marginBottom: '10px', display: 'block' }} />
  );
}

function IntelImageGallery({ images, airportName }: { images: AirportIntelImages; airportName: string }) {
  if (images.status !== 'ok') return null;
  const hero = images.heroImage;
  const rest = images.items.filter(i => !i.isHero);
  const sliderItems = hero ? [hero, ...rest] : images.items;
  if (sliderItems.length === 0) return null;
  return (
    <div style={{ marginBottom: '10px' }}>
      <AirportImageSlider items={sliderItems} height={160} fallbackCode={airportName} />
    </div>
  );
}

function AirportOverviewSection({
  airport, profile, profilePhase, onRetry, intelImages,
}: {
  airport: AirportObject;
  profile: PublicProfileData | null;
  profilePhase: string;
  onRetry: () => void;
  intelImages: AirportIntelImages | null;
}) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const imageUrl = profile?.facts ? (profile.facts['imageUrl'] ?? profile.facts['image'] ?? null) : null;
  const imageStr = typeof imageUrl === 'string' ? imageUrl : null;
  const openedRaw = profile?.facts ? (profile.facts['opened'] ?? profile.facts['openedDate'] ?? profile.facts['built'] ?? null) : null;
  const openedStr = openedRaw != null ? String(openedRaw) : null;
  const summary = profile?.summary ?? null;
  const displaySummary = summary && summary.length > 280 && !summaryExpanded ? summary.slice(0, 280) + '…' : summary;
  const hasIntelImages = intelImages?.status === 'ok' && (intelImages.heroImage != null || intelImages.items.length > 0);

  return (
    <div>
      {hasIntelImages && <IntelImageGallery images={intelImages!} airportName={airport.name} />}
      {!hasIntelImages && imageStr && <HeroImage src={imageStr} alt={`${airport.name} image`} />}

      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--shell-accent)', lineHeight: 1.2, marginBottom: '2px' }}>{airport.name}</div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '10px', fontFamily: 'var(--shell-font-mono)', letterSpacing: '1px' }}>
        {airport.ident}{airport.iataCode ? ` · ${airport.iataCode}` : ''}
      </div>

      {openedStr && <div className="detail-row"><div className="detail-label">Opened</div><div className="detail-value">{openedStr}</div></div>}

      {(profilePhase === 'loading' || profilePhase === 'fetching') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', ...dim, marginTop: '6px' }}>
          <span style={spinner} />Building public profile…
        </div>
      )}
      {profilePhase === 'error' && (
        <div style={{ ...dim, marginTop: '6px' }}>
          Public profile unavailable.{' '}
          <button style={{ ...ghostBtn, marginTop: 0, display: 'inline' }} onClick={onRetry}>Retry</button>
        </div>
      )}
      {profilePhase === 'no_profile_found' && <div style={{ ...dim, marginTop: '6px', fontStyle: 'italic' }}>No public profile found.</div>}
      {profilePhase === 'low_confidence' && <div style={{ color: '#eab308', fontSize: '0.65rem', marginTop: '6px' }}>⚠ Profile match uncertain — data may not correspond to this airport.</div>}

      {displaySummary && (
        <div style={{ fontSize: '0.7rem', lineHeight: 1.55, marginTop: '8px' }}>
          {displaySummary}
          {summary && summary.length > 280 && (
            <button onClick={() => setSummaryExpanded(e => !e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', ...accentLink, fontSize: '0.65rem' }}>
              {summaryExpanded ? 'Less' : 'More'}
            </button>
          )}
        </div>
      )}

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

// Error boundary for Intel sections
export class IntelBoundary extends React.Component<{ children: React.ReactNode }, { crashed: boolean }> {
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

export function AviationDetail({
  airport,
  airportDetail,
  detailLoading,
  detailError,
  layoutPhase,
  profile,
  profilePhase,
  onRetry,
  intelImages,
  attribution,
  fetchedAt,
}: {
  airport: AirportObject;
  airportDetail: AirportDetailResponse | null;
  detailLoading: boolean;
  detailError: string | null;
  layoutPhase: LayoutPhase;
  profile: PublicProfileData | null;
  profilePhase: string;
  onRetry: () => void;
  intelImages: AirportIntelImages | null;
  attribution: PublicProfileAttribution | null | undefined;
  fetchedAt: string | null | undefined;
}) {
  return (
    <IntelBoundary key={airport.id}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <IntelSection title="Overview">
          <AirportOverviewSection
            airport={airport}
            profile={profile}
            profilePhase={profilePhase}
            onRetry={onRetry}
            intelImages={intelImages}
          />
        </IntelSection>

        <div style={{ padding: '0 0 8px 0' }}>
          <AirportLayoutOverlayToggle layoutPhase={layoutPhase} />
        </div>

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
              <DataQualityCard sourceId={airport.sourceId} metadata={airportDetail.metadata} />
            </IntelSection>
          </>
        )}

        <IntelSection title="Sources & Details" collapsible defaultOpen={false}>
          <SourcesSection attribution={attribution} fetchedAt={fetchedAt} />
        </IntelSection>

        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', opacity: 0.3, fontSize: '0.6rem', fontFamily: 'var(--shell-font-mono)' }}>
          SYSTEM ID: {airport.id}
        </div>
      </div>
    </IntelBoundary>
  );
}
