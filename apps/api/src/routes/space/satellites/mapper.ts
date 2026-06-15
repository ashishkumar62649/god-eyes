import type { SatelliteRow } from './types.js';

export function rowToItem(row: SatelliteRow) {
  return {
    satelliteId: row.satelliteId,
    noradId: row.noradId,
    name: row.name,
    objectType: row.objectType,
    category: row.category,
    orbitClass: row.orbitClass,
    country: row.country,
    launchDate: row.launchDate,
    position: { latitude: row.latitude, longitude: row.longitude, altitudeKm: row.altitudeKm },
    velocity: { speedKms: row.velocityKms },
    headingDeg: row.headingDeg,
    visualShape: row.visualShape,
    visualColor: row.visualColor,
    important: row.important,
    estimatedAt: row.estimatedAt,
    sourceId: row.sourceId,
    sourceObjectId: row.sourceObjectId,
    sourceAgeSeconds: row.sourceAgeSeconds,
  };
}

export function rowToDetail(row: SatelliteRow) {
  return { ...rowToItem(row), operator: row.operator ?? null };
}
