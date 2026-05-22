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
export function getAdminCallableCorsOrigins() {
    const isDev = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development';
    const base = ['https://bantayog-alert-staging.web.app', 'https://bantayog-alert.web.app'];
    if (isDev) {
        return ['http://localhost:5175', ...base];
    }
    return base;
}
/**
 * Returns the CORS origin allowlist for citizen-facing callable functions.
 *
 * Localhost origins are only included when FUNCTIONS_EMULATOR=true or
 * NODE_ENV=development.
 */
export function getCitizenCallableCorsOrigins() {
    const isDev = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development';
    const base = ['https://bantayog-citizen-staging.web.app', 'https://bantayog-citizen-dev.web.app'];
    if (isDev) {
        return ['http://localhost:5173', ...base];
    }
    return base;
}
/**
 * Returns the CORS origin allowlist for responder-facing callable functions.
 *
 * Localhost origins are only included when FUNCTIONS_EMULATOR=true or
 * NODE_ENV=development.
 */
export function getResponderCallableCorsOrigins() {
    const isDev = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development';
    const base = ['https://bantayog-responder-staging.web.app', 'https://bantayog-responder.web.app'];
    if (isDev) {
        return ['http://localhost:5174', ...base];
    }
    return base;
}
//# sourceMappingURL=callable-config.js.map