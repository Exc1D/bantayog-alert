import { z } from 'zod';
export const alertSchema = z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
    publishedAt: z.number().int().nonnegative(),
    publishedBy: z.string().min(1),
});
//# sourceMappingURL=alerts.js.map