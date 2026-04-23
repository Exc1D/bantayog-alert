import { z } from 'zod';
export declare const alertSchema: z.ZodObject<{
    title: z.ZodString;
    body: z.ZodString;
    severity: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        info: "info";
        critical: "critical";
    }>;
    publishedAt: z.ZodNumber;
    publishedBy: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=alerts.d.ts.map