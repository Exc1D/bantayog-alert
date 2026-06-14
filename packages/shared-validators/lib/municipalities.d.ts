import { z } from 'zod';
export declare const mdrrmoLabelSchema: z.ZodString;
export declare const MDRRMO_HOTLINE_REGEX: RegExp;
export declare const MIN_MDRRMO_HOTLINE_DIGITS = 7;
export declare function countHotlineDigits(value: string): number;
export declare const mdrrmoHotlineSchema: z.ZodString;
export declare const municipalityDocSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    provinceId: z.ZodString;
    centroid: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, z.core.$strict>;
    mdrrmoLabel: z.ZodOptional<z.ZodString>;
    mdrrmoHotline: z.ZodOptional<z.ZodString>;
    contactUpdatedAt: z.ZodOptional<z.ZodNumber>;
    contactUpdatedBy: z.ZodOptional<z.ZodString>;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export type MunicipalityDoc = z.infer<typeof municipalityDocSchema>;
export interface UpdateMunicipalityContactOutput {
    municipalityId: string;
    mdrrmoLabel: string;
    mdrrmoHotline: string;
    updatedAt: number;
}
export declare const CAMARINES_NORTE_MUNICIPALITIES: readonly Omit<MunicipalityDoc, 'schemaVersion'>[];
/**
 * Payload for the updateMunicipalityContact callable. Both fields are required:
 * the edit form prefills both, and a label without a hotline is meaningless to
 * the citizen-facing contact card. municipalityId must be a known jurisdiction.
 */
export declare const updateMunicipalityContactInputSchema: z.ZodObject<{
    municipalityId: z.ZodString;
    mdrrmoLabel: z.ZodString;
    mdrrmoHotline: z.ZodString;
}, z.core.$strict>;
export type UpdateMunicipalityContactInput = z.infer<typeof updateMunicipalityContactInputSchema>;
//# sourceMappingURL=municipalities.d.ts.map