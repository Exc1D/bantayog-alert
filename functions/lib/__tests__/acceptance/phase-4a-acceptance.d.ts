/**
 * Phase 4a Acceptance Gate
 *
 * Runs 13 test cases against the Firebase emulators using the Functions Test SDK.
 * No wall-clock waits — uses the fake SMS provider throughout.
 *
 * Usage:
 *   firebase emulators:exec --only firestore,functions,auth "pnpm exec tsx scripts/phase-4a/acceptance.ts"
 *   # or against staging:
 *   GCLOUD_PROJECT=bantayog-alert-staging SMS_PROVIDER_MODE=fake \
 *     pnpm exec tsx scripts/phase-4a/acceptance.ts
 */
export {};
//# sourceMappingURL=phase-4a-acceptance.d.ts.map