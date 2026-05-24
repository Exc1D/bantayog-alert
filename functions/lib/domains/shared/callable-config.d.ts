/**
 * Returns the CORS origin allowlist for admin-facing callable functions.
 *
 * These origins must match every environment where the admin-desktop app
 * is served: local Vite dev server, Firebase Hosting staging, and
 * Firebase Hosting production.
 *
 * Localhost origins are only included when FUNCTIONS_EMULATOR=true or
 * NODE_ENV=development. Production deploys must NOT include localhost.
 */
export declare function getAdminCallableCorsOrigins(): string[];
/**
 * Returns the CORS origin allowlist for citizen-facing callable functions.
 *
 * Localhost origins are only included when FUNCTIONS_EMULATOR=true or
 * NODE_ENV=development.
 */
export declare function getCitizenCallableCorsOrigins(): string[];
/**
 * Returns the CORS origin allowlist for responder-facing callable functions.
 *
 * Localhost origins are only included when FUNCTIONS_EMULATOR=true or
 * NODE_ENV=development.
 */
export declare function getResponderCallableCorsOrigins(): string[];
//# sourceMappingURL=callable-config.d.ts.map