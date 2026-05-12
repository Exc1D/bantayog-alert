/**
 * Collections whose documents may be marked retention-exempt.
 *
 * This array is the single source of truth for:
 * - the `setRetentionExempt` callable schema
 * - Firestore rules that gate retention-exempt writes
 * - any backend logic that iterates over retention-sensitive collections
 *
 * Changing this array automatically updates all consumers.
 */
export declare const RETENTION_EXEMPT_COLLECTIONS: string[];
//# sourceMappingURL=retention.d.ts.map