# Frontend Planning - Layer 08 News & OSINT

## UI Components

### 1. Globe Markers
**Purpose**: Display news events on 3D globe

**Features**:
- Color-coded markers by category
- Size variation by severity
- Clustering for dense regions
- Click to view details
- Hover tooltips with summary
- Animation for new events

**Marker Design**:
```typescript
interface GlobeMarker {
  id: string;
  latitude: number;
  longitude: number;
  category: 'disaster' | 'health' | 'security' | 'humanitarian' | 'infrastructure' | 'environment' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  title: string;
  published_at: string;
  country_code?: string;
  cluster_count?: number; // For clustered markers
}
```

**Visual Design**:
- **Disaster**: Red/orange markers with earthquake/flood icons
- **Health**: Blue markers with medical cross icon
- **Security**: Yellow markers with shield icon
- **Humanitarian**: Green markers with hands icon
- **Infrastructure**: Gray markers with gear icon
- **Environment**: Teal markers with leaf icon
- **Other**: White markers with news icon

**Clustering Strategy**:
- Cluster markers within 50px radius
- Show cluster count on marker
- Expand cluster on zoom
- Preserve severity distribution in clusters

### 2. Sidebar Latest List
**Purpose**: Chronological news feed

**Features**:
- Infinite scroll
- Source icons/badges
- Category tags
- Severity indicators
- Country flags
- Time-relative display (e.g., "2 hours ago")
- Click to view details
- Pin important events

**List Item Design**:
```typescript
interface NewsListItem {
  id: string;
  title: string;
  summary?: string;
  source_id: string;
  source_name: string;
  category: string;
  severity: string;
  country_code?: string;
  published_at: string;
  image_url?: string;
  is_pinned?: boolean;
}
```

**Visual Design**:
- Source badge with color
- Category tag with icon
- Severity dot (red/orange/yellow/green)
- Country flag (small)
- Relative time display
- Thumbnail image if available

### 3. Marker Detail Cards
**Purpose**: Full event information on click

**Features**:
- Full title and summary
- Source attribution with link
- Location details with map
- Timeline of updates
- Related events
- Share options
- Bookmark/save option

**Card Design**:
```typescript
interface DetailCard {
  id: string;
  title: string;
  summary: string;
  content_type: string;
  source: {
    id: string;
    name: string;
    url: string;
    domain: string;
  };
  location: {
    confidence: string;
    country_name: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    map_url?: string;
  };
  category: string;
  subcategory?: string;
  severity: string;
  published_at: string;
  updated_at?: string;
  image_url?: string;
  confidence_score: number;
  related_events?: RelatedEvent[];
}
```

### 4. Filter Controls
**Purpose**: Filter news by various criteria

**Filter Types**:
- **Category**: Multi-select dropdown
- **Severity**: Multi-select dropdown
- **Source**: Multi-select dropdown
- **Country**: Searchable dropdown
- **Time Range**: Preset buttons (1h, 6h, 24h, 7d, 30d)
- **Has Coordinates**: Toggle switch

**Filter State**:
```typescript
interface FilterState {
  categories: string[];
  severities: string[];
  sources: string[];
  country_code?: string;
  time_range: string;
  has_coordinates: boolean;
  search_query?: string;
}
```

**Visual Design**:
- Collapsible filter panel
- Active filter chips
- Clear all filters button
- Filter count badges
- Mobile-friendly filter drawer

### 5. Source Attribution Display
**Purpose**: Show data source and credibility

**Features**:
- Source icon/logo
- Source name
- Link to original source
- Confidence score indicator
- Data freshness indicator
- Source reliability badge

**Design**:
```typescript
interface SourceAttribution {
  source_id: string;
  source_name: string;
  source_url: string;
  confidence_score: number;
  fetched_at: string;
  is_reliable: boolean;
}
```

### 6. Location Confidence Display
**Purpose**: Show how accurate location data is

**Confidence Levels**:
- **exact_coordinate**: "Precise location"
- **city_level**: "City area"
- **region_level**: "Region"
- **country_level**: "Country"
- **unknown**: "Location unknown"

**Visual Indicators**:
- Color-coded confidence badge
- Tooltip explaining confidence level
- Map marker style based on confidence

### 7. Timeline View
**Purpose**: Show event evolution over time

**Features**:
- Horizontal timeline of events
- Event clustering by time
- Zoom in/out
- Click to view event details
- Filter by category/severity

**Design**:
```typescript
interface TimelineEvent {
  id: string;
  title: string;
  category: string;
  severity: string;
  published_at: string;
  position: number; // Timeline position
}
```

## State Management

### Global State
```typescript
interface NewsState {
  items: NewsItem[];
  markers: GlobeMarker[];
  filters: FilterState;
  pagination: PaginationState;
  sources: SourceState[];
  fetch_runs: FetchRun[];
  stats: NewsStats;
  loading: boolean;
  error: string | null;
}
```

### Actions
- `FETCH_ITEMS`: Load news items
- `FETCH_MARKERS`: Load globe markers
- `SET_FILTERS`: Update filters
- `LOAD_MORE`: Load next page
- `SELECT_ITEM`: View item details
- `CLEAR_ERROR`: Clear error state

## Responsive Design

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Mobile Adaptations
- Full-screen map with bottom sheet list
- Collapsible filter drawer
- Simplified detail cards
- Touch-friendly interactions

### Tablet Adaptations
- Split view (map + list)
- Side panel filters
- Medium detail cards

### Desktop Adaptations
- Three-column layout (filters, list, map)
- Persistent filter panel
- Full detail cards
- Keyboard navigation

## Performance Optimization

### Data Loading
- **Lazy loading**: Load markers as map moves
- **Pagination**: Infinite scroll with virtual list
- **Caching**: Cache API responses locally
- **Debouncing**: Debounce filter changes

### Rendering
- **Virtual scrolling**: For large lists
- **Marker clustering**: Reduce DOM nodes
- **Image optimization**: Lazy load images
- **Code splitting**: Load components on demand

### API Optimization
- **Batch requests**: Combine multiple queries
- **Field selection**: Request only needed fields
- **Compression**: Enable gzip/brotli
- **CDN caching**: Cache static assets

## Accessibility

### Keyboard Navigation
- Tab through interactive elements
- Arrow keys for list navigation
- Enter to select items
- Escape to close modals

### Screen Reader Support
- ARIA labels for all interactive elements
- Live regions for dynamic content
- Descriptive alt text for images
- Semantic HTML structure

### Color Contrast
- Meet WCAG AA standards
- Don't rely solely on color for information
- Provide text alternatives for icons

## Testing Strategy

### Unit Tests
- Component rendering
- State management
- API integration
- Filter logic

### Integration Tests
- User interactions
- Navigation flows
- Error handling

### E2E Tests
- Complete user journeys
- Cross-browser compatibility
- Performance benchmarks

## Analytics & Monitoring

### User Events
- Page views
- Filter usage
- Item clicks
- Source clicks
- Time on page

### Performance Metrics
- Load time
- Time to interactive
- API response times
- Error rates

### Business Metrics
- Daily active users
- Items viewed per session
- Filter usage patterns
- Source popularity