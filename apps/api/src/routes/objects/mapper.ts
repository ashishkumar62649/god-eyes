import { AirportObject, AirportMarkerObject } from '@god-eyes/contracts';
import { AirportRow, toContractDateTime } from './types.js';

export function rowToAirportObject(row: AirportRow): AirportObject {
  return {
    id: row.id,
    layerId: row.layer_id,
    objectType: 'airport' as const,
    sourceId: row.source_id,
    sourceObjectId: row.source_airport_id,
    name: row.name,
    ident: row.ident,
    iataCode: row.iata_code,
    category: row.category_normalized,
    typeSource: row.type_source,
    country: row.iso_country,
    region: row.iso_region,
    municipality: row.municipality,
    position: {
      latitude: row.latitude_deg,
      longitude: row.longitude_deg,
    },
    elevationFt: row.elevation_ft,
    createdAt: toContractDateTime(row.created_at),
    updatedAt: toContractDateTime(row.updated_at),
  };
}

export function rowToAirportMarkerObject(row: AirportRow): AirportMarkerObject {
  return {
    id: row.id,
    layerId: row.layer_id,
    objectType: 'airport' as const,
    name: row.name,
    ident: row.ident,
    iataCode: row.iata_code,
    category: row.category_normalized,
    municipality: row.municipality,
    country: row.iso_country,
    position: {
      latitude: row.latitude_deg,
      longitude: row.longitude_deg,
    },
    elevationFt: row.elevation_ft,
    updatedAt: toContractDateTime(row.updated_at),
  };
}