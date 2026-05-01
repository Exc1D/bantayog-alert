# Bantayog Citizen PWA — Staging QA Report

**Date:** 2026-05-01
**URL:** https://bantayog-citizen-staging.web.app
**Agents:** 5 parallel QA agents (Feed/Alerts, Register/Auth, Profile/RevealSheet, Map/Toggle, Submit Report)

---

## Critical Issues

| Issue                              | Severity | Notes                                                                                                                                                                                    |
| ---------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **400 errors on incident loading** | HIGH     | Firestore queries returning 400. Likely Firebase App Check token validation failure in staging. Feed shows "Could not load incidents" — blocks RevealSheet and all incident interaction. |
| **reCAPTCHA API 400 errors**       | HIGH     | `google.com/recaptcha/api2/clr` failing — blocks RegisterPage OTP flow (RecaptchaVerifier won't load).                                                                                   |
| **Report form blank**              | MEDIUM   | FAB shows nav footer but no form content renders.                                                                                                                                        |

---

## Working Features

| Feature              | Status  | Notes                                                                                    |
| -------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Map Tab              | ✅ PASS | Leaflet loads, OSM tiles render, incident layers implemented (no markers — no test data) |
| Toggle accessibility | ✅ PASS | `role="switch"`, `aria-label`, keyboard (Space), click all work correctly                |
| Profile tab          | ✅ PASS | Pseudonymous banner, "Not yet registered" state, Guardian branding                       |
| Alerts tab           | ✅ PASS | Empty state renders correctly                                                            |
| Feed UI              | ✅ PASS | Filter chips (All/High/Medium/Low), timeframe buttons styled correctly                   |
| Settings toggles     | ✅ PASS | 4 toggles (push, sounds, location, offline) — all accessible                             |
| Navigation           | ✅ PASS | All 5 tabs (Map, Feed, Report, Alerts, Profile) navigate correctly                       |

---

## Issues Needing Investigation

| Issue                                         | Notes                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Settings gear icon missing** on Profile tab | Only shows "Join Guardian Network" button in unregistered state — need to verify if gear only appears for registered users |
| **Toast notifications**                       | Component exists but not triggered during testing — likely needs real user action to fire                                  |
| **Offline banner**                            | Component exists in `CitizenShell.tsx` — cannot test without network disconnect                                            |
| **No test data in staging**                   | Alerts empty, Feed empty, no map markers — cannot fully exercise RevealSheet ceremony                                      |
| **Report form blank**                         | FAB navigates but form content doesn't render — investigate Report page route component                                    |

---

## Console Errors (ERROR level only)

```
Failed to load resource: the server responded with a status of 400 ()
```

- **2–6 occurrences per page load** — non-blocking (app continues to function)
- Appears on: Firestore queries, reCAPTCHA API, possibly analytics/monitoring
- Likely source: Firebase App Check configuration mismatch in staging project
- Does **not** block: app loading, onboarding, map rendering, tab navigation, toggle interactions

---

## Root Cause Hypothesis

The 400 errors point to **Firebase App Check configuration issue** in the staging Firebase project:

1. App Check is enforcing on Firestore and callable functions, but the staging web app's reCAPTCHA v3 key may not be registered in the Firebase console for the staging domain
2. This would cause all authenticated Firestore reads to fail token validation → "Could not load incidents"
3. The same issue affects RecaptchaVerifier → reCAPTCHA API 400 errors → RegisterPage OTP flow broken

**Recommended fix:** Verify App Check enforcement settings in Firebase console for the staging project. Either:

- Enable App Check for Firestore in staging with the correct reCAPTCHA v3 site key, OR
- Temporarily disable App Check enforcement on staging Firestore until the site key is properly registered

---

## Coverage by Tab

| Tab      | UI         | Data Loading           | Notes                                      |
| -------- | ---------- | ---------------------- | ------------------------------------------ |
| Feed     | ✅         | ❌ 400 error           | Filter chips work, no incidents load       |
| Alerts   | ✅         | ✅ empty state correct | Empty state correct — no active alerts     |
| Map      | ✅         | N/A (no data)          | Leaflet + OSM tiles load                   |
| Report   | ⚠️         | N/A                    | Form content doesn't render                |
| Profile  | ✅         | ✅                     | Pseudonymous state shows correctly         |
| Register | ⚠️         | ❌ reCAPTCHA 400       | OTP flow blocked by reCAPTCHA failure      |
| Settings | ✅         | N/A                    | Toggles accessible, storage estimate shows |
| Lookup   | Not tested | —                      | —                                          |
