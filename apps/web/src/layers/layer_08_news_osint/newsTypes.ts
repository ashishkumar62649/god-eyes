import type {
  NewsItem,
  NewsMarkerItem,
  NewsStatsResponse,
  NewsSourceItem,
  NewsFetchRunItem,
} from '@god-eyes/contracts';

export const NEWS_LAYER_ID = 'layer_08_news_osint';
export const NEWS_ATTRIBUTION = 'Disaster data provided by GDACS under open access.';

// Re-export contract types for convenience within this layer.
export type { NewsItem, NewsMarkerItem, NewsStatsResponse, NewsSourceItem, NewsFetchRunItem };

/**
 * Frontend render model for a news/OSINT marker.
 *
 * `kind: 'news'` is a discriminator for the shared selection system.
 * Only Point records with marker_ready=true are placed on the globe.
 */
export interface NewsRenderMarker {
  kind: 'news';
  itemId: string;
  title: string;
  sourceId: string;
  sourceUrl: string | null;
  latitude: number;
  longitude: number;
  countryCode: string | null;
  countryName: string | null;
  category: string;
  subcategory: string | null;
  severity: string;
  publishedAt: string | null;
  sourceUpdatedAt: string | null;
  attribution: string;
}

/** Filter state for the Layer 08 list + API calls. */
export interface NewsFilterState {
  severity: string | null;
  subcategory: string | null;
  country: string | null;
  markerReadyOnly: boolean;
}

export const DEFAULT_NEWS_FILTERS: NewsFilterState = {
  severity: null,
  subcategory: null,
  country: null,
  markerReadyOnly: false,
};

/** Severity levels used by GDACS. */
export const NEWS_SEVERITY_LEVELS = ['green', 'orange', 'red', 'unknown'] as const;

/** Severity → display colour mapping (matches project palette). */
export const NEWS_SEVERITY_COLORS: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  green: '#22c55e',
  unknown: '#6b7280',
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Maps a NewsMarkerItem from the API into the frontend render model.
 * Returns null if the item lacks valid coordinates.
 */
export function mapMarkerToRenderItem(
  item: NewsMarkerItem | null | undefined
): NewsRenderMarker | null {
  if (!item) return null;
  if (!isFiniteNumber(item.latitude) || !isFiniteNumber(item.longitude)) return null;
  if (
    item.latitude < -90 || item.latitude > 90 ||
    item.longitude < -180 || item.longitude > 180
  ) {
    return null;
  }
  return {
    kind: 'news',
    itemId: String(item.item_id),
    title: String(item.title),
    sourceId: String(item.source_id),
    sourceUrl: item.source_url ?? null,
    latitude: item.latitude,
    longitude: item.longitude,
    countryCode: item.country_code ?? null,
    countryName: item.country_name ?? null,
    category: String(item.category),
    subcategory: item.subcategory ?? null,
    severity: String(item.severity),
    publishedAt: item.published_at ?? null,
    sourceUpdatedAt: item.source_updated_at ?? null,
    attribution:
      typeof item.attribution === 'string' && item.attribution.length > 0
        ? item.attribution
        : NEWS_ATTRIBUTION,
  };
}

/** Maps an array of marker items, skipping invalid entries. */
export function mapMarkersToRenderItems(
  items: Array<NewsMarkerItem | null | undefined> | null | undefined
): NewsRenderMarker[] {
  if (!Array.isArray(items)) return [];
  const out: NewsRenderMarker[] = [];
  for (const item of items) {
    const m = mapMarkerToRenderItem(item);
    if (m) out.push(m);
  }
  return out;
}
