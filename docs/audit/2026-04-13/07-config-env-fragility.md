## Config & Environment Fragility

### Missing / inconsistent env vars

- `src/vite-env.d.ts:13` Env type uses `VITE_FIREBASEFirestore_EMULATOR_URL` (typo/casing) while `.env.example` uses `VITE_FIRESTORE_EMULATOR_URL` at `.env.example:14`. `.env.local` also uses `VITE_FIREBASEFirestore_EMULATOR_URL` at `.env.local:13`. This mismatch makes emulator wiring fragile and confusing.
- `src/app/firebase/config.ts:30` Emulator wiring checks only `VITE_USE_FIREBASE_EMULATORS` and then hardcodes emulator hosts/ports; the URL env vars are declared but unused.

### Rules / schema drift

- `firebase.json:7` References `auth.rules` but it does not exist; auth rules cannot be deployed as configured.
- `functions/src/index.ts:386` Archives to `reports_archive` but rules expose `archived_reports` (`firestore.rules:297`) and never mention `reports_archive`.
- `src/features/profile/components/MyReportsList.tsx:8` Requires Firestore indexes for `report_private` queries, but `firestore.indexes.json` is empty (`firestore.indexes.json:2`).

### Defaults that hide failures

- `src/app/components/PrivacyPolicy.tsx:1` Falls back to hard-coded email `privacy@bantayogalert.gov.ph` if `VITE_PRIVACY_EMAIL` is missing; this can silently misroute real inquiries.
- `src/shared/hooks/UserContext.tsx:57` Empty catch treats profile-load failures as “no profile”; that can mask permission/rules issues.

