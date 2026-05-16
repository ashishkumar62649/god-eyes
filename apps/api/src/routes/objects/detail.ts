import { query } from '../../lib/db.js';
import { rowToAirportObject } from './mapper.js';
import { buildListMetadata } from './metadata.js';
import {
  AirportDetailResponseSchema,
  AirportDetailMetadataSchema,
  RunwayDetailSchema,
  FrequencyDetailSchema,
  NavaidDetailSchema,
  CoordinateMode,
  CoordinateModes,
  ErrorCodes,
} from '@god-eyes/contracts';
import { ZodError } from 'zod';
import { tablesUnavailableError } from './errors.js';
import { DEFAULT_NAVAID_RADIUS_KM, MAX_NAVAID_RADIUS_KM, DEFAULT_NAVAID_LIMIT, MAX_NAVAID_LIMIT } from './validation.js';
import { AirportRow } from './types.js';

// Types for database rows
interface RunwayRow {
  id: string;
  airport_ident: string;
  length_ft: number | null;
  width_ft: number | null;
  surface: string | null;
  lighted: boolean | null;
  closed: boolean | null;
  le_ident: string | null;
  le_latitude_deg: number | null;
  le_longitude_deg: number | null;
  le_elevation_ft: number | null;
  le_heading_degT: number | null;
  he_ident: string | null;
  he_latitude_deg: number | null;
  he_longitude_deg: number | null;
  he_elevation_ft: number | null;
  he_heading_degT: number | null;
}

interface FrequencyRow {
  id: string;
  airport_ident: string;
  type: string;
  description: string | null;
  frequency_mhz: number | null;
}

interface NavaidRow {
  id: string;
  ident: string;
  name: string;
  type: string;
  frequency_khz: number | null;
  latitude_deg: number | null;
  longitude_deg: number | null;
  elevation_ft: number | null;
  distance_km: number | null;
}

interface OverrideRow {
  override_latitude: number | null;
  override_longitude: number | null;
}

export interface AirportDetailParams {
  objectId: string;
  coordinates: CoordinateMode;
  navaidRadiusKm: number;
  navaidLimit: number;
}

function toContractDateTime(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapRunway(row: RunwayRow) {
  return RunwayDetailSchema.parse({
    id: row.id,
    ident: row.airport_ident,
    lengthFt: row.length_ft,
    widthFt: row.width_ft,
    surface: row.surface,
    lighted: row.lighted,
    closed: row.closed,
    leIdent: row.le_ident,
    leLatitude: row.le_latitude_deg,
    leLongitude: row.le_longitude_deg,
    leElevationFt: row.le_elevation_ft,
    leHeadingDeg: row.le_heading_degT,
    heIdent: row.he_ident,
    heLatitude: row.he_latitude_deg,
    heLongitude: row.he_longitude_deg,
    heElevationFt: row.he_elevation_ft,
    heHeadingDeg: row.he_heading_degT,
  });
}

function mapFrequency(row: FrequencyRow) {
  return FrequencyDetailSchema.parse({
    id: row.id,
    type: row.type,
    description: row.description,
    frequencyMhz: row.frequency_mhz,
  });
}

function mapNavaid(row: NavaidRow) {
  return NavaidDetailSchema.parse({
    id: row.id,
    ident: row.ident,
    name: row.name,
    type: row.type,
    frequencyKhz: row.frequency_khz,
    latitude: row.latitude_deg,
    longitude: row.longitude_deg,
    elevationFt: row.elevation_ft,
    distanceKm: row.distance_km,
  });
}

export async function getAirportDetail(params: AirportDetailParams) {
  const { objectId, coordinates, navaidRadiusKm, navaidLimit } = params;

  // Get airport with optional override join
  let airportSql: string;
  let airportParams: unknown[];

  if (coordinates === CoordinateModes.EFFECTIVE) {
    airportSql = `
      SELECT a.*,
        COALESCE(o.override_latitude, a.latitude_deg) as effective_latitude,
        COALESCE(o.override_longitude, a.longitude_deg) as effective_longitude,
        o.id as override_id
      FROM aviation_airports a
      LEFT JOIN aviation_coordinate_overrides o
        ON a.source_id = o.source_id
        AND a.source_airport_id = o.source_object_id
        AND o.active = true
      WHERE a.id = $1
    `;
    airportParams = [objectId];
  } else {
    airportSql = 'SELECT * FROM aviation_airports WHERE id = $1';
    airportParams = [objectId];
  }

  const airportRows = await query<AirportRow & { effective_latitude?: number; effective_longitude?: number; override_id?: string }>(airportSql, airportParams);

  if (airportRows.length === 0) {
    return null;
  }

  const airportRow = airportRows[0];

  // Build airport object based on coordinate mode
  const baseAirport = rowToAirportObject(airportRow);
  const airport = coordinates === CoordinateModes.EFFECTIVE && airportRow.effective_latitude
    ? {
        ...baseAirport,
        position: {
          latitude: airportRow.effective_latitude,
          longitude: airportRow.effective_longitude,
        },
      }
    : baseAirport;

  // Get runways for this airport (by airport_ident)
  const runwayRows = await query<RunwayRow>(
    'SELECT * FROM aviation_runways WHERE airport_ident = $1 ORDER BY length_ft DESC NULLS LAST',
    [airportRow.ident]
  );
  const runways = runwayRows.map(mapRunway);

  // Get frequencies for this airport
  const freqRows = await query<FrequencyRow>(
    'SELECT * FROM aviation_airport_frequencies WHERE airport_ident = $1 ORDER BY type',
    [airportRow.ident]
  );
  const frequencies = freqRows.map(mapFrequency);

  // Get nearby navaids using bounded spatial lookup
  // Use the airport's effective coordinates if available
  const airportLat = coordinates === CoordinateModes.EFFECTIVE && airportRow.effective_latitude
    ? airportRow.effective_latitude
    : airportRow.latitude_deg;
  const airportLon = coordinates === CoordinateModes.EFFECTIVE && airportRow.effective_longitude
    ? airportRow.effective_longitude
    : airportRow.longitude_deg;

  let nearbyNavaids: ReturnType<typeof mapNavaid>[] = [];

  if (airportLat !== null && airportLon !== null) {
    // Use ST_DWithin with geography for accurate distance calculation
    // Convert km to meters for ST_DWithin
    const radiusMeters = navaidRadiusKm * 1000;

    const navaidSql = `
      SELECT n.*,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(n.longitude_deg, n.latitude_deg), 4326)::geography,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        ) / 1000.0 as distance_km
      FROM aviation_navaids n
      WHERE n.latitude_deg IS NOT NULL
        AND n.longitude_deg IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(n.longitude_deg, n.latitude_deg), 4326)::geography,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
          $3
        )
      ORDER BY distance_km ASC
      LIMIT $4
    `;

    const navaidRows = await query<NavaidRow>(navaidSql, [airportLat, airportLon, radiusMeters, navaidLimit]);
    nearbyNavaids = navaidRows.map(mapNavaid);
  }

  // Build metadata
  const metadata = AirportDetailMetadataSchema.parse({
    generatedAt: new Date().toISOString(),
    layerId: 'layer_01_aviation',
    objectId,
    coordinates: coordinates === CoordinateModes.EFFECTIVE ? 'effective' : undefined,
    runwayCount: runways.length,
    frequencyCount: frequencies.length,
    nearbyNavaidCount: nearbyNavaids.length,
    navaidRadiusKm,
  });

  return AirportDetailResponseSchema.parse({
    airport,
    runways,
    frequencies,
    nearbyNavaids,
    metadata,
  });
}

export async function handleAirportDetail(params: AirportDetailParams) {
  try {
    const result = await getAirportDetail(params);
    if (result === null) {
      throw new Error('NOT_FOUND');
    }
    return result;
  } catch (error) {
    // Let Zod validation errors propagate as-is rather than mislabeling as DATABASE_OFFLINE
    // This helps catch mapping bugs earlier (e.g., column name mismatches)
    if (error instanceof ZodError) {
      throw error;
    }
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      throw error;
    }
    throw new Error(ErrorCodes.DATABASE_OFFLINE);
  }
}