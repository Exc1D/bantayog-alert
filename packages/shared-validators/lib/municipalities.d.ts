import { z } from 'zod';
export declare const municipalityDocSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    provinceId: z.ZodString;
    centroid: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, z.core.$strict>;
    defaultSmsLocale: z.ZodOptional<z.ZodEnum<{
        tl: "tl";
        en: "en";
    }>>;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export type MunicipalityDoc = z.infer<typeof municipalityDocSchema>;
export declare const CAMARINES_NORTE_MUNICIPALITIES: readonly Omit<MunicipalityDoc, 'schemaVersion'>[];
//# sourceMappingURL=municipalities.d.ts.map