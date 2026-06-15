import type { NewsRenderMarker } from '../../layers/layer_08_news_osint/newsTypes';
import { NEWS_SEVERITY_COLORS } from '../../layers/layer_08_news_osint/newsTypes';
import {
  formatNewsTimestamp,
  formatNewsSeverity,
  formatNewsCountry,
  orDash,
} from '../../layers/layer_08_news_osint/newsDetail';

export function NewsDetail({ item }: { item: NewsRenderMarker }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--shell-accent)', lineHeight: 1.2, marginBottom: '2px' }}>
        {item.title}
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '10px', fontFamily: 'var(--shell-font-mono)', letterSpacing: '1px' }}>
        {item.category.toUpperCase()}{item.subcategory ? ` · ${item.subcategory.toUpperCase()}` : ''}
      </div>

      {item.summary && (
        <div style={{ fontSize: '0.7rem', lineHeight: 1.5, marginBottom: '10px', color: 'var(--shell-text-dim)' }}>
          {item.summary}
        </div>
      )}

      <div className="detail-row">
        <div className="detail-label">Severity</div>
        <div className="detail-value" style={{ color: NEWS_SEVERITY_COLORS[item.severity.toLowerCase()] || '#6b7280', fontWeight: 600 }}>
          {formatNewsSeverity(item.severity)}
        </div>
      </div>
      <div className="detail-row"><div className="detail-label">Country</div><div className="detail-value">{formatNewsCountry(item.countryName, item.countryCode)}</div></div>
      {item.locationConfidence && <div className="detail-row"><div className="detail-label">Location Confidence</div><div className="detail-value">{orDash(item.locationConfidence)}</div></div>}
      <div className="detail-row"><div className="detail-label">Published</div><div className="detail-value">{formatNewsTimestamp(item.publishedAt)}</div></div>
      {item.sourceUpdatedAt && <div className="detail-row"><div className="detail-label">Source Updated</div><div className="detail-value">{formatNewsTimestamp(item.sourceUpdatedAt)}</div></div>}

      {item.latitude !== null && item.latitude !== undefined && item.longitude !== null && item.longitude !== undefined && (
        <div className="detail-row">
          <div className="detail-label">Coordinates</div>
          <div className="detail-value">{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</div>
        </div>
      )}
      {item.markerReady === false && (
        <div className="detail-row" style={{ color: '#f97316' }}>
          <div className="detail-label">Marker Status</div>
          <div className="detail-value" style={{ fontWeight: 600 }}>No marker / list only</div>
        </div>
      )}

      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, marginBottom: '6px', color: 'var(--shell-accent)' }}>SOURCE & ATTRIBUTION</div>
        <div className="detail-row">
          <div className="detail-label">Source</div>
          <div className="detail-value">{item.sourceId === 'gdelt_event_export' ? 'GDELT Event Export' : orDash(item.sourceId)}</div>
        </div>
        {item.sourceUrl && (
          <div className="detail-row">
            <div className="detail-label">URL</div>
            <div className="detail-value">
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--shell-accent)', textDecoration: 'none', wordBreak: 'break-all' }}>
                {item.sourceUrl}
              </a>
            </div>
          </div>
        )}
        <div style={{ marginTop: '8px', fontSize: '0.5rem', color: '#888', opacity: 0.8, lineHeight: 1.4 }}>
          {item.attribution}
        </div>
      </div>

      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', opacity: 0.3, fontSize: '0.6rem', fontFamily: 'var(--shell-font-mono)' }}>
        ITEM ID: {item.itemId}
      </div>
    </div>
  );
}
