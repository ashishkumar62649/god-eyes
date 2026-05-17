import { describe, expect, it } from 'vitest';
import { rowToAirportObject } from '../src/routes/objects.js';

describe('airport object mapper', () => {
  it('serializes database timestamp Date values to contract datetime strings', () => {
    const airport = rowToAirportObject({
      id: '7686e881-8f28-4159-98db-366c64d5714a',
      layer_id: 'layer_01_aviation',
      source_id: 'ourairports',
      source_airport_id: '123',
      ident: 'OMDB',
      type_source: 'large_airport',
      category_normalized: 'international_or_major_airport',
      name: 'Dubai International Airport',
      latitude_deg: 25.2498,
      longitude_deg: 55.371,
      elevation_ft: 62,
      iso_country: 'AE',
      iso_region: 'AE-DU',
      municipality: 'Dubai',
      iata_code: 'DXB',
      created_at: new Date('2026-05-14T12:00:00.000Z'),
      updated_at: new Date('2026-05-14T12:05:00.000Z'),
    } as any);

    expect(airport.createdAt).toBe('2026-05-14T12:00:00.000Z');
    expect(airport.updatedAt).toBe('2026-05-14T12:05:00.000Z');
  });
});
