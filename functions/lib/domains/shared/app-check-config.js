/**
 * Returns whether App Check should be enforced for callable functions.
 * Staging project is exempt so that testing works without a reCAPTCHA key.
 */
export function shouldEnforceAppCheck() {
    const projectId = process.env.GCLOUD_PROJECT ?? '';
    return projectId !== 'bantayog-alert-staging';
}
//# sourceMappingURL=app-check-config.js.map