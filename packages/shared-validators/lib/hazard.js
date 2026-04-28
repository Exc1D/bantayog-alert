import { z } from 'zod';
import { CAMARINES_NORTE_MUNICIPALITIES } from './municipalities.js';
const bbox = z
    .object({
    minLat: z.number(),
    minLng: z.number(),
    maxLat: z.number(),
    maxLng: z.number(),
})
    .strict();
const hazardTypeSchema = z.enum(['flood', 'landslide', 'storm_surge']);
const signalSourceSchema = z.enum(['manual', 'scraper']);
const signalStatusSchema = z.enum(['active', 'cleared', 'expired', 'superseded', 'quarantined']);
export const hazardZoneDocSchema = z
    .object({
    zoneType: z.enum(['reference', 'custom']),
    hazardType: hazardTypeSchema,
    hazardSeverity: z.enum(['low', 'medium', 'high']).optional(),
    scope: z.enum(['provincial', 'municipality']),
    municipalityId: z.string().optional(),
    displayName: z.string().max(200),
    polygonRef: z.string().min(1),
    bbox,
    geohashPrefix: z.string().length(6),
    vertexCount: z.number().int().positive(),
    version: z.number().int().positive(),
    supersededBy: z.string().optional(),
    supersededAt: z.number().int().optional(),
    expiresAt: z.number().int().optional(),
    expiredAt: z.number().int().optional(),
    deletedAt: z.number().int().optional(),
    createdBy: z.string().min(1),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
})
    .strict()
    .refine((d) => (d.supersededBy !== undefined && d.supersededAt !== undefined) ||
    (d.supersededBy === undefined && d.supersededAt === undefined), { message: 'supersededBy and supersededAt must both be present or both absent' });
export const hazardZoneHistoryDocSchema = hazardZoneDocSchema.extend({
    historyVersion: z.number().int().positive(),
});
export const hazardSignalDocSchema = z
    .object({
    hazardType: z.literal('tropical_cyclone'),
    signalLevel: z.number().int().min(1).max(5),
    source: signalSourceSchema,
    scopeType: z.enum(['province', 'municipalities']),
    affectedMunicipalityIds: z.array(z.string().min(1)).min(1),
    status: signalStatusSchema,
    validFrom: z.number().int(),
    validUntil: z.number().int(),
    recordedAt: z.number().int(),
    rawSource: z.string().min(1),
    recordedBy: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
    clearedAt: z.number().int().optional(),
    clearedBy: z.string().min(1).optional(),
    supersededBy: z.string().min(1).optional(),
    schemaVersion: z.number().int().positive(),
})
    .strict()
    .refine((doc) => {
    if (doc.scopeType !== 'province')
        return true;
    const expected = new Set(CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id));
    const actual = new Set(doc.affectedMunicipalityIds);
    return actual.size === expected.size && [...expected].every((id) => actual.has(id));
}, { message: 'province scope must normalize to the full municipality set' })
    .superRefine((doc, ctx) => {
    const hasClearedMeta = doc.clearedAt !== undefined || doc.clearedBy !== undefined;
    if (doc.status === 'cleared') {
        if (doc.clearedAt === undefined || doc.clearedBy === undefined) {
            ctx.addIssue({
                code: 'custom',
                message: 'cleared status requires clearedAt and clearedBy',
            });
        }
    }
    else if (hasClearedMeta) {
        ctx.addIssue({
            code: 'custom',
            message: 'clearedAt/clearedBy are only valid for cleared signals',
        });
    }
    if (doc.status === 'superseded') {
        if (doc.supersededBy === undefined) {
            ctx.addIssue({
                code: 'custom',
                message: 'superseded status requires supersededBy',
            });
        }
    }
    else if (doc.supersededBy !== undefined) {
        ctx.addIssue({
            code: 'custom',
            message: 'supersededBy is only valid for superseded signals',
        });
    }
});
export const hazardSignalStatusDocSchema = z
    .object({
    active: z.boolean(),
    effectiveSignalId: z.string().min(1).optional(),
    effectiveLevel: z.number().int().min(1).max(5).optional(),
    effectiveSource: signalSourceSchema.optional(),
    scopeType: z.enum(['province', 'municipalities']).optional(),
    affectedMunicipalityIds: z.array(z.string().min(1)),
    effectiveScopes: z.array(z
        .object({
        municipalityId: z.string().min(1),
        signalLevel: z.number().int().min(1).max(5),
        source: signalSourceSchema,
        signalId: z.string().min(1),
    })
        .strict()),
    validUntil: z.number().int().optional(),
    manualOverrideActive: z.boolean(),
    scraperDegraded: z.boolean(),
    lastProjectedAt: z.number().int(),
    degradedReasons: z.array(z.string().min(1)),
    invalidSignalIds: z.array(z.string().min(1)).optional(),
    schemaVersion: z.number().int().positive(),
})
    .strict();
//# sourceMappingURL=hazard.js.map