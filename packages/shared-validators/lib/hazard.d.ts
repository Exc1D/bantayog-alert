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
    source: z.ZodEnum<{
        pagasa_webhook: "pagasa_webhook";
        pagasa_scraper: "pagasa_scraper";
        manual_superadmin: "manual_superadmin";
    }>;
    signalLevel: z.ZodNumber;
    affectedMunicipalityIds: z.ZodArray<z.ZodString>;
    createdAt: z.ZodNumber;
    expiresAt: z.ZodOptional<z.ZodNumber>;
    createdBy: z.ZodOptional<z.ZodString>;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export type HazardZoneDoc = z.infer<typeof hazardZoneDocSchema>;
export type HazardZoneHistoryDoc = z.infer<typeof hazardZoneHistoryDocSchema>;
export type HazardSignalDoc = z.infer<typeof hazardSignalDocSchema>;
//# sourceMappingURL=hazard.d.ts.map