import React, { useState } from 'react';
import type { ImageAssetItem } from '../../layers/layer_01_aviation/airports/airportIntelligenceTypes';

interface AirportImageSliderProps {
  items: ImageAssetItem[];
  /** Height of the image area in px */
  height?: number;
  /** Fallback code shown when no images or all fail */
  fallbackCode: string;
}

function SliderImage({
  src,
  alt,
  height,
  onFail,
}: {
  src: string;
  alt: string;
  height: number;
  onFail: () => void;
}) {
  return (
    <img
      src={src}
      alt={alt}
      onError={onFail}
      style={{
        width: '100%',
        height,
        objectFit: 'cover',
        borderRadius: '5px',
        display: 'block',
      }}
    />
  );
}

const AirportImageSlider: React.FC<AirportImageSliderProps> = ({
  items,
  height = 90,
  fallbackCode,
}) => {
  const [index, setIndex] = useState(0);
  // Track which indices have failed to load
  const [failed, setFailed] = useState<Set<number>>(new Set());

  const markFailed = (i: number) =>
    setFailed(prev => new Set(prev).add(i));

  // Filter to items that haven't failed
  const available = items.filter((_, i) => !failed.has(i));

  // Fallback block
  const fallback = (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: '5px',
        marginBottom: '6px',
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--shell-font-mono)',
        fontSize: '1.1rem',
        color: 'rgba(255,255,255,0.25)',
        letterSpacing: '2px',
      }}
    >
      {fallbackCode}
    </div>
  );

  if (items.length === 0 || available.length === 0) return fallback;

  // Clamp index to available range
  const safeIndex = Math.min(index, available.length - 1);
  const current = available[safeIndex];
  // Map back to original index for failure tracking
  const originalIndex = items.indexOf(current);

  const prev = () => setIndex(i => (i - 1 + available.length) % available.length);
  const next = () => setIndex(i => (i + 1) % available.length);

  const caption = current.caption;
  const attribution = current.attributionText ?? current.sourceName;

  return (
    <div style={{ marginBottom: '10px' }}>
      {/* Image */}
      <div style={{ position: 'relative' }}>
        <SliderImage
          src={current.imageUrl}
          alt={caption ?? fallbackCode}
          height={height}
          onFail={() => {
            markFailed(originalIndex);
            // Advance to next if possible
            if (available.length > 1) setIndex(i => i % (available.length - 1));
          }}
        />

        {/* Prev / Next controls — only show if more than 1 image */}
        {available.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              style={navBtnStyle('left')}
            >
              ‹
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              style={navBtnStyle('right')}
            >
              ›
            </button>
          </>
        )}

        {/* Counter */}
        {available.length > 1 && (
          <div style={counterStyle}>
            {safeIndex + 1} / {available.length}
          </div>
        )}
      </div>

      {/* Caption */}
      {caption && (
        <div style={{
          fontSize: '0.58rem',
          color: 'rgba(255,255,255,0.45)',
          lineHeight: 1.4,
          marginTop: '3px',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {caption}
        </div>
      )}

      {/* Attribution */}
      {attribution && (
        <div style={{
          fontSize: '0.55rem',
          color: 'rgba(255,255,255,0.25)',
          marginTop: '2px',
          fontFamily: 'var(--shell-font-mono)',
        }}>
          {current.sourceUrl ? (
            <a
              href={current.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {attribution}
            </a>
          ) : attribution}
          {current.licenseName ? ` · ${current.licenseName}` : ''}
        </div>
      )}
    </div>
  );
};

function navBtnStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: '4px',
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '3px',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '1rem',
    lineHeight: 1,
    padding: '1px 5px',
    cursor: 'pointer',
    zIndex: 1,
  };
}

const counterStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '4px',
  right: '6px',
  background: 'rgba(0,0,0,0.6)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: '0.55rem',
  fontFamily: 'var(--shell-font-mono)',
  padding: '1px 5px',
  borderRadius: '3px',
};

export default AirportImageSlider;
