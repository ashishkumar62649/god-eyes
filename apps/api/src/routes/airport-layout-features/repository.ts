import { query } from '../../lib/db.js';

export interface LayoutFeatureRow {
    id: string;
    feature_type: string;
    feature_subtype: string | null;
    feature_name: string | null;
    source_type: string;
    geometry: string;
    geometry_type: string;
    centroid: string | null;
    is_active: boolean;
    confidence_label: string | null;
    confidence_score: number | null;
    rank: number | null;
    is_primary: boolean;
    fetched_at: Date | string | null;
}

export async function getAirportLayoutFeatures(
    airportId: string,
    includeInactive: boolean = false,
    featureType: string | null = null,
): Promise<LayoutFeatureRow[]> {
    let sql: string;
    const params: (string | boolean)[] = [airportId];

    if (includeInactive) {
        if (featureType) {
            sql = `
                SELECT id, feature_type, feature_subtype, feature_name, source_type,
                       geometry, geometry_type, centroid, is_active,
                       confidence_label, confidence_score, rank, is_primary, fetched_at
                FROM airport_layout_features
                WHERE airport_id = $1 AND feature_type = $2
                ORDER BY rank ASC, feature_name ASC
            `;
            params.push(featureType);
        } else {
            sql = `
                SELECT id, feature_type, feature_subtype, feature_name, source_type,
                       geometry, geometry_type, centroid, is_active,
                       confidence_label, confidence_score, rank, is_primary, fetched_at
                FROM airport_layout_features
                WHERE airport_id = $1
                ORDER BY rank ASC, feature_name ASC
            `;
        }
    } else {
        if (featureType) {
            sql = `
                SELECT id, feature_type, feature_subtype, feature_name, source_type,
                       geometry, geometry_type, centroid, is_active,
                       confidence_label, confidence_score, rank, is_primary, fetched_at
                FROM airport_layout_features
                WHERE airport_id = $1 AND is_active = true AND feature_type = $2
                ORDER BY rank ASC, feature_name ASC
            `;
            params.push(featureType);
        } else {
            sql = `
                SELECT id, feature_type, feature_subtype, feature_name, source_type,
                       geometry, geometry_type, centroid, is_active,
                       confidence_label, confidence_score, rank, is_primary, fetched_at
                FROM airport_layout_features
                WHERE airport_id = $1 AND is_active = true
                ORDER BY rank ASC, feature_name ASC
            `;
        }
    }

    return query<LayoutFeatureRow>(sql, params);
}

export interface LayoutFeatureSummaryRow {
    feature_type: string;
    count: string;
}

export async function getAirportLayoutFeatureSummary(
    airportId: string,
    includeInactive: boolean = false,
): Promise<{
    totalFeatures: number;
    byType: Record<string, number>;
    sourceTypes: string[];
    hasRunways: boolean;
    hasTaxiways: boolean;
    hasAprons: boolean;
    hasTerminals: boolean;
}> {
    let whereClause: string;
    const params: (string | boolean)[] = [airportId];

    if (includeInactive) {
        whereClause = "WHERE airport_id = $1";
    } else {
        whereClause = "WHERE airport_id = $1 AND is_active = true";
    }

    const typeRows = await query<LayoutFeatureSummaryRow>(
        `SELECT feature_type, COUNT(*) as count
         FROM airport_layout_features
         ${whereClause}
         GROUP BY feature_type`,
        params
    );

    const byType: Record<string, number> = {};
    let total = 0;
    for (const row of typeRows) {
        const count = parseInt(row.count, 10);
        byType[row.feature_type] = count;
        total += count;
    }

    const sourceTypeRows = await query<{ source_type: string }>(
        `SELECT DISTINCT source_type
         FROM airport_layout_features
         ${whereClause}`,
        params
    );
    const sourceTypes = sourceTypeRows.map(r => r.source_type);

    return {
        totalFeatures: total,
        byType,
        sourceTypes,
        hasRunways: 'runway' in byType,
        hasTaxiways: 'taxiway' in byType,
        hasAprons: 'apron' in byType,
        hasTerminals: 'terminal' in byType,
    };
}

export async function airportExists(airportId: string): Promise<boolean> {
    const rows = await query<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM aviation_airports WHERE id = $1) as exists',
        [airportId]
    );
    return rows[0]?.exists ?? false;
}