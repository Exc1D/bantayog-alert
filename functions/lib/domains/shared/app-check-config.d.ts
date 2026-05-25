/**
 * Returns whether App Check should be enforced for callable functions.
 *
 * Staging and production enforce App Check by default. Local emulator runs can
 * bypass it unless `ENFORCE_APP_CHECK=true` is set for a stricter proof run.
 */
export declare function shouldEnforceAppCheck(): boolean;
//# sourceMappingURL=app-check-config.d.ts.map