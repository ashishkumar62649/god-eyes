import * as repository from './repository.js';
import {
  AirportIntelligenceResponse,
  MapPopup,
  Overview,
  Capability,
  Infrastructure,
  Capacity,
  Traffic,
  Sources,
  Advanced,
  ModuleStatusEntry,
  SourceItem,
  TrafficMetric,
  CapacityData,
} from './types.js';

function toDate(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getMapPopupSection(payload: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!payload) return null;
  const nested = payload.map_popup ?? payload.mapPopup;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return payload;
}

function str(payload: Record<string, unknown> | null, ...keys: string[]): string | null {
  if (!payload) return null;
  for (const key of keys) {
    const v = payload[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function extractOpenedDate(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const section = getMapPopupSection(payload);
  return str(section, 'openedDate', 'opened_date') ?? str(payload, 'openedDate', 'opened_date');
}

function extractOpenedYear(payload: Record<string, unknown> | null): number | null {
  if (!payload) return null;
  const section = getMapPopupSection(payload);
  const val = section?.openedYear ?? section?.opened_year ?? payload.openedYear ?? payload.opened_year;
  return toNumber(val);
}

function extractImageUrl(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const section = getMapPopupSection(payload);
  return str(section, 'imageUrl', 'image_url', 'thumbnailUrl', 'thumbnail_url')
    ?? str(payload, 'imageUrl', 'image_url', 'thumbnailUrl', 'thumbnail_url');
}

function extractShortSummary(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const section = getMapPopupSection(payload);
  return str(section, 'shortSummary', 'short_summary', 'summary')
    ?? str(payload, 'shortSummary', 'short_summary', 'summary');
}

function extractBadges(payload: Record<string, unknown> | null): string[] {
  if (!payload) return [];
  const section = getMapPopupSection(payload);
  const badges = section?.badges ?? payload.badges;
  if (Array.isArray(badges)) {
    return badges.filter((b): b is string => typeof b === 'string');
  }
  return [];
}

function extractQuickStats(payload: Record<string, unknown> | null): { runwayCount: number | null; longestRunwayFt: number | null } {
  if (!payload) return { runwayCount: null, longestRunwayFt: null };
  const section = getMapPopupSection(payload);
  const qs = section?.quickStats ?? section?.quick_stats ?? payload.quickStats ?? payload.quick_stats;
  if (qs && typeof qs === 'object' && !Array.isArray(qs)) {
    const q = qs as Record<string, unknown>;
    return {
      runwayCount: toNumber(q.runwayCount ?? q.runway_count),
      longestRunwayFt: toNumber(q.longestRunwayFt ?? q.longest_runway_ft),
    };
  }
  return { runwayCount: null, longestRunwayFt: null };
}

function extractConfidenceLabel(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const section = getMapPopupSection(payload);
  return str(section, 'confidenceLabel', 'confidence_label')
    ?? str(payload, 'confidenceLabel', 'confidence_label');
}

function buildMapPopupFromModulePayload(
  payload: Record<string, unknown> | null,
  derived: repository.DerivedIntelligenceRow | null,
  airportBase: repository.AirportBaseRow | null,
  publicProfile: repository.PublicProfileRow | null,
): MapPopup {
  const profilePayload = publicProfile?.profile_payload ?? null;
  const section = getMapPopupSection(payload);

  const airportName = str(section, 'airportName', 'airport_name') ?? airportBase?.name ?? null;
  const iata = str(section, 'iata', 'iataCode', 'iata_code') ?? airportBase?.iata_code ?? null;
  const icao = str(section, 'icao', 'icaoCode', 'icao_code') ?? airportBase?.gps_code ?? null;
  const city = str(section, 'city') ?? airportBase?.municipality ?? null;
  const country = str(section, 'country') ?? airportBase?.iso_country ?? null;
  const imageUrl = extractImageUrl(payload) ?? extractImageUrl(profilePayload) ?? null;
  const shortSummary = extractShortSummary(payload) ?? extractShortSummary(profilePayload) ?? null;
  const badges = extractBadges(payload);
  const finalBadges = badges.length > 0 ? badges : (derived?.capability_tags ?? []);
  const openedDate = extractOpenedDate(payload) ?? extractOpenedDate(profilePayload) ?? null;
  const openedYear = extractOpenedYear(payload) ?? extractOpenedYear(profilePayload) ?? null;

  const qs = extractQuickStats(payload);
  const runwayCount = qs.runwayCount ?? derived?.runway_count ?? null;
  const longestRunwayFt = qs.longestRunwayFt ?? derived?.longest_runway_ft ?? null;

  const confLabel = extractConfidenceLabel(payload);
  const confidenceLabel = confLabel ?? (derived?.confidence_score != null
    ? (Number(derived.confidence_score) >= 0.8 ? 'high' : Number(derived.confidence_score) >= 0.5 ? 'medium' : 'low')
    : null);

  return {
    airportName,
    iata,
    icao,
    city,
    country,
    imageUrl,
    shortSummary,
    badges: finalBadges,
    openedDate,
    openedYear,
    quickStats: {
      runwayCount,
      longestRunwayFt,
      passengers: null,
    },
    confidenceLabel,
  };
}

function buildMapPopupFromFallback(
  airportBase: repository.AirportBaseRow,
  publicProfile: repository.PublicProfileRow | null,
  derived: repository.DerivedIntelligenceRow | null,
): MapPopup {
  const profilePayload = publicProfile?.profile_payload ?? null;

  return {
    airportName: airportBase.name,
    iata: airportBase.iata_code,
    icao: airportBase.gps_code,
    city: airportBase.municipality,
    country: airportBase.iso_country,
    imageUrl: extractImageUrl(profilePayload) ?? null,
    shortSummary: publicProfile?.profile_summary ?? extractShortSummary(profilePayload) ?? null,
    badges: derived?.capability_tags ?? [],
    openedDate: extractOpenedDate(profilePayload) ?? null,
    openedYear: extractOpenedYear(profilePayload) ?? null,
    quickStats: {
      runwayCount: derived?.runway_count ?? null,
      longestRunwayFt: derived?.longest_runway_ft ?? null,
      passengers: null,
    },
    confidenceLabel: derived?.confidence_score != null
      ? (Number(derived.confidence_score) >= 0.8 ? 'high' : Number(derived.confidence_score) >= 0.5 ? 'medium' : 'low')
      : null,
  };
}

function buildOverview(
  overviewModule: repository.IntelligenceModuleRow | null,
  publicProfile: repository.PublicProfileRow | null,
): Overview {
  if (overviewModule) {
    const payload = overviewModule.data_payload;
    const profilePayload = publicProfile?.profile_payload ?? null;

    const sourceAttr = overviewModule.source_summary ?? publicProfile?.source_attribution ?? null;
    const source = str(sourceAttr as Record<string, unknown> | null, 'source', 'source_type');

    const section = getMapPopupSection(payload);
    const summary = str(section, 'shortSummary', 'short_summary', 'summary')
      ?? publicProfile?.profile_summary
      ?? str(payload, 'shortSummary', 'short_summary', 'summary')
      ?? null;

    return {
      status: overviewModule.module_status === 'ok' ? 'ok' : overviewModule.module_status === 'no_data' ? 'missing' : 'partial',
      summary,
      imageUrl: extractImageUrl(payload) ?? extractImageUrl(profilePayload) ?? null,
      openedDate: extractOpenedDate(payload) ?? extractOpenedDate(profilePayload) ?? null,
      openedYear: extractOpenedYear(payload) ?? extractOpenedYear(profilePayload) ?? null,
      source,
    };
  }

  if (publicProfile) {
    const profilePayload = publicProfile.profile_payload;
    const sourceAttr = publicProfile.source_attribution;
    const source = str(sourceAttr as Record<string, unknown> | null, 'source', 'source_type');

    return {
      status: publicProfile.profile_summary ? 'partial' : 'missing',
      summary: publicProfile.profile_summary ?? extractShortSummary(profilePayload) ?? null,
      imageUrl: extractImageUrl(profilePayload) ?? null,
      openedDate: extractOpenedDate(profilePayload) ?? null,
      openedYear: extractOpenedYear(profilePayload) ?? null,
      source,
    };
  }

  return {
    status: 'missing',
    summary: null,
    imageUrl: null,
    openedDate: null,
    openedYear: null,
    source: null,
  };
}

function buildCapability(
  capabilityModule: repository.IntelligenceModuleRow | null,
  derived: repository.DerivedIntelligenceRow | null,
): Capability {
  if (derived) {
    return {
      status: derived.airport_class ? 'ok' : 'partial',
      airportClass: derived.airport_class,
      runwayCapability: derived.runway_capability,
      operatingRole: derived.operating_role,
      tags: derived.capability_tags ?? [],
    };
  }

  if (capabilityModule?.data_payload) {
    const p = capabilityModule.data_payload;
    return {
      status: 'partial',
      airportClass: str(p, 'airportClass', 'airport_class'),
      runwayCapability: str(p, 'runwayCapability', 'runway_capability'),
      operatingRole: str(p, 'operatingRole', 'operating_role'),
      tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    };
  }

  return {
    status: 'missing',
    airportClass: null,
    runwayCapability: null,
    operatingRole: null,
    tags: [],
  };
}

function buildInfrastructure(
  infrastructureModule: repository.IntelligenceModuleRow | null,
  derived: repository.DerivedIntelligenceRow | null,
): Infrastructure {
  if (derived && (derived.runway_count != null || derived.longest_runway_ft != null)) {
    return {
      status: 'ok',
      runwayCount: derived.runway_count,
      longestRunwayFt: derived.longest_runway_ft,
      surfaces: [],
      runwayCapability: derived.runway_capability,
    };
  }

  if (infrastructureModule?.data_payload) {
    const p = infrastructureModule.data_payload;
    return {
      status: 'partial',
      runwayCount: toNumber(p.runwayCount ?? p.runway_count),
      longestRunwayFt: toNumber(p.longestRunwayFt ?? p.longest_runway_ft),
      surfaces: Array.isArray(p.surfaces) ? (p.surfaces as string[]) : [],
      runwayCapability: str(p, 'runwayCapability', 'runway_capability'),
    };
  }

  return {
    status: 'missing',
    runwayCount: null,
    longestRunwayFt: null,
    surfaces: [],
    runwayCapability: null,
  };
}

function buildCapacity(capacityProfile: repository.CapacityProfileRow | null): Capacity {
  if (!capacityProfile) {
    return {
      status: 'no_data',
      data: null,
    };
  }

  const data: CapacityData = {
    annualPassengerCapacity: capacityProfile.annual_passenger_capacity,
    terminalCapacity: capacityProfile.terminal_capacity,
    runwayMovementCapacityPerHour: capacityProfile.runway_movement_capacity_per_hour,
    terminalCount: capacityProfile.terminal_count,
    gateCount: capacityProfile.gate_count,
    standCount: capacityProfile.stand_count,
    aircraftStandCount: capacityProfile.aircraft_stand_count,
    checkInCounterCount: capacityProfile.check_in_counter_count,
    baggageBeltCount: capacityProfile.baggage_belt_count,
    capacityYear: capacityProfile.capacity_year,
    capacityBasis: capacityProfile.capacity_basis,
    confidenceLabel: capacityProfile.confidence_label,
    confidenceScore: capacityProfile.confidence_score != null ? Number(capacityProfile.confidence_score) : null,
    capacityStatus: capacityProfile.capacity_status,
    notes: capacityProfile.notes,
  };

  return {
    status: 'ok',
    data,
  };
}

function buildTraffic(trafficMetrics: repository.TrafficMetricRow[]): Traffic {
  if (trafficMetrics.length === 0) {
    return {
      status: 'no_data',
      data: [],
    };
  }

  const data: TrafficMetric[] = trafficMetrics.map((m) => ({
    metricType: m.metric_type,
    periodYear: m.period_year,
    metricValue: Number(m.metric_value),
    metricUnit: m.metric_unit,
    confidenceLabel: m.confidence_label,
    confidenceScore: m.confidence_score != null ? Number(m.confidence_score) : null,
  }));

  return {
    status: 'ok',
    data,
  };
}

function buildSources(sourceLinks: repository.SourceLinkRow[]): Sources {
  if (sourceLinks.length === 0) {
    return {
      status: 'missing',
      items: [],
    };
  }

  const items: SourceItem[] = sourceLinks.map((s) => ({
    sourceType: s.source_type,
    sourceName: s.source_name,
    sourceUrl: s.source_url,
    sourceEntityId: s.source_entity_id,
    attributionText: s.attribution_text,
    isPrimary: s.is_primary,
    confidenceLabel: s.confidence_label,
  }));

  return {
    status: 'ok',
    items,
  };
}

function buildAdvanced(modules: repository.IntelligenceModuleRow[]): Advanced {
  const moduleStatuses: ModuleStatusEntry[] = modules.map((m) => ({
    moduleKey: m.module_key,
    moduleStatus: m.module_status,
    cacheState: m.cache_state,
    confidenceLabel: m.confidence_label,
    confidenceScore: m.confidence_score != null ? Number(m.confidence_score) : null,
  }));

  const cache: Record<string, unknown> = {};
  const confidence: Record<string, unknown> = {};

  for (const m of modules) {
    cache[m.module_key] = {
      cacheState: m.cache_state,
      fetchedAt: toDate(m.fetched_at),
      staleAt: toDate(m.stale_at),
      expiresAt: toDate(m.expires_at),
    };
    if (m.confidence_label != null || m.confidence_score != null) {
      confidence[m.module_key] = {
        label: m.confidence_label,
        score: m.confidence_score != null ? Number(m.confidence_score) : null,
      };
    }
  }

  return {
    moduleStatuses,
    cache,
    confidence,
  };
}

function determineResponseStatus(
  airportBase: repository.AirportBaseRow | null,
  modules: repository.IntelligenceModuleRow[],
  sourceLinks: repository.SourceLinkRow[],
  derived: repository.DerivedIntelligenceRow | null,
  capacityProfile: repository.CapacityProfileRow | null,
  trafficMetrics: repository.TrafficMetricRow[],
): 'ok' | 'partial' | 'no_data' {
  if (!airportBase) return 'no_data';

  const hasAnyIntelligence =
    modules.length > 0 ||
    sourceLinks.length > 0 ||
    derived != null ||
    capacityProfile != null ||
    trafficMetrics.length > 0;

  if (!hasAnyIntelligence) return 'no_data';

  const hasAllCoreModules =
    modules.some((m) => m.module_key === 'overview') &&
    modules.some((m) => m.module_key === 'capability') &&
    modules.some((m) => m.module_key === 'infrastructure') &&
    derived != null;

  return hasAllCoreModules ? 'ok' : 'partial';
}

export async function getAirportIntelligence(airportId: string): Promise<AirportIntelligenceResponse> {
  const airportBase = await repository.getAirportBase(airportId);

  if (!airportBase) {
    return {
      status: 'not_found',
      airportId,
      generatedAt: new Date().toISOString(),
      mapPopup: {
        airportName: null,
        iata: null,
        icao: null,
        city: null,
        country: null,
        imageUrl: null,
        shortSummary: null,
        badges: [],
        openedDate: null,
        openedYear: null,
        quickStats: { runwayCount: null, longestRunwayFt: null, passengers: null },
        confidenceLabel: null,
      },
      overview: { status: 'missing', summary: null, imageUrl: null, openedDate: null, openedYear: null, source: null },
      capability: { status: 'missing', airportClass: null, runwayCapability: null, operatingRole: null, tags: [] },
      infrastructure: { status: 'missing', runwayCount: null, longestRunwayFt: null, surfaces: [], runwayCapability: null },
      capacity: { status: 'no_data', data: null },
      traffic: { status: 'no_data', data: [] },
      sources: { status: 'missing', items: [] },
      advanced: { moduleStatuses: [], cache: {}, confidence: {} },
    };
  }

  const [modules, sourceLinks, derived, capacityProfile, trafficMetrics, publicProfile] = await Promise.all([
    repository.getIntelligenceModules(airportId),
    repository.getSourceLinks(airportId),
    repository.getDerivedIntelligence(airportId),
    repository.getCapacityProfile(airportId),
    repository.getTrafficMetrics(airportId),
    repository.getPublicProfile(airportId),
  ]);

  const overviewModule = modules.find((m) => m.module_key === 'overview') ?? null;
  const capabilityModule = modules.find((m) => m.module_key === 'capability') ?? null;
  const infrastructureModule = modules.find((m) => m.module_key === 'infrastructure') ?? null;

  const overviewModulePayload = overviewModule?.data_payload ?? null;

  let mapPopup: MapPopup;
  if (overviewModulePayload) {
    mapPopup = buildMapPopupFromModulePayload(overviewModulePayload, derived, airportBase, publicProfile);
  } else {
    mapPopup = buildMapPopupFromFallback(airportBase, publicProfile, derived);
  }

  const status = determineResponseStatus(airportBase, modules, sourceLinks, derived, capacityProfile, trafficMetrics);

  return {
    status,
    airportId,
    generatedAt: new Date().toISOString(),
    mapPopup,
    overview: buildOverview(overviewModule, publicProfile),
    capability: buildCapability(capabilityModule, derived),
    infrastructure: buildInfrastructure(infrastructureModule, derived),
    capacity: buildCapacity(capacityProfile),
    traffic: buildTraffic(trafficMetrics),
    sources: buildSources(sourceLinks),
    advanced: buildAdvanced(modules),
  };
}
