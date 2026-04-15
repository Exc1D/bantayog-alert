# Plan 5 — MFA for Provincial Superadmin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Implement mandatory TOTP-based multi-factor authentication for the `provincial_superadmin` role. Replace dead-code stubs in `functions/src/index.ts` with a working enrollment + verification flow using Firebase Auth's multi-factor API. Unblocks CRITICAL-AUTH-1 from the 2026-04-14 QA report.

**Architecture:** Firebase Auth v9 supports TOTP MFA natively via `multiFactor(user).getSession()` and `TotpMultiFactorGenerator`. No custom TOTP implementation needed. Session-level enforcement: custom claim `mfaVerified: true` set by CF on successful second factor; security rules check it for privileged superadmin ops.

**Tech Stack:** `firebase/auth` TOTP MFA, `qrcode` for provisioning URI rendering, Functions v2.

---

## Prerequisites

- Firebase project has "Multi-factor Authentication" enabled in Auth settings (manual console step).
- User must have verified email (Firebase requirement for MFA enrollment).

## File Map

| File | Responsibility |
|---|---|
| `src/features/auth/mfa/TotpEnrollment.tsx` *(new)* | QR code + verify flow UI |
| `src/features/auth/mfa/TotpChallenge.tsx` *(new)* | Sign-in second factor UI |
| `src/features/auth/services/mfa.service.ts` *(new)* | Enroll/verify wrappers |
| `functions/src/mfa.ts` *(new)* | `setMfaVerifiedClaim` callable |
| `functions/src/index.ts` | Remove dead stubs; export new CF |
| `src/domains/provincial-superadmin/auth/ProvincialLogin.tsx` | Wire challenge step |
| `firestore.rules` | Add `token.mfaVerified` check on sensitive writes |

---

## Task 1: Remove dead MFA stubs

**Files:** `functions/src/index.ts` lines 58–146 (per QA report)

- [ ] **Step 1:** Delete `enrollTOTP`, `enrollSMS`, `verifyMFA` stubs (they throw "not implemented").
- [ ] **Step 2:** Update `loginProvincialSuperadmin` to not depend on the removed stubs.
- [ ] **Step 3:** Commit: `chore(functions): remove dead MFA stubs`.

---

## Task 2: Client-side TOTP enrollment service

**Files:** Create `src/features/auth/services/mfa.service.ts`

- [ ] **Step 1: Failing test**

```typescript
describe('startTotpEnrollment', () => {
  it('returns provisioning URI + secret', async () => {
    // mock multiFactor, TotpMultiFactorGenerator
    const result = await startTotpEnrollment(mockUser, 'Bantayog Alert')
    expect(result.totpUri).toMatch(/^otpauth:\/\/totp\//)
    expect(result.secret).toBeTruthy()
  })
})
```

- [ ] **Step 2: Implement**

```typescript
// src/features/auth/services/mfa.service.ts
import {
  multiFactor, TotpMultiFactorGenerator, TotpSecret,
  type User, type MultiFactorSession
} from 'firebase/auth'

export interface TotpEnrollmentHandle {
  session: MultiFactorSession
  secret: TotpSecret
  totpUri: string
  qrCodeUrl: string
}

export async function startTotpEnrollment(user: User, appName: string): Promise<TotpEnrollmentHandle> {
  const session = await multiFactor(user).getSession()
  const secret = await TotpMultiFactorGenerator.generateSecret(session)
  const totpUri = secret.generateQrCodeUrl(user.email ?? 'user', appName)
  return { session, secret, totpUri, qrCodeUrl: totpUri }
}

export async function completeTotpEnrollment(
  user: User, secret: TotpSecret, oneTimeCode: string, displayName = 'Authenticator App'
): Promise<void> {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, oneTimeCode)
  await multiFactor(user).enroll(assertion, displayName)
}
```

- [ ] **Step 3:** Test + commit.

---

## Task 3: Enrollment UI

**Files:** Create `src/features/auth/mfa/TotpEnrollment.tsx`

- [ ] **Step 1: Failing component test** — renders QR, accepts 6-digit code, calls `completeTotpEnrollment`, shows success.

- [ ] **Step 2: Install `qrcode`:** `npm i qrcode && npm i -D @types/qrcode`

- [ ] **Step 3: Implement**

```tsx
import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { startTotpEnrollment, completeTotpEnrollment } from '../services/mfa.service'
import type { User } from 'firebase/auth'
import type { TotpEnrollmentHandle } from '../services/mfa.service'

export function TotpEnrollment({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const [handle, setHandle] = useState<TotpEnrollmentHandle | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    startTotpEnrollment(user, 'Bantayog Alert')
      .then(h => { setHandle(h); if (canvasRef.current) QRCode.toCanvas(canvasRef.current, h.totpUri) })
      .catch(e => setError(e.message))
  }, [user])

  async function submit() {
    if (!handle) return
    try {
      await completeTotpEnrollment(user, handle.secret, code)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    }
  }

  if (error) return <div role="alert">{error}</div>
  if (!handle) return <div>Loading…</div>
  return (
    <div>
      <canvas ref={canvasRef} aria-label="TOTP QR code" />
      <p>Or enter secret manually: <code>{handle.secret.secretKey}</code></p>
      <input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value)} aria-label="Authenticator code" />
      <button onClick={submit}>Verify & enable</button>
    </div>
  )
}
```

- [ ] **Step 4:** Test + commit.

---

## Task 4: Sign-in challenge flow

**Files:** Create `src/features/auth/mfa/TotpChallenge.tsx`; modify `ProvincialLogin.tsx`

- [ ] **Step 1: Failing test** — when `signInWithEmailAndPassword` throws `auth/multi-factor-auth-required`, challenge UI renders and `getMultiFactorResolver` path completes sign-in.

- [ ] **Step 2: Implement challenge**

```tsx
import { useState } from 'react'
import { getMultiFactorResolver, TotpMultiFactorGenerator, type MultiFactorError, type MultiFactorResolver } from 'firebase/auth'
import { auth } from '@/app/firebase/config'

export function TotpChallenge({ error, onSuccess }: { error: MultiFactorError; onSuccess: () => void }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const resolver: MultiFactorResolver = getMultiFactorResolver(auth, error)
  const hint = resolver.hints.find(h => h.factorId === 'totp')

  async function submit() {
    if (!hint) return
    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code)
      await resolver.resolveSignIn(assertion)
      onSuccess()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Invalid code')
    }
  }
  return (
    <div>
      <label>Authenticator code <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" maxLength={6} /></label>
      {msg && <div role="alert">{msg}</div>}
      <button onClick={submit}>Verify</button>
    </div>
  )
}
```

- [ ] **Step 3: Wire into `ProvincialLogin`:**

```tsx
try {
  await signInWithEmailAndPassword(auth, email, password)
} catch (err) {
  if ((err as any).code === 'auth/multi-factor-auth-required') {
    setMfaError(err as MultiFactorError)
    return
  }
  throw err
}
```

- [ ] **Step 4:** Render `<TotpChallenge>` when `mfaError` set. Commit.

---

## Task 5: Enforce MFA enrollment on first superadmin login

- [ ] **Step 1:** After successful superadmin sign-in, check `multiFactor(user).enrolledFactors.length === 0` → redirect to `/admin/mfa-setup` blocking route.
- [ ] **Step 2:** Only release the admin UI after enrollment completes.
- [ ] **Step 3:** E2E test: new superadmin → forced through enrollment → subsequent logins prompt for TOTP.
- [ ] **Step 4:** Commit.

---

## Task 6: Security rule integration

**Files:** `firestore.rules`

- [ ] **Step 1:** For sensitive superadmin-only mutations (emergencies, system_config, deleteUserData), require `request.auth.token.firebase.sign_in_provider != 'anonymous'` AND `request.auth.token.firebase.sign_in_second_factor == 'totp'`.

```
function isSuperadminMfa() {
  return hasRole('provincial_superadmin')
    && request.auth.token.firebase.sign_in_second_factor == 'totp';
}

match /emergencies/{id} { allow write: if isSuperadminMfa(); }
match /system_config/{id} { allow write: if isSuperadminMfa(); }
```

- [ ] **Step 2:** Update rule tests. Commit.

---

## Self-Review

CRITICAL-AUTH-1 addressed. Spec §6.1 MFA mandatory for superadmin. QR-based enrollment, TOTP challenge, rule enforcement all covered. No placeholders.
