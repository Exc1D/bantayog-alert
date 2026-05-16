/**
 * Returns the CORS origin allowlist for admin-facing callable functions.
 *
 * These origins must match every environment where the admin-desktop app
 * is served: local Vite dev server, Firebase Hosting staging, and
 * Firebase Hosting production.
 */
export declare function getAdminCallableCorsOrigins(): string[];
//# sourceMappingURL=callable-config.d.ts.map