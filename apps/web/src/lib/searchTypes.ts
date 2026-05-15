export type SearchResultType = 'Airport' | 'Coordinates' | 'Place';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  position: {
    latitude: number;
    longitude: number;
  };
  rawData?: any;
}
