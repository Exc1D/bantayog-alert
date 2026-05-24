/**
 * Returns whether App Check should be enforced for callable functions.
 *
 * Staging project is exempt by default so that testing works without a
 * reCAPTCHA key. Set `ENFORCE_APP_CHECK=true` in staging to override.
 * Production always enforces App Check.
 */
export declare function shouldEnforceAppCheck(): boolean;
//# sourceMappingURL=app-check-config.d.ts.map