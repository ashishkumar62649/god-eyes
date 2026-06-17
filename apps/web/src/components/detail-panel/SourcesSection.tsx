import React from 'react';
import type { PublicProfileAttribution } from '../../layers/layer_01_aviation/airports/airportPublicProfileTypes';

const dim: React.CSSProperties = { color: 'var(--shell-text-dim)', fontSize: '0.65rem' };
const accentLink: React.CSSProperties = { color: 'var(--shell-accent)', textDecoration: 'none' };

export function SourcesSection({
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
