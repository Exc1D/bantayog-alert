import { z } from 'zod';
export declare const hazardZoneDocSchema: z.ZodObject<{
    zoneType: z.ZodEnum<{
        custom: "custom";
        reference: "reference";
    }>;
    hazardType: z.ZodEnum<{
        flood: "flood";
        landslide: "landslide";
        storm_surge: "storm_surge";
    }>;
    hazardSeverity: z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>>;
    scope: z.ZodEnum<{
        provincial: "provincial";
        municipality: "municipality";
    }>;
    municipalityId: z.ZodOptional<z.ZodString>;
    displayName: z.ZodString;
    polygonRef: z.ZodString;
    bbox: z.ZodObject<{
        minLat: z.ZodNumber;
        minLng: z.ZodNumber;
        maxLat: z.ZodNumber;
        maxLng: z.ZodNumber;
    }, z.core.$strict>;
    geohashPrefix: z.ZodString;
    vertexCount: z.ZodNumber;
    version: z.ZodNumber;
    supersededBy: z.ZodOptional<z.ZodString>;
    supersededAt: z.ZodOptional<z.ZodNumber>;
    expiresAt: z.ZodOptional<z.ZodNumber>;
    expiredAt: z.ZodOptional<z.ZodNumber>;
    deletedAt: z.ZodOptional<z.ZodNumber>;
    createdBy: z.ZodString;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const hazardZoneHistoryDocSchema: z.ZodObject<{
    zoneType: z.ZodEnum<{
        custom: "custom";
        reference: "reference";
    }>;
    hazardType: z.ZodEnum<{
        flood: "flood";
        landslide: "landslide";
        storm_surge: "storm_surge";
    }>;
    hazardSeverity: z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>>;
    scope: z.ZodEnum<{
        provincial: "provincial";
        municipality: "municipality";
    }>;
    municipalityId: z.ZodOptional<z.ZodString>;
    displayName: z.ZodString;
    polygonRef: z.ZodString;
    bbox: z.ZodObject<{
        minLat: z.ZodNumber;
        minLng: z.ZodNumber;
        maxLat: z.ZodNumber;
        maxLng: z.ZodNumber;
    }, z.core.$strict>;
    geohashPrefix: z.ZodString;
    vertexCount: z.ZodNumber;
    version: z.ZodNumber;
    supersededBy: z.ZodOptional<z.ZodString>;
    supersededAt: z.ZodOptional<z.ZodNumber>;
    expiresAt: z.ZodOptional<z.ZodNumber>;
    expiredAt: z.ZodOptional<z.ZodNumber>;
    deletedAt: z.ZodOptional<z.ZodNumber>;
    createdBy: z.ZodString;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
    historyVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const hazardSignalDocSchema: z.ZodObject<{
    hazardType: z.ZodLiteral<"tropical_cyclone">;
    signalLevel: z.ZodNumber;
    source: z.ZodEnum<{
        manual: "manual";
        scraper: "scraper";
    }>;
    scopeType: z.ZodEnum<{
        province: "province";
        municipalities: "municipalities";
    }>;
    affectedMunicipalityIds: z.ZodArray<z.ZodString>;
    status: z.ZodEnum<{
        active: "active";
        expired: "expired";
        superseded: "superseded";
        cleared: "cleared";
        quarantined: "quarantined";
    }>;
    validFrom: z.ZodNumber;
    validUntil: z.ZodNumber;
    recordedAt: z.ZodNumber;
    rawSource: z.ZodString;
    recordedBy: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    clearedAt: z.ZodOptional<z.ZodNumber>;
    clearedBy: z.ZodOptional<z.ZodString>;
    supersededBy: z.ZodOptional<z.ZodString>;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const hazardSignalStatusDocSchema: z.ZodObject<{
    active: z.ZodBoolean;
    effectiveSignalId: z.ZodOptional<z.ZodString>;
    effectiveLevel: z.ZodOptional<z.ZodNumber>;
    effectiveSource: z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        scraper: "scraper";
    }>>;
    scopeType: z.ZodOptional<z.ZodEnum<{
        province: "province";
        municipalities: "municipalities";
    }>>;
    affectedMunicipalityIds: z.ZodArray<z.ZodString>;
    effectiveScopes: z.ZodArray<z.ZodObject<{
        municipalityId: z.ZodString;
        signalLevel: z.ZodNumber;
        source: z.ZodEnum<{
            manual: "manual";
            scraper: "scraper";
        }>;
        signalId: z.ZodString;
    }, z.core.$strict>>;
    validUntil: z.ZodOptional<z.ZodNumber>;
    manualOverrideActive: z.ZodBoolean;
    scraperDegraded: z.ZodBoolean;
    lastProjectedAt: z.ZodNumber;
    degradedReasons: z.ZodArray<z.ZodString>;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export type HazardZoneDoc = z.infer<typeof hazardZoneDocSchema>;
export type HazardZoneHistoryDoc = z.infer<typeof hazardZoneHistoryDocSchema>;
export type HazardSignalDoc = z.infer<typeof hazardSignalDocSchema>;
export type HazardSignalStatusDoc = z.infer<typeof hazardSignalStatusDocSchema>;
//# sourceMappingURL=hazard.d.ts.map