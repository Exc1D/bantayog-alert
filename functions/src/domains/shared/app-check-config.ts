/**
 * Returns whether App Check should be enforced for callable functions.
 *
 * Staging project is exempt by default so that testing works without a
 * reCAPTCHA key. Set `ENFORCE_APP_CHECK=true` in staging to override.
 * Production always enforces App Check.
 */
export function shouldEnforceAppCheck(): boolean {
  const projectId = process.env.GCLOUD_PROJECT ?? ''
  if (projectId === 'bantayog-alert-staging') {
    return process.env.ENFORCE_APP_CHECK === 'true'
  }
  return true
}
