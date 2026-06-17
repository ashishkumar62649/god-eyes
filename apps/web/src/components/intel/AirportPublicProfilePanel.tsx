import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAirportPublicProfile } from '../../lib/api';
import type {
  AirportPublicProfileResponse,
  PublicProfileData,
  PublicProfileAttribution,
} from '../../layers/layer_01_aviation/airports/airportPublicProfileTypes';

interface Props {
  airportId: string;
}

type PanelState =
  | { phase: 'loading' }
  | { phase: 'fetching' }
  | { phase: 'ok'; data: PublicProfileData; attribution: PublicProfileAttribution | null; fetchedAt: string }
  | { phase: 'stale'; data: PublicProfileData; attribution: PublicProfileAttribution | null; fetchedAt: string }
  | { phase: 'no_profile_found' }
  | { phase: 'low_confidence'; data: PublicProfileData; attribution: PublicProfileAttribution | null; showAnyway: boolean }
  | { phase: 'error'; message: string };

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── shared styles ─────────────────────────────────────────────────────────────
const dim: React.CSSProperties = { color: 'var(--shell-text-dim)', fontSize: '0.65rem' };
const accentLink: React.CSSProperties = { color: 'var(--shell-accent)', textDecoration: 'none' };
const ghostBtn: React.CSSProperties = {
  background: 'none',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '3px',
  cursor: 'pointer',
  padding: '3px 8px',
  color: 'var(--shell-text-dim)',
  fontSize: '0.65rem',
  marginTop: '6px',
};
const spinner: React.CSSProperties = {
  display: 'inline-block', width: '10px', height: '10px',
  border: '2px solid var(--shell-text-dim)', borderTopColor: 'var(--shell-accent)',
  borderRadius: '50%', animation: 'spin 1s linear infinite',
};

// ── sub-components ────────────────────────────────────────────────────────────

// Error boundary — prevents a panel crash from blacking out the whole app.
class ProfilePanelBoundary extends React.Component<
  { children: React.ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    if (this.state.crashed) {
      return <div style={{ ...dim, fontSize: '0.65rem' }}>Profile unavailable.</div>;
    }
    return this.props.children;
  }
}

function AttributionBlock({ attribution }: { attribution: PublicProfileAttribution | null | undefined }) {
  if (!attribution) return null;
  // Guard: source may be absent or non-string in partial API responses.
  const src = typeof attribution.source === 'string' ? attribution.source.toLowerCase() : '';
  const hasSource = src.length > 0;
  return (
    <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', fontSize: '0.6rem', ...dim }}>
      {hasSource && (
        <>📋 Source: {attribution.source}{attribution.matchMethod ? ` · Match: ${attribution.matchMethod}` : ''}{attribution.matchConfidence ? ` (${attribution.matchConfidence} confidence)` : ''}</>
      )}
      {!hasSource && <>Source attribution unavailable</>}
      {src.includes('wikipedia') && (
        <span>
          {' · '}Text available under{' '}
          <a
            href="https://en.wikipedia.org/wiki/Wikipedia:Text_of_the_Creative_Commons_Attribution-ShareAlike_4.0_International_License"
            target="_blank" rel="noopener noreferrer" style={accentLink}
          >
            Creative Commons Attribution-ShareAlike License
          </a>
        </span>
      )}
      {src.includes('wikidata') && (
        <span>{' · '}Data from Wikidata (CC0).</span>
      )}
    </div>
  );
}

function ProfileBody({
  data,
  attribution,
  fetchedAt,
}: {
  data: PublicProfileData;
  attribution: PublicProfileAttribution | null;
  fetchedAt: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = data.summary ?? '';
  const displaySummary = summary.length > 300 && !expanded ? summary.slice(0, 300) + '…' : summary;

  return (
    <div>
      {summary && (
        <div style={{ fontSize: '0.7rem', lineHeight: 1.5, marginBottom: '6px' }}>
          {displaySummary}
          {summary.length > 300 && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', ...accentLink, fontSize: '0.65rem' }}
            >
              {expanded ? 'Less' : 'More'}
            </button>
          )}
        </div>
      )}

      {data.facts && Object.keys(data.facts).length > 0 && (
        <div style={{ marginBottom: '6px' }}>
          {Object.entries(data.facts).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.68rem', marginBottom: '2px' }}>
              <span style={dim}>{k}</span>
              <span style={{ textAlign: 'right', wordBreak: 'break-word' }}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...dim, fontSize: '0.6rem' }}>Cached: {relativeTime(fetchedAt)}</div>

      <AttributionBlock attribution={attribution} />
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

const AirportPublicProfilePanel: React.FC<Props> = ({ airportId }) => {
  const [state, setState] = useState<PanelState>({ phase: 'loading' });
  const [fetchKey, setFetchKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const retry = useCallback(() => setFetchKey(k => k + 1), []);

  // Auto-poll every 4 s while the backend is still building the profile.
  useEffect(() => {
    if (state.phase !== 'fetching') return;
    const id = setInterval(() => setFetchKey(k => k + 1), 4000);
    return () => clearInterval(id);
  }, [state.phase]);

  // Reset fetchKey when airport changes so stale poll ticks from the previous airport are discarded.
  useEffect(() => { setFetchKey(0); }, [airportId]);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ phase: 'loading' });

    fetchAirportPublicProfile(airportId, ctrl.signal)
      .then((res: AirportPublicProfileResponse) => {
        if (ctrl.signal.aborted) return;
        const { status, profile, fetchedAt, attribution } = res;

        switch (status) {
          case 'ok':
            setState({ phase: 'ok', data: profile!, attribution, fetchedAt: fetchedAt! });
            break;
          case 'stale':
            setState({ phase: 'stale', data: profile!, attribution, fetchedAt: fetchedAt! });
            break;
          case 'fetching':
            setState({ phase: 'fetching' });
            break;
          case 'no_profile_found':
            setState({ phase: 'no_profile_found' });
            break;
          case 'low_confidence_match':
            setState({ phase: 'low_confidence', data: profile!, attribution, showAnyway: false });
            break;
          default:
            setState({ phase: 'error', message: 'Unexpected response from server.' });
        }
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setState({ phase: 'error', message: err.message });
      });

    return () => ctrl.abort();
  }, [airportId, fetchKey]); // fetchKey re-triggers on retry

  // ── render ────────────────────────────────────────────────────────────────

  if (state.phase === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...dim }}>
        <span style={spinner} />
        Fetching profile…
      </div>
    );
  }

  if (state.phase === 'fetching') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...dim }}>
          <span style={spinner} />
          Building profile…
        </div>
        <div style={{ ...dim, fontSize: '0.6rem', marginTop: '4px' }}>
          Retrieving public data. This may take a moment.
        </div>
        <button style={ghostBtn} onClick={retry}>Check again</button>
      </div>
    );
  }

  if (state.phase === 'no_profile_found') {
    return (
      <div style={{ ...dim, fontSize: '0.7rem' }}>
        No public profile found for this airport.
      </div>
    );
  }

  if (state.phase === 'low_confidence') {
    if (!state.showAnyway) {
      return (
        <div>
          <div style={{ color: '#eab308', fontSize: '0.7rem', marginBottom: '4px' }}>⚠ Profile match uncertain</div>
          <div style={{ ...dim, fontSize: '0.6rem', marginBottom: '6px' }}>
            Data may not correspond to this airport.
          </div>
          <button
            style={ghostBtn}
            onClick={() => setState({ ...state, showAnyway: true })}
          >
            Show anyway
          </button>
        </div>
      );
    }
    return (
      <div>
        <div style={{ color: '#eab308', fontSize: '0.65rem', marginBottom: '6px' }}>⚠ Low confidence — verify before use</div>
        <ProfileBody data={state.data} attribution={state.attribution} fetchedAt={new Date().toISOString()} />
      </div>
    );
  }

  if (state.phase === 'stale') {
    return (
      <div>
        <div style={{ color: '#eab308', fontSize: '0.65rem', marginBottom: '6px' }}>⚠ Profile may be outdated</div>
        <ProfileBody data={state.data} attribution={state.attribution} fetchedAt={state.fetchedAt} />
        <button style={ghostBtn} onClick={retry}>Refresh profile</button>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div>
        <div style={{ color: '#f87171', fontSize: '0.7rem', marginBottom: '4px' }}>Failed to load profile</div>
        <div style={{ ...dim, fontSize: '0.6rem', marginBottom: '6px' }}>{state.message}</div>
        <button style={ghostBtn} onClick={retry}>Retry</button>
      </div>
    );
  }

  // phase === 'ok'
  return <ProfileBody data={state.data} attribution={state.attribution} fetchedAt={state.fetchedAt} />;
};

const AirportPublicProfilePanelSafe: React.FC<Props> = (props) => (
  <ProfilePanelBoundary>
    <AirportPublicProfilePanel {...props} />
  </ProfilePanelBoundary>
);

export default AirportPublicProfilePanelSafe;
