import { z } from 'zod';
export declare const HealthResponseSchema: z.ZodObject<{
    status: z.ZodEnum<["ok", "degraded"]>;
    service: z.ZodString;
    timestamp: z.ZodString;
    database: z.ZodObject<{
        status: z.ZodEnum<["connected", "offline"]>;
        latencyMs: z.ZodNullable<z.ZodNumber>;
        message: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "connected" | "offline";
        message: string | null;
        latencyMs: number | null;
    }, {
        status: "connected" | "offline";
        message: string | null;
        latencyMs: number | null;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "ok" | "degraded";
    service: string;
    timestamp: string;
    database: {
        status: "connected" | "offline";
        message: string | null;
        latencyMs: number | null;
    };
}, {
    status: "ok" | "degraded";
    service: string;
    timestamp: string;
    database: {
        status: "connected" | "offline";
        message: string | null;
        latencyMs: number | null;
    };
}>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export declare const LayerInfoSchema: z.ZodObject<{
    layerId: z.ZodString;
    name: z.ZodString;
    status: z.ZodEnum<["available", "unavailable", "not_configured"]>;
    description: z.ZodString;
    objectTypes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    status: "available" | "unavailable" | "not_configured";
    layerId: string;
    name: string;
    description: string;
    objectTypes: string[];
}, {
    status: "available" | "unavailable" | "not_configured";
    layerId: string;
    name: string;
    description: string;
    objectTypes: string[];
}>;
export declare const LayersListResponseSchema: z.ZodObject<{
    layers: z.ZodArray<z.ZodObject<{
        layerId: z.ZodString;
        name: z.ZodString;
        status: z.ZodEnum<["available", "unavailable", "not_configured"]>;
        description: z.ZodString;
        objectTypes: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        status: "available" | "unavailable" | "not_configured";
        layerId: string;
        name: string;
        description: string;
        objectTypes: string[];
    }, {
        status: "available" | "unavailable" | "not_configured";
        layerId: string;
        name: string;
        description: string;
        objectTypes: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    layers: {
        status: "available" | "unavailable" | "not_configured";
        layerId: string;
        name: string;
        description: string;
        objectTypes: string[];
    }[];
}, {
    layers: {
        status: "available" | "unavailable" | "not_configured";
        layerId: string;
        name: string;
        description: string;
        objectTypes: string[];
    }[];
}>;
export type LayerInfo = z.infer<typeof LayerInfoSchema>;
export type LayersListResponse = z.infer<typeof LayersListResponseSchema>;
export declare const LayerStatusResponseSchema: z.ZodObject<{
    layerId: z.ZodString;
    status: z.ZodEnum<["ok", "degraded", "not_configured"]>;
    sourceId: z.ZodNullable<z.ZodString>;
    objectCounts: z.ZodObject<{
        airports: z.ZodNumber;
        runways: z.ZodNumber;
        navaids: z.ZodNumber;
        airportFrequencies: z.ZodNumber;
        countries: z.ZodNumber;
        regions: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        airports: number;
        runways: number;
        navaids: number;
        airportFrequencies: number;
        countries: number;
        regions: number;
    }, {
        airports: number;
        runways: number;
        navaids: number;
        airportFrequencies: number;
        countries: number;
        regions: number;
    }>;
    database: z.ZodObject<{
        status: z.ZodEnum<["connected", "offline"]>;
    }, "strip", z.ZodTypeAny, {
        status: "connected" | "offline";
    }, {
        status: "connected" | "offline";
    }>;
}, "strip", z.ZodTypeAny, {
    status: "ok" | "degraded" | "not_configured";
    database: {
        status: "connected" | "offline";
    };
    layerId: string;
    sourceId: string | null;
    objectCounts: {
        airports: number;
        runways: number;
        navaids: number;
        airportFrequencies: number;
        countries: number;
        regions: number;
    };
}, {
    status: "ok" | "degraded" | "not_configured";
    database: {
        status: "connected" | "offline";
    };
    layerId: string;
    sourceId: string | null;
    objectCounts: {
        airports: number;
        runways: number;
        navaids: number;
        airportFrequencies: number;
        countries: number;
        regions: number;
    };
}>;
export type LayerStatusResponse = z.infer<typeof LayerStatusResponseSchema>;
export declare const PaginationSchema: z.ZodObject<{
    limit: z.ZodNumber;
    offset: z.ZodNumber;
    returned: z.ZodNumber;
    total: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    returned: number;
    total?: number | undefined;
}, {
    limit: number;
    offset: number;
    returned: number;
    total?: number | undefined;
}>;
export type Pagination = z.infer<typeof PaginationSchema>;
export declare const AirportPositionSchema: z.ZodObject<{
    latitude: z.ZodNullable<z.ZodNumber>;
    longitude: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    latitude: number | null;
    longitude: number | null;
}, {
    latitude: number | null;
    longitude: number | null;
}>;
export declare const AirportObjectSchema: z.ZodObject<{
    id: z.ZodString;
    layerId: z.ZodString;
    objectType: z.ZodLiteral<"airport">;
    sourceId: z.ZodString;
    sourceObjectId: z.ZodString;
    name: z.ZodString;
    ident: z.ZodString;
    iataCode: z.ZodNullable<z.ZodString>;
    category: z.ZodString;
    typeSource: z.ZodString;
    country: z.ZodNullable<z.ZodString>;
    region: z.ZodNullable<z.ZodString>;
    municipality: z.ZodNullable<z.ZodString>;
    position: z.ZodObject<{
        latitude: z.ZodNullable<z.ZodNumber>;
        longitude: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        latitude: number | null;
        longitude: number | null;
    }, {
        latitude: number | null;
        longitude: number | null;
    }>;
    elevationFt: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    layerId: string;
    name: string;
    sourceId: string;
    id: string;
    objectType: "airport";
    sourceObjectId: string;
    ident: string;
    iataCode: string | null;
    category: string;
    typeSource: string;
    country: string | null;
    region: string | null;
    municipality: string | null;
    position: {
        latitude: number | null;
        longitude: number | null;
    };
    elevationFt: number | null;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
}, {
    layerId: string;
    name: string;
    sourceId: string;
    id: string;
    objectType: "airport";
    sourceObjectId: string;
    ident: string;
    iataCode: string | null;
    category: string;
    typeSource: string;
    country: string | null;
    region: string | null;
    municipality: string | null;
    position: {
        latitude: number | null;
        longitude: number | null;
    };
    elevationFt: number | null;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
}>;
export type AirportPosition = z.infer<typeof AirportPositionSchema>;
export type AirportObject = z.infer<typeof AirportObjectSchema>;
export declare const LayerObjectsListResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        layerId: z.ZodString;
        objectType: z.ZodLiteral<"airport">;
        sourceId: z.ZodString;
        sourceObjectId: z.ZodString;
        name: z.ZodString;
        ident: z.ZodString;
        iataCode: z.ZodNullable<z.ZodString>;
        category: z.ZodString;
        typeSource: z.ZodString;
        country: z.ZodNullable<z.ZodString>;
        region: z.ZodNullable<z.ZodString>;
        municipality: z.ZodNullable<z.ZodString>;
        position: z.ZodObject<{
            latitude: z.ZodNullable<z.ZodNumber>;
            longitude: z.ZodNullable<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            latitude: number | null;
            longitude: number | null;
        }, {
            latitude: number | null;
            longitude: number | null;
        }>;
        elevationFt: z.ZodNullable<z.ZodNumber>;
        createdAt: z.ZodOptional<z.ZodString>;
        updatedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        layerId: string;
        name: string;
        sourceId: string;
        id: string;
        objectType: "airport";
        sourceObjectId: string;
        ident: string;
        iataCode: string | null;
        category: string;
        typeSource: string;
        country: string | null;
        region: string | null;
        municipality: string | null;
        position: {
            latitude: number | null;
            longitude: number | null;
        };
        elevationFt: number | null;
        createdAt?: string | undefined;
        updatedAt?: string | undefined;
    }, {
        layerId: string;
        name: string;
        sourceId: string;
        id: string;
        objectType: "airport";
        sourceObjectId: string;
        ident: string;
        iataCode: string | null;
        category: string;
        typeSource: string;
        country: string | null;
        region: string | null;
        municipality: string | null;
        position: {
            latitude: number | null;
            longitude: number | null;
        };
        elevationFt: number | null;
        createdAt?: string | undefined;
        updatedAt?: string | undefined;
    }>, "many">;
    pagination: z.ZodObject<{
        limit: z.ZodNumber;
        offset: z.ZodNumber;
        returned: z.ZodNumber;
        total: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        offset: number;
        returned: number;
        total?: number | undefined;
    }, {
        limit: number;
        offset: number;
        returned: number;
        total?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        layerId: string;
        name: string;
        sourceId: string;
        id: string;
        objectType: "airport";
        sourceObjectId: string;
        ident: string;
        iataCode: string | null;
        category: string;
        typeSource: string;
        country: string | null;
        region: string | null;
        municipality: string | null;
        position: {
            latitude: number | null;
            longitude: number | null;
        };
        elevationFt: number | null;
        createdAt?: string | undefined;
        updatedAt?: string | undefined;
    }[];
    pagination: {
        limit: number;
        offset: number;
        returned: number;
        total?: number | undefined;
    };
}, {
    items: {
        layerId: string;
        name: string;
        sourceId: string;
        id: string;
        objectType: "airport";
        sourceObjectId: string;
        ident: string;
        iataCode: string | null;
        category: string;
        typeSource: string;
        country: string | null;
        region: string | null;
        municipality: string | null;
        position: {
            latitude: number | null;
            longitude: number | null;
        };
        elevationFt: number | null;
        createdAt?: string | undefined;
        updatedAt?: string | undefined;
    }[];
    pagination: {
        limit: number;
        offset: number;
        returned: number;
        total?: number | undefined;
    };
}>;
export type LayerObjectsListResponse = z.infer<typeof LayerObjectsListResponseSchema>;
export declare const LayerObjectDetailResponseSchema: z.ZodObject<{
    id: z.ZodString;
    layerId: z.ZodString;
    objectType: z.ZodLiteral<"airport">;
    sourceId: z.ZodString;
    sourceObjectId: z.ZodString;
    name: z.ZodString;
    ident: z.ZodString;
    iataCode: z.ZodNullable<z.ZodString>;
    category: z.ZodString;
    typeSource: z.ZodString;
    country: z.ZodNullable<z.ZodString>;
    region: z.ZodNullable<z.ZodString>;
    municipality: z.ZodNullable<z.ZodString>;
    position: z.ZodObject<{
        latitude: z.ZodNullable<z.ZodNumber>;
        longitude: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        latitude: number | null;
        longitude: number | null;
    }, {
        latitude: number | null;
        longitude: number | null;
    }>;
    elevationFt: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    layerId: string;
    name: string;
    sourceId: string;
    id: string;
    objectType: "airport";
    sourceObjectId: string;
    ident: string;
    iataCode: string | null;
    category: string;
    typeSource: string;
    country: string | null;
    region: string | null;
    municipality: string | null;
    position: {
        latitude: number | null;
        longitude: number | null;
    };
    elevationFt: number | null;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
}, {
    layerId: string;
    name: string;
    sourceId: string;
    id: string;
    objectType: "airport";
    sourceObjectId: string;
    ident: string;
    iataCode: string | null;
    category: string;
    typeSource: string;
    country: string | null;
    region: string | null;
    municipality: string | null;
    position: {
        latitude: number | null;
        longitude: number | null;
    };
    elevationFt: number | null;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
}>;
export type LayerObjectDetailResponse = z.infer<typeof LayerObjectDetailResponseSchema>;
export declare const ApiErrorSchema: z.ZodObject<{
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        code: string;
        details?: Record<string, unknown> | undefined;
    }, {
        message: string;
        code: string;
        details?: Record<string, unknown> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    error: {
        message: string;
        code: string;
        details?: Record<string, unknown> | undefined;
    };
}, {
    error: {
        message: string;
        code: string;
        details?: Record<string, unknown> | undefined;
    };
}>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export declare const NotImplementedResponseSchema: z.ZodObject<{
    error: z.ZodObject<{
        code: z.ZodLiteral<"NOT_IMPLEMENTED">;
        message: z.ZodString;
        supportedTypes: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        message: string;
        code: "NOT_IMPLEMENTED";
        supportedTypes: string[];
    }, {
        message: string;
        code: "NOT_IMPLEMENTED";
        supportedTypes: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    error: {
        message: string;
        code: "NOT_IMPLEMENTED";
        supportedTypes: string[];
    };
}, {
    error: {
        message: string;
        code: "NOT_IMPLEMENTED";
        supportedTypes: string[];
    };
}>;
export type NotImplementedResponse = z.infer<typeof NotImplementedResponseSchema>;
export declare const ErrorCodes: {
    readonly DATABASE_OFFLINE: "DATABASE_OFFLINE";
    readonly INVALID_LAYER: "INVALID_LAYER";
    readonly INVALID_OBJECT_TYPE: "INVALID_OBJECT_TYPE";
    readonly OBJECT_NOT_FOUND: "OBJECT_NOT_FOUND";
    readonly INVALID_QUERY: "INVALID_QUERY";
    readonly NOT_IMPLEMENTED: "NOT_IMPLEMENTED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
//# sourceMappingURL=index.d.ts.map