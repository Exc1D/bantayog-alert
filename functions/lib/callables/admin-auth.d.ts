/**
 * Checks whether an account is active, supporting both the legacy
 * `active: true` claim and the newer `accountStatus: 'active'` claim.
 *
 * When `accountStatus` is present it takes precedence; otherwise we fall
 * back to the legacy boolean `active` field.
 */
export declare function isAccountActive(claims: Record<string, unknown>): boolean;
//# sourceMappingURL=admin-auth.d.ts.map