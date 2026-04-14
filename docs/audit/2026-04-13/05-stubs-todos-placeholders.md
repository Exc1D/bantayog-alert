## Stub/TODO/Placeholder Inventory (high-signal)

### TODO / “future work”

- `src/features/feed/components/ReportDetailScreen.tsx:318` TODO: Add `beforePhotoUrls` field to `Report` type for proper before/after comparison.
- `src/shared/hooks/usePWAInstall.ts:29` TODO: monitor for legitimate localStorage failures in production.
- `src/shared/components/AgeGate.tsx:24` TODO: monitor for legitimate localStorage failures in production.
- `src/features/auth/components/__tests__/SignUpFlow.test.tsx:440` TODO: add Back button to step 7 (UX) before expanding test coverage.

### “Not implemented” stubs (will throw at runtime)

- `src/domains/provincial-superadmin/services/auth.service.ts:72` Throws: “TOTP enrollment ... Not yet implemented.”
- `src/domains/provincial-superadmin/services/auth.service.ts:99` Throws: “TOTP enrollment ... Not yet implemented.”
- `src/domains/provincial-superadmin/services/auth.service.ts:122` Throws: “SMS MFA enrollment ... Not yet implemented.”
- `src/domains/provincial-superadmin/services/auth.service.ts:142` Throws: “MFA verification ... Not yet implemented.”
- `src/domains/provincial-superadmin/services/auth.service.ts:212` Throws: “MFA unenrollment ... Not yet implemented.”
- `src/domains/provincial-superadmin/services/firestore.service.ts:282` Throws: “Data retention configuration not yet implemented.”

### Placeholder implementations (misleading “works” signals)

- `src/features/alerts/hooks/usePushNotifications.ts:46` Sets token to `'mock-fcm-token'` (not real FCM).
- `public/firebase-messaging-sw.js:10` Uses placeholder `REPLACE_WITH_FIREBASE_*` config.
- `src/features/feed/components/FeedList.tsx:302` UI has a placeholder “story cards” section (future feature).
- `src/features/map/hooks/useMapControls.ts:57` Satellite layer described as placeholder/demo.
- `storage.rules:4` Explicit placeholder comment; deny-all rules.

