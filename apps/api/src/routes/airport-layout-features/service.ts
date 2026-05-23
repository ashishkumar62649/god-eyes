import * as repository from './repository.js';
import type {
    AirportLayoutFeaturesResponse,
    AirportLayoutFeature,
    LayoutFeatureGeometry,
} from './types.js';

function parseGeometry(geometryWkt: string): LayoutFeatureGeometry {
    const wktUpper = geometryWkt.toUpperCase().trim();

    if (wktUpper.startsWith('LINESTRING')) {
        const coordsStr = geometryWkt.replace(/^LINESTRING\s*\(/i, '').replace(/\)$/, '');
        const pairs = coordsStr.split(',').map(p => p.trim().split(' ').map(Number));
        return {
            type: 'LineString' as const,
            coordinates: pairs,
        };
    }

    if (wktUpper.startsWith('POINT')) {
        const coordsStr = geometryWkt.replace(/^POINT\s*\(/i, '').replace(/\)$/, '');
        const coords = coordsStr.split(' ').map(Number);
        return {
            type: 'Point' as const,
            coordinates: coords,
        };
    }

    if (wktUpper.startsWith('POLYGON')) {
        const coordsStr = geometryWkt.replace(/^POLYGON\s*\(/i, '').replace(/\)$/, '');
        const ringStrs = coordsStr.split('),');
        const rings = ringStrs.map(ring => {
            const coords = ring.replace(/[()]/g, '').split(',').map(p => {
                const nums = p.trim().split(' ').map(Number);
                return nums;
            });
            return coords;
        });
        return {
            type: 'Polygon' as const,
            coordinates: rings,
        };
    }

    return {
        type: 'LineString' as const,
        coordinates: [],
    };
}

function parseCentroid(centroidWkt: string | null): number[] | null {
    if (!centroidWkt) return null;
    const coordsStr = centroidWkt.replace(/^POINT\s*\(/i, '').replace(/\)$/, '');
    return coordsStr.split(' ').map(Number);
}

export async function getAirportLayoutFeatures(
    airportId: string,
    includeInactive: boolean = false,
    featureType: string | null = null,
): Promise<AirportLayoutFeaturesResponse> {
    const exists = await repository.airportExists(airportId);
    if (!exists) {
        return {
            status: 'not_found',
            airportId,
            generatedAt: new Date().toISOString(),
            features: [],
            summary: null,
        };
    }

    const rows = await repository.getAirportLayoutFeatures(airportId, includeInactive, featureType);

    if (rows.length === 0) {
        return {
            status: 'no_data',
            airportId,
            generatedAt: new Date().toISOString(),
            features: [],
            summary: null,
        };
    }

    const features: AirportLayoutFeature[] = rows.map(row => {
        const geometry = parseGeometry(row.geometry);

        return {
            id: row.id,
            featureType: row.feature_type,
            featureSubtype: row.feature_subtype,
            featureName: row.feature_name,
            sourceType: row.source_type,
            geometryType: row.geometry_type as 'line' | 'point' | 'polygon',
            geometry,
            centroid: parseCentroid(row.centroid),
            bbox: null,
            confidenceLabel: row.confidence_label,
            confidenceScore: row.confidence_score != null ? Number(row.confidence_score) : null,
            rank: row.rank,
            isPrimary: row.is_primary,
            isActive: row.is_active,
            fetchedAt: row.fetched_at ? new Date(row.fetched_at).toISOString() : null,
        };
    });

    const summary = await repository.getAirportLayoutFeatureSummary(airportId, includeInactive);

    return {
        status: 'ok',
        airportId,
        generatedAt: new Date().toISOString(),
        features,
        summary: {
            totalFeatures: summary.totalFeatures,
            byType: summary.byType,
            sourceTypes: summary.sourceTypes,
            hasRunways: summary.hasRunways,
            hasTaxiways: summary.hasTaxiways,
            hasAprons: summary.hasAprons,
            hasTerminals: summary.hasTerminals,
        },
    };
}