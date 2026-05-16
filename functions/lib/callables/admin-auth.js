/**
 * Checks whether an account is active, supporting both the legacy
 * `active: true` claim and the newer `accountStatus: 'active'` claim.
 *
 * When `accountStatus` is present it takes precedence; otherwise we fall
 * back to the legacy boolean `active` field.
 */
export function isAccountActive(claims) {
    if (typeof claims.accountStatus === 'string') {
        return claims.accountStatus === 'active';
    }
    return claims.active === true;
}
//# sourceMappingURL=admin-auth.js.map