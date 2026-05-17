export interface FiltersApplied {
  bbox?: boolean;
  country?: string;
  category?: string;
  search?: string;
}

export interface ListMetadata {
  mode: 'standard' | 'search';
  filtersApplied?: FiltersApplied;
  bboxApplied?: boolean;
  generatedAt: string;
}

export function buildFiltersApplied(
  hasBBox: boolean,
  country?: string,
  category?: string,
  search?: string
): FiltersApplied | undefined {
  const filters: FiltersApplied = {};

  if (hasBBox) filters.bbox = true;
  if (country) filters.country = country.toUpperCase();
  if (category) filters.category = category;
  if (search) filters.search = search;

  if (Object.keys(filters).length === 0) {
    return undefined;
  }

  return filters;
}

export function getMetadataMode(search?: string): 'standard' | 'search' {
  return search ? 'search' : 'standard';
}

export function buildListMetadata(
  hasBBox: boolean,
  filtersApplied: FiltersApplied | undefined,
  search?: string
): ListMetadata {
  return {
    mode: getMetadataMode(search),
    ...(filtersApplied && { filtersApplied }),
    ...(hasBBox && { bboxApplied: true }),
    generatedAt: new Date().toISOString(),
  };
}