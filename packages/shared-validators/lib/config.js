import { z } from 'zod';
export const minAppVersionSchema = z.object({
    citizen: z.string().min(1),
    admin: z.string().min(1),
    responder: z.string().min(1),
    updatedAt: z.number().int().nonnegative(),
});
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
/**
 * Compare two dot-separated version strings (major.minor.patch).
 * Returns true if a < b.
 * Does NOT handle pre-release tags (e.g. 1.0.0-beta).
 * Invalid inputs log a warning and return true (fail-safe: block on bad data).
 */
export function semverLt(a, b) {
    if (!SEMVER_RE.test(a) || !SEMVER_RE.test(b)) {
        console.warn(`[semverLt] Invalid semver input: "${a}" vs "${b}"`);
        return true;
    }
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const x = pa[i] ?? 0;
        const y = pb[i] ?? 0;
        if (x < y)
            return true;
        if (x > y)
            return false;
    }
    return false;
}
//# sourceMappingURL=config.js.map