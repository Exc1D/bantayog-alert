// CORS origin allowlists for callable functions, one per client app. Each must
// match every environment that app is served from. Localhost is only added
// when FUNCTIONS_EMULATOR=true or NODE_ENV=development; production deploys
// must NOT include it.
function corsOrigins(devOrigin: string, hosted: string[]): string[] {
  const isDev = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development'
  return isDev ? [devOrigin, ...hosted] : hosted
}

export const getAdminCallableCorsOrigins = (): string[] =>
  corsOrigins('http://localhost:5175', [
    'https://bantayog-alert-staging.web.app',
    'https://bantayogalert-staging.web.app',
    'https://bantayog-alert.web.app',
  ])

export const getCitizenCallableCorsOrigins = (): string[] =>
  corsOrigins('http://localhost:5173', [
    'https://bantayog-citizen-staging.web.app',
    'https://bantayogalert-citizen-stg.web.app',
    'https://bantayog-citizen-dev.web.app',
    'https://bantayog-citizen.web.app',
  ])

export const getResponderCallableCorsOrigins = (): string[] =>
  corsOrigins('http://localhost:5174', [
    'https://bantayog-responder-staging.web.app',
    'https://bantayogalert-responder-stg.web.app',
    'https://bantayog-responder.web.app',
  ])
