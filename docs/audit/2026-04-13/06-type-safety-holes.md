## Type Safety Holes (selected)

### Non-null assertions (`!`)

- `src/main.tsx:21` `document.getElementById('root')!` assumes DOM node exists; crashes if the mount point changes.
- `functions/src/index.ts:168` `targetProfile!.role` and related `targetProfile!.*` dereferences rely on `targetUserDoc.data()` being non-null; safer to validate once and use a narrowed type.
- `src/features/alerts/components/AlertCard.tsx:133` `affectedAreas.barangays!.join(', ')` can crash when `barangays` is absent.

### `any` / unsafe casts / schema bypass

- `src/features/feed/components/ReportDetailScreen.tsx:293` Reads `(report as any).photoUrls` (schema drift risk).
- `src/features/feed/components/FeedCard.tsx:199` Reads `(report as any).photoUrls` (schema drift risk).
- `src/features/map/hooks/useMapControls.ts:78` Tests pass `mockMap as any` (acceptable in tests, but note the pattern).
- `src/features/profile/services/profile.service.ts:64` `docSnap.data() as ReportPrivate` with no runtime validation.
- `src/shared/services/firestore.service.ts:39` Returns `{ id, ...data } as unknown as T` for any `T`.
- `src/shared/services/firestore.service.ts:128` `updateDoc(docRef as any, data as any)` bypasses structural checks.

### `@ts-expect-error`

- `src/domains/responder/services/auth.service.ts:123` Uses `@ts-expect-error` to call `confirmationResult.confirm(code)` on an `unknown`; better to type the confirmation result explicitly.
- `src/shared/utils/serviceWorkerRegistration.ts:25` Uses `@ts-expect-error` for `window.importScripts` detection; also likely incorrect behavior (see `03-medium.md`).

