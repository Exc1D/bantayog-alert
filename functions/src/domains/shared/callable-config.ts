/**
 * Returns the CORS origin allowlist for admin-facing callable functions.
 *
 * These origins must match every environment where the admin-desktop app
 * is served: local Vite dev server, Firebase Hosting staging, and
 * Firebase Hosting production.
 */
export function getAdminCallableCorsOrigins(): string[] {
  return [
    'http://localhost:5175',
    'https://bantayog-alert-staging.web.app',
    'https://bantayog-alert.web.app',
  ]
}
