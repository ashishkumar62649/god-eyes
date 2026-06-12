import React, { useState } from 'react';
import { AirportObject, AirportDetailResponse, MaritimeVesselObject, MaritimeVesselDetail } from '@god-eyes/contracts';
import IntelSection from './intel/IntelSection';
import RunwaysSection from './intel/RunwaysSection';
import FrequenciesSection from './intel/FrequenciesSection';
import NearbyNavaidsSection from './intel/NearbyNavaidsSection';
import DataQualityCard from './intel/DataQualityCard';
import AirportImageSlider from './intel/AirportImageSlider';
import { useAirportPublicProfile } from '../layers/aviation/airports/useAirportPublicProfile';
import { useAirportIntelligence } from '../layers/aviation/airports/useAirportIntelligence';
import type { PublicProfileData, PublicProfileAttribution } from '../layers/aviation/airports/airportPublicProfileTypes';
import type { AirportIntelImages } from '../layers/aviation/airports/airportIntelligenceTypes';
import AirportLayoutOverlayToggle from './intel/AirportLayoutOverlayToggle';
import type { LayoutPhase } from '../layers/aviation/airports/useAirportLayoutFeatures';
import type { EnergyFeature } from '../layers/energy/infrastructure/energyInfrastructureTypes';
import type { WeatherRenderItem } from '../layers/layer_07_weather/weatherTypes';
import {
  formatMeasurement,
  formatWindDirection,
  formatTimestamp,
  formatCondition,
} from '../layers/layer_07_weather/weatherDetail';
import type { NewsRenderMarker } from '../layers/layer_08_news_osint/newsTypes';
import {
  formatNewsTimestamp,
  formatNewsSeverity,
  formatNewsCountry,
  orDash,
} from '../layers/layer_08_news_osint/newsDetail';

interface DetailPanelProps {
  selectedObject: AirportObject | MaritimeVesselObject | null;
  airportDetail: AirportDetailResponse | null;
  detailLoading: boolean;
  detailError: string | null;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  layoutPhase: LayoutPhase;
  selectedEnergyFeature: EnergyFeature | null;
  onEnergyFeatureClose: () => void;
  vesselDetail: MaritimeVesselDetail | null;
  selectedWeatherItem: WeatherRenderItem | null;
  onWeatherClose: () => void;
  selectedNewsItem: NewsRenderMarker | null;
  onNewsClose: () => void;
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

// ── intel image gallery (larger, for panel) ───────────────────────────────────
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

// ── overview section ──────────────────────────────────────────────────────────
function AirportOverviewSection({
  airport,
  profile,
  profilePhase,
  onRetry,
  intelImages,
}: {
  airport: AirportObject;
  profile: PublicProfileData | null;
  profilePhase: string;
  onRetry: () => void;
  intelImages: AirportIntelImages | null;
}) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Image: prefer facts.imageUrl, then facts.image — only used as legacy fallback
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

  // Show intel gallery if available, otherwise fall back to legacy profile image
  const hasIntelImages = intelImages?.status === 'ok' && (
    intelImages.heroImage != null || intelImages.items.length > 0
  );

  return (
    <div>
      {/* Intel image gallery (preferred) */}
      {hasIntelImages && (
        <IntelImageGallery images={intelImages!} airportName={airport.name} />
      )}
      {/* Legacy profile image fallback */}
      {!hasIntelImages && imageStr && <HeroImage src={imageStr} alt={`${airport.name} image`} />}

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

// ── vessel overview section ──────────────────────────────────────────────────
function VesselOverviewSection({
  vessel,
  detail,
  loading,
  error,
}: {
  vessel: MaritimeVesselObject;
  detail: MaritimeVesselDetail | null;
  loading: boolean;
  error: string | null;
}) {
  const name = vessel.vesselName || 'Unknown vessel';

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--shell-accent)', lineHeight: 1.2, marginBottom: '2px' }}>
        {name}
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '10px', fontFamily: 'var(--shell-font-mono)', letterSpacing: '1px' }}>
        MMSI: {vessel.mmsi}
      </div>

      <div className="detail-row">
        <div className="detail-label">Vessel Type</div>
        <div className="detail-value">{vessel.vesselType || 'N/A'}</div>
      </div>

      {vessel.callsign && (
        <div className="detail-row">
          <div className="detail-label">Callsign</div>
          <div className="detail-value">{vessel.callsign}</div>
        </div>
      )}

      {vessel.imo && (
        <div className="detail-row">
          <div className="detail-label">IMO</div>
          <div className="detail-value">{vessel.imo}</div>
        </div>
      )}

      {vessel.speedOverGround !== null && (
        <div className="detail-row">
          <div className="detail-label">Speed Over Ground</div>
          <div className="detail-value">{vessel.speedOverGround.toFixed(1)} kn</div>
        </div>
      )}

      {vessel.courseOverGround !== null && (
        <div className="detail-row">
          <div className="detail-label">Course Over Ground</div>
          <div className="detail-value">{vessel.courseOverGround.toFixed(1)}°</div>
        </div>
      )}

      {vessel.trueHeading !== null && (
        <div className="detail-row">
          <div className="detail-label">True Heading</div>
          <div className="detail-value">{vessel.trueHeading.toFixed(1)}°</div>
        </div>
      )}

      {vessel.navigationStatusText && (
        <div className="detail-row">
          <div className="detail-label">Status</div>
          <div className="detail-value">{vessel.navigationStatusText}</div>
        </div>
      )}

      {vessel.destination && (
        <div className="detail-row">
          <div className="detail-label">Destination</div>
          <div className="detail-value">{vessel.destination}</div>
        </div>
      )}

      {vessel.lengthMeters !== null && (
        <div className="detail-row">
          <div className="detail-label">Length</div>
          <div className="detail-value">{vessel.lengthMeters} m</div>
        </div>
      )}

      {vessel.widthMeters !== null && (
        <div className="detail-row">
          <div className="detail-label">Width</div>
          <div className="detail-value">{vessel.widthMeters} m</div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--shell-text-dim)', fontSize: '0.65rem', marginTop: '10px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', border: '2px solid var(--shell-text-dim)', borderTopColor: 'var(--shell-accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          Loading voyage details…
        </div>
      )}

      {error && (
        <div style={{ color: '#f87171', fontSize: '0.6rem', marginTop: '10px' }}>
          Failed to load voyage details: {error}
        </div>
      )}

      {detail && (
        <>
          {detail.draughtMeters !== null && (
            <div className="detail-row">
              <div className="detail-label">Draught</div>
              <div className="detail-value">{detail.draughtMeters.toFixed(2)} m</div>
            </div>
          )}

          {detail.etaDisplay && (
            <div className="detail-row">
              <div className="detail-label">ETA</div>
              <div className="detail-value">{detail.etaDisplay}</div>
            </div>
          )}
        </>
      )}

      {/* Source and Provenance */}
      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, marginBottom: '6px', color: 'var(--shell-accent)' }}>
          SOURCE & PROVENANCE
        </div>
        <div className="detail-row">
          <div className="detail-label">Source Attribution</div>
          <div className="detail-value">AISStream</div>
        </div>
        <div className="detail-row">
          <div className="detail-label">Source ID</div>
          <div className="detail-value">{vessel.sourceId}</div>
        </div>
        {vessel.dataAgeSeconds !== null && (
          <div className="detail-row">
            <div className="detail-label">Data Age</div>
            <div className="detail-value">{vessel.dataAgeSeconds}s</div>
          </div>
        )}
        <div className="detail-row">
          <div className="detail-label">Received At</div>
          <div className="detail-value">{new Date(vessel.receivedAt).toLocaleTimeString()}</div>
        </div>
      </div>

      <div style={{
        marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingTop: '20px', opacity: 0.3, fontSize: '0.6rem',
        fontFamily: 'var(--shell-font-mono)',
      }}>
        SYSTEM ID: {vessel.id}
      </div>
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
  layoutPhase,
  selectedEnergyFeature,
  onEnergyFeatureClose: _onEnergyFeatureClose,
  vesselDetail,
  selectedWeatherItem,
  onWeatherClose: _onWeatherClose,
  selectedNewsItem,
  onNewsClose: _onNewsClose,
}) => {
  const isVessel = selectedObject && 'layerId' in selectedObject && selectedObject.layerId === 'layer_06_maritime';
  const { state: profileState, retry } = useAirportPublicProfile(!isVessel && selectedObject ? selectedObject.id : null);
  const intelState = useAirportIntelligence(!isVessel && selectedObject ? selectedObject.id : null);

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

  const intelImages =
    intelState.phase === 'ok' ? (intelState.data.images ?? null) : null;

  // Energy infrastructure feature detail content
  const energyFeatureContent = selectedEnergyFeature ? (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--shell-accent)', lineHeight: 1.2, marginBottom: '2px' }}>
        {selectedEnergyFeature.name || 'Unnamed Energy Feature'}
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '10px', fontFamily: 'var(--shell-font-mono)', letterSpacing: '1px' }}>
        {selectedEnergyFeature.featureType.replace('_', ' ').toUpperCase()}
        {selectedEnergyFeature.fuelType ? ` · ${selectedEnergyFeature.fuelType.toUpperCase()}` : ''}
      </div>
      
      <div className="detail-row">
        <div className="detail-label">Type</div>
        <div className="detail-value">{selectedEnergyFeature.featureType.replace('_', ' ')}</div>
      </div>
      
      {selectedEnergyFeature.fuelType && (
        <div className="detail-row">
          <div className="detail-label">Fuel Type</div>
          <div className="detail-value">{selectedEnergyFeature.fuelType}</div>
        </div>
      )}
      
      {selectedEnergyFeature.capacityMw && (
        <div className="detail-row">
          <div className="detail-label">Capacity</div>
          <div className="detail-value">{selectedEnergyFeature.capacityMw.toLocaleString()} MW</div>
        </div>
      )}
      
      {selectedEnergyFeature.voltageKv && (
        <div className="detail-row">
          <div className="detail-label">Voltage</div>
          <div className="detail-value">{selectedEnergyFeature.voltageKv.toLocaleString()} kV</div>
        </div>
      )}
      
      {selectedEnergyFeature.operator && (
        <div className="detail-row">
          <div className="detail-label">Operator</div>
          <div className="detail-value">{selectedEnergyFeature.operator}</div>
        </div>
      )}
      
      {selectedEnergyFeature.owner && (
        <div className="detail-row">
          <div className="detail-label">Owner</div>
          <div className="detail-value">{selectedEnergyFeature.owner}</div>
        </div>
      )}
      
      {selectedEnergyFeature.country && (
        <div className="detail-row">
          <div className="detail-label">Country</div>
          <div className="detail-value">{selectedEnergyFeature.country}</div>
        </div>
      )}
      
      {selectedEnergyFeature.status && (
        <div className="detail-row">
          <div className="detail-label">Status</div>
          <div className="detail-value">{selectedEnergyFeature.status}</div>
        </div>
      )}
      
      {selectedEnergyFeature.pipelineProduct && (
        <div className="detail-row">
          <div className="detail-label">Pipeline Product</div>
          <div className="detail-value">{selectedEnergyFeature.pipelineProduct}</div>
        </div>
      )}
      
      {selectedEnergyFeature.pipelineLengthKm && (
        <div className="detail-row">
          <div className="detail-label">Pipeline Length</div>
          <div className="detail-value">{selectedEnergyFeature.pipelineLengthKm.toLocaleString()} km</div>
        </div>
      )}
      
      {selectedEnergyFeature.terminalType && (
        <div className="detail-row">
          <div className="detail-label">Terminal Type</div>
          <div className="detail-value">{selectedEnergyFeature.terminalType}</div>
        </div>
      )}
      
      {/* Source and Provenance */}
      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, marginBottom: '6px', color: 'var(--shell-accent)' }}>
          SOURCE & PROVENANCE
        </div>
        <div className="detail-row">
          <div className="detail-label">Source ID</div>
          <div className="detail-value">{selectedEnergyFeature.sourceId}</div>
        </div>
        <div className="detail-row">
          <div className="detail-label">Source Confidence</div>
          <div className="detail-value">{selectedEnergyFeature.sourceConfidence}</div>
        </div>
        {selectedEnergyFeature.sourceUpdatedAt && (
          <div className="detail-row">
            <div className="detail-label">Source Updated</div>
            <div className="detail-value">{new Date(selectedEnergyFeature.sourceUpdatedAt).toLocaleDateString()}</div>
          </div>
        )}
        {selectedEnergyFeature.firstSeenAt && (
          <div className="detail-row">
            <div className="detail-label">First Seen</div>
            <div className="detail-value">{new Date(selectedEnergyFeature.firstSeenAt).toLocaleDateString()}</div>
          </div>
        )}
        {selectedEnergyFeature.lastSeenAt && (
          <div className="detail-row">
            <div className="detail-label">Last Seen</div>
            <div className="detail-value">{new Date(selectedEnergyFeature.lastSeenAt).toLocaleDateString()}</div>
          </div>
        )}
      </div>
      
      {/* Safety Copy */}
      <div style={{
        marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingTop: '12px', opacity: 0.6, fontSize: '0.6rem',
        lineHeight: 1.5, color: 'var(--shell-text-dim)',
      }}>
        Static public-source infrastructure data. Not live operational status.
      </div>
      
      <div style={{
        marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingTop: '20px', opacity: 0.3, fontSize: '0.6rem',
        fontFamily: 'var(--shell-font-mono)',
      }}>
        SYSTEM ID: {selectedEnergyFeature.id}
      </div>
    </div>
  ) : null;

  // Weather observation detail card
  const weatherContent = selectedWeatherItem ? (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--shell-accent)', lineHeight: 1.2, marginBottom: '2px' }}>
        {formatCondition(selectedWeatherItem)}
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '10px', fontFamily: 'var(--shell-font-mono)', letterSpacing: '1px' }}>
        WEATHER OBSERVATION
      </div>

      <div className="detail-row">
        <div className="detail-label">Temperature</div>
        <div className="detail-value">{formatMeasurement(selectedWeatherItem.temperatureC, '°C')}</div>
      </div>
      {selectedWeatherItem.apparentTemperatureC !== null && (
        <div className="detail-row">
          <div className="detail-label">Feels Like</div>
          <div className="detail-value">{formatMeasurement(selectedWeatherItem.apparentTemperatureC, '°C')}</div>
        </div>
      )}
      {selectedWeatherItem.humidityPercent !== null && (
        <div className="detail-row">
          <div className="detail-label">Humidity</div>
          <div className="detail-value">{formatMeasurement(selectedWeatherItem.humidityPercent, '%', 0)}</div>
        </div>
      )}
      {selectedWeatherItem.windSpeedKph !== null && (
        <div className="detail-row">
          <div className="detail-label">Wind Speed</div>
          <div className="detail-value">{formatMeasurement(selectedWeatherItem.windSpeedKph, 'km/h')}</div>
        </div>
      )}
      {selectedWeatherItem.windDirectionDeg !== null && (
        <div className="detail-row">
          <div className="detail-label">Wind Direction</div>
          <div className="detail-value">{formatWindDirection(selectedWeatherItem.windDirectionDeg)}</div>
        </div>
      )}
      {selectedWeatherItem.windGustKph !== null && (
        <div className="detail-row">
          <div className="detail-label">Wind Gusts</div>
          <div className="detail-value">{formatMeasurement(selectedWeatherItem.windGustKph, 'km/h')}</div>
        </div>
      )}
      {selectedWeatherItem.precipitationMm !== null && (
        <div className="detail-row">
          <div className="detail-label">Precipitation</div>
          <div className="detail-value">{formatMeasurement(selectedWeatherItem.precipitationMm, 'mm')}</div>
        </div>
      )}
      {selectedWeatherItem.precipitationProbabilityPercent !== null && (
        <div className="detail-row">
          <div className="detail-label">Precip. Probability</div>
          <div className="detail-value">{formatMeasurement(selectedWeatherItem.precipitationProbabilityPercent, '%', 0)}</div>
        </div>
      )}
      {selectedWeatherItem.cloudCoverPercent !== null && (
        <div className="detail-row">
          <div className="detail-label">Cloud Cover</div>
          <div className="detail-value">{formatMeasurement(selectedWeatherItem.cloudCoverPercent, '%', 0)}</div>
        </div>
      )}
      {selectedWeatherItem.pressureHpa !== null && (
        <div className="detail-row">
          <div className="detail-label">Pressure</div>
          <div className="detail-value">{formatMeasurement(selectedWeatherItem.pressureHpa, 'hPa')}</div>
        </div>
      )}

      {/* Timing */}
      <div className="detail-row">
        <div className="detail-label">Forecast For</div>
        <div className="detail-value">{formatTimestamp(selectedWeatherItem.forecastFor)}</div>
      </div>
      <div className="detail-row">
        <div className="detail-label">Last Updated</div>
        <div className="detail-value">{formatTimestamp(selectedWeatherItem.fetchedAt)}</div>
      </div>
      {selectedWeatherItem.isStale && (
        <div className="detail-row">
          <div className="detail-label">Data Status</div>
          <div className="detail-value" style={{ color: '#ffab00' }}>Stale</div>
        </div>
      )}

      {/* Attribution */}
      <div style={{
        marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingTop: '12px', fontSize: '0.6rem', lineHeight: 1.5, color: 'var(--shell-text-dim)',
      }}>
        {selectedWeatherItem.attribution}
      </div>

      <div style={{
        marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingTop: '20px', opacity: 0.3, fontSize: '0.6rem',
        fontFamily: 'var(--shell-font-mono)',
      }}>
        OBSERVATION ID: {selectedWeatherItem.observationId}
      </div>
    </div>
  ) : null;

  const headerContent = detailLoading ? (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ ...spinner, width: '10px', height: '10px' }} />
      Object Intel
    </span>
  ) : selectedEnergyFeature ? 'Energy Infrastructure'
    : selectedWeatherItem ? 'Weather'
    : selectedNewsItem ? 'News & OSINT'
    : 'Object Intel';

  // News / OSINT detail card
  const newsContent = selectedNewsItem ? (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--shell-accent)', lineHeight: 1.2, marginBottom: '2px' }}>
        {selectedNewsItem.title}
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '10px', fontFamily: 'var(--shell-font-mono)', letterSpacing: '1px' }}>
        {selectedNewsItem.category.toUpperCase()}
        {selectedNewsItem.subcategory ? ` · ${selectedNewsItem.subcategory.toUpperCase()}` : ''}
      </div>

      <div className="detail-row">
        <div className="detail-label">Severity</div>
        <div className="detail-value" style={{ color: selectedNewsItem.severity === 'red' ? '#ef4444' : selectedNewsItem.severity === 'orange' ? '#f97316' : selectedNewsItem.severity === 'green' ? '#22c55e' : undefined }}>
          {formatNewsSeverity(selectedNewsItem.severity)}
        </div>
      </div>

      <div className="detail-row">
        <div className="detail-label">Country</div>
        <div className="detail-value">{formatNewsCountry(selectedNewsItem.countryName, selectedNewsItem.countryCode)}</div>
      </div>

      <div className="detail-row">
        <div className="detail-label">Published</div>
        <div className="detail-value">{formatNewsTimestamp(selectedNewsItem.publishedAt)}</div>
      </div>

      {selectedNewsItem.sourceUpdatedAt && (
        <div className="detail-row">
          <div className="detail-label">Source Updated</div>
          <div className="detail-value">{formatNewsTimestamp(selectedNewsItem.sourceUpdatedAt)}</div>
        </div>
      )}

      <div className="detail-row">
        <div className="detail-label">Coordinates</div>
        <div className="detail-value">
          {selectedNewsItem.latitude.toFixed(4)}, {selectedNewsItem.longitude.toFixed(4)}
        </div>
      </div>

      {/* Source & Attribution */}
      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, marginBottom: '6px', color: 'var(--shell-accent)' }}>
          SOURCE & ATTRIBUTION
        </div>
        <div className="detail-row">
          <div className="detail-label">Source</div>
          <div className="detail-value">{orDash(selectedNewsItem.sourceId)}</div>
        </div>
        {selectedNewsItem.sourceUrl && (
          <div className="detail-row">
            <div className="detail-label">URL</div>
            <div className="detail-value">
              <a
                href={selectedNewsItem.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--shell-accent)', textDecoration: 'none', wordBreak: 'break-all' }}
              >
                {selectedNewsItem.sourceUrl}
              </a>
            </div>
          </div>
        )}
        <div style={{
          marginTop: '8px', fontSize: '0.5rem', color: '#888',
          opacity: 0.8, lineHeight: 1.4,
        }}>
          {selectedNewsItem.attribution}
        </div>
      </div>

      <div style={{
        marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingTop: '20px', opacity: 0.3, fontSize: '0.6rem',
        fontFamily: 'var(--shell-font-mono)',
      }}>
        ITEM ID: {selectedNewsItem.itemId}
      </div>
    </div>
  ) : null;

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
          {/* Energy Infrastructure Feature Detail */}
          {selectedEnergyFeature && energyFeatureContent}

          {/* Weather Observation Detail */}
          {!selectedEnergyFeature && selectedWeatherItem && weatherContent}

          {/* News & OSINT Detail */}
          {!selectedEnergyFeature && !selectedWeatherItem && selectedNewsItem && newsContent}

          {/* Airport Object Detail */}
          {!selectedEnergyFeature && !selectedWeatherItem && !selectedNewsItem && !selectedObject && (
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
          )}
          
          {/* Vessel Detail Card rendering */}
          {!selectedEnergyFeature && !selectedWeatherItem && !selectedNewsItem && selectedObject && isVessel && (
            <IntelSection title="Vessel Details">
              <VesselOverviewSection
                vessel={selectedObject as MaritimeVesselObject}
                detail={vesselDetail}
                loading={detailLoading}
                error={detailError}
              />
            </IntelSection>
          )}

          {/* Airport Object Detail */}
          {!selectedEnergyFeature && !selectedWeatherItem && !selectedNewsItem && selectedObject && !isVessel && (
            <IntelBoundary key={selectedObject.id}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>

                {/* ── OVERVIEW (merged with public profile) ── */}
                <IntelSection title="Overview">
                  <AirportOverviewSection
                    airport={selectedObject as AirportObject}
                    profile={profile}
                    profilePhase={profileState.phase}
                    onRetry={retry}
                    intelImages={intelImages}
                  />
                </IntelSection>

                {/* ── LAYOUT OVERLAY INDICATOR ── */}
                <div style={{ padding: '0 0 8px 0' }}>
                  <AirportLayoutOverlayToggle layoutPhase={layoutPhase} />
                </div>

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
                        sourceId={(selectedObject as AirportObject).sourceId}
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
