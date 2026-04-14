## Low / Polish

- [ ] `src/features/feed/components/ReportDetailScreen.tsx:318` TODO for `beforePhotoUrls` remains; before/after gallery is knowingly incomplete.
- [ ] `src/shared/hooks/usePWAInstall.ts:29` TODO: monitor/handle legitimate localStorage failures (production edge cases).
- [ ] `src/shared/components/AgeGate.tsx:24` TODO: monitor/handle legitimate localStorage failures (production edge cases).
- [ ] `src/shared/components/AgeGate.tsx:94` Links to `/terms` but there is no terms route/page; broken UX/legal surface.
- [ ] `src/shared/hooks/UserContext.tsx:57` Empty `catch {}` hides profile-load failures entirely; makes auth/profile debugging difficult.
- [ ] `src/features/report/components/ReportForm.tsx:236` Swallows errors from the `onSubmit` callback (by design), but this can hide analytics/instrumentation failures.
- [ ] `src/features/auth/components/__tests__/SignUpFlow.test.tsx:440` Test TODO indicates known UX debt (back navigation on step 7).

