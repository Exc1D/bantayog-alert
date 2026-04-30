import { z } from 'zod';
export declare const minAppVersionSchema: z.ZodObject<{
    citizen: z.ZodString;
    admin: z.ZodString;
    responder: z.ZodString;
    updatedAt: z.ZodNumber;
}, z.core.$strip>;
/**
 * Compare two dot-separated version strings (major.minor.patch).
 * Returns true if a < b.
 * Does NOT handle pre-release tags (e.g. 1.0.0-beta).
 * Invalid inputs log a warning and return true (fail-safe: block on bad data).
 */
export declare function semverLt(a: string, b: string): boolean;
//# sourceMappingURL=config.d.ts.map