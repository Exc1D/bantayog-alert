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
export const RETENTION_EXEMPT_COLLECTIONS = ['reports', 'report_private', 'report_ops'] as const
