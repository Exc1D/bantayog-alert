# Citizen PWA Redesign — Spec Gap Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all gaps between PR 85 implementation and the approved spec at `docs/superpowers/specs/2026-04-30-citizen-pwa-redesign-design.md`.

**Architecture:** Targeted surgical edits to existing files. No new files except the missing `request-data-export.ts` callable. Each task is self-contained and independently testable.

**Tech Stack:** React 18, TypeScript, Vitest, Firebase, Lucide React

---

## Task 1: Fix incident-meta icon mapping to match spec §3.2

**Files:**

- Modify: `apps/citizen-pwa/src/utils/incident-meta.tsx`
- Modify: `apps/citizen-pwa/src/utils/incident-meta.test.tsx`

The spec §3.2 defines specific Lucide icons per incident type. The current implementation uses different icons for 5 types. Fix the mapping and add the spec-required exports (`INCIDENT_META`, `IncidentIcon` component).

- [ ] **Step 1: Update icon imports and mapping in incident-meta.tsx**

Replace imports:

```tsx
import {
  Waves,
  MountainSnow,
  Flame,
  Wind,
  Building2,
  Car,
  HeartPulse,
  ShieldAlert,
  AlertTriangle,
  MapPin,
  HelpCircle,
  Zap,
} from 'lucide-react'
```

Replace the `ICON_MAP` with:

```tsx
const ICON_MAP: Record<IncidentType, (size: number) => ReactNode> = {
  flood: (s) => <Waves size={s} />,
  landslide: (s) => <MountainSnow size={s} />,
  fire: (s) => <Flame size={s} />,
  typhoon: (s) => <Wind size={s} />,
  storm_surge: (s) => <Waves size={s} />,
  structural: (s) => <Building2 size={s} />,
  accident: (s) => <Car size={s} />,
  medical: (s) => <HeartPulse size={s} />,
  security: (s) => <ShieldAlert size={s} />,
  earthquake: (s) => <AlertTriangle size={s} />,
  power_outage: (s) => <Zap size={s} />,
  other: (s) => <HelpCircle size={s} />,
}
```

- [ ] **Step 2: Run tests to verify nothing broke**

Run: `cd apps/citizen-pwa && npx vitest run src/utils/incident-meta.test.tsx`
Expected: All pass

- [ ] **Step 3: Commit**

```
fix(citizen-pwa): align incident-meta icon mapping with spec §3.2
```

---

## Task 2: Fix RevealSheet haptic pattern and timing (§4.1)

**Files:**

- Modify: `apps/citizen-pwa/src/components/RevealSheet.tsx`
- Modify: `apps/citizen-pwa/src/components/RevealSheet.test.tsx`

The spec requires `navigator.vibrate([15, 80, 25])` fired once when success state first renders (not on typewriter complete), guarded by `'vibrate' in navigator`. Currently fires `navigator.vibrate(200)` on typewriter complete.

- [ ] **Step 1: Add a useEffect for haptic on success mount in RevealSheet.tsx**

After the typewriter useEffect (line 92), add:

```tsx
useEffect(() => {
  if (state === 'success' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([15, 80, 25])
    } catch {
      // vibrate not available
    }
  }
}, [state])
```

- [ ] **Step 2: Remove the old vibrate call from inside the typewriter interval**

In the typewriter useEffect (lines 69-92), remove lines 80-84:

```tsx
try {
  navigator.vibrate(200)
} catch {
  // vibrate not available
}
```

Replace with just:

```tsx

```

(Leave the closing of the if-block as `}` after `setTypewriterComplete(true)`)

- [ ] **Step 3: Update the test for the new vibrate pattern**

In `RevealSheet.test.tsx`, change the test "calls navigator.vibrate on typewriter complete" to:

```tsx
it('calls navigator.vibrate with correct pattern on success mount', () => {
  render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
  expect(navigator.vibrate).toHaveBeenCalledWith([15, 80, 25])
})
```

- [ ] **Step 4: Run tests**

Run: `cd apps/citizen-pwa && npx vitest run src/components/RevealSheet.test.tsx`
Expected: All pass

- [ ] **Step 5: Commit**

```
fix(citizen-pwa): correct RevealSheet haptic pattern to spec [15,80,25]
```

---

## Task 3: Add secret code ceremony to RevealSheet (§4.1)

**Files:**

- Modify: `apps/citizen-pwa/src/components/RevealSheet.tsx`
- Modify: `apps/citizen-pwa/src/components/RevealSheet.test.tsx`

The spec requires: "SECRET CODE" label, "SHOWN ONCE" badge, `rgba(167,52,0,0.15)` divider, JetBrains Mono font, fade-in animation (opacity 0→1, 300ms), sub-copy with Tagalog hint.

- [ ] **Step 1: Add fade-in state for secret code**

After `const [copied, setCopied] = useState(false)` (line 23), add:

```tsx
const [secretVisible, setSecretVisible] = useState(false)
```

- [ ] **Step 2: Add useEffect to trigger secret fade-in after typewriter completes**

```tsx
useEffect(() => {
  if (typewriterComplete && secretCode) {
    const t = setTimeout(() => setSecretVisible(true), reducedMotion ? 0 : 300)
    return () => clearTimeout(t)
  }
}, [typewriterComplete, secretCode, reducedMotion])
```

- [ ] **Step 3: Replace the secret code block (lines 235-292) with spec-compliant version**

Replace the entire `{secretCode && state === 'success' && typewriterComplete && (` block with:

```tsx
{
  secretCode && state === 'success' && typewriterComplete && (
    <div
      style={{
        margin: '12px 0',
        borderTop: '1px solid rgba(167,52,0,0.15)',
        paddingTop: 12,
        opacity: secretVisible ? 1 : 0,
        transition: reducedMotion ? 'none' : 'opacity 300ms ease-in',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#a73400',
          }}
        >
          Secret Code
        </span>
        <span
          style={{
            fontSize: '0.625rem',
            fontWeight: 700,
            background: '#001e40',
            color: '#fff',
            padding: '1px 6px',
            borderRadius: 4,
            letterSpacing: '0.04em',
          }}
        >
          SHOWN ONCE
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code
          style={{
            flex: 1,
            padding: '8px 12px',
            background: '#fff',
            borderRadius: 6,
            fontSize: '0.875rem',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.05em',
          }}
        >
          {secretCode}
        </code>
        <button
          type="button"
          onClick={() => {
            void handleCopySecret()
          }}
          style={{
            padding: '8px',
            border: 'none',
            background: '#001e40',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Copy secret code"
        >
          <Copy size={16} color="#fff" />
        </button>
      </div>
      {copied && (
        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#16a34a' }}>Copied!</p>
      )}
      <p style={{ margin: '8px 0 0', fontSize: '0.6875rem', color: '#7b8794' }}>
        Save this to check your report without an account.
        <span style={{ display: 'block', fontStyle: 'italic' }}>
          I-save ito para macheck ang ulat nang walang account.
        </span>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Update the test to match new text**

In `RevealSheet.test.tsx`, change "Save your secret code to track this report" references to "Secret Code":

```tsx
it('renders secret code section after typewriter', async () => {
  render(<RevealSheet state="success" referenceCode="BA-2026-001" secretCode="SECRET123" />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1200)
  })
  expect(screen.getByText('Secret Code')).toBeInTheDocument()
  expect(screen.getByText('SHOWN ONCE')).toBeInTheDocument()
  expect(screen.getByText('SECRET123')).toBeInTheDocument()
})

it('does not show secret code section without secretCode', async () => {
  render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1200)
  })
  expect(screen.queryByText('Secret Code')).not.toBeInTheDocument()
})
```

- [ ] **Step 5: Run tests**

Run: `cd apps/citizen-pwa && npx vitest run src/components/RevealSheet.test.tsx`
Expected: All pass

- [ ] **Step 6: Commit**

```
feat(citizen-pwa): add secret code ceremony to RevealSheet per spec §4.1
```

---

## Task 4: Add session upgrade prompt to RevealSheet (§4.1)

**Files:**

- Modify: `apps/citizen-pwa/src/components/RevealSheet.tsx`

The spec requires a session upgrade prompt for pseudonymous users, rendered below buttons, hidden after one dismissal via localStorage.

- [ ] **Step 1: Add state and dismiss handler for upgrade prompt**

After `const [copied, setCopied] = useState(false)` and the new `secretVisible` state, add:

```tsx
const [upgradeDismissed, setUpgradeDismissed] = useState(() => {
  try {
    return localStorage.getItem('bantayog_upgrade_prompted') === '1'
  } catch {
    return false
  }
})
const showUpgradePrompt = reportCount != null && reportCount > 0 && !upgradeDismissed
```

- [ ] **Step 2: Add dismiss handler**

```tsx
const handleDismissUpgrade = () => {
  try {
    localStorage.setItem('bantayog_upgrade_prompted', '1')
  } catch {
    /* */
  }
  setUpgradeDismissed(true)
}
```

- [ ] **Step 3: Destructure `reportCount` from props**

Change line 19 from:

```tsx
export function RevealSheet({ state, referenceCode, secretCode, onClose }: RevealSheetProps) {
```

to:

```tsx
export function RevealSheet({ state, referenceCode, secretCode, reportCount, onClose }: RevealSheetProps) {
```

- [ ] **Step 4: Render upgrade prompt before the footer**

Before `<p className="reveal-footer">`, add:

```tsx
{
  showUpgradePrompt && state === 'success' && (
    <div
      style={{
        margin: '12px 0',
        padding: '12px',
        borderRadius: 8,
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', fontWeight: 600, color: '#001e40' }}>
        {reportCount === 1
          ? 'Save your report history — create an account.'
          : `You have ${reportCount} reports. Create an account to keep them all.`}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <a
          href="/register"
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#f26522',
            textDecoration: 'none',
          }}
        >
          Create account
        </a>
        <button
          type="button"
          onClick={handleDismissUpgrade}
          style={{
            border: 'none',
            background: 'none',
            fontSize: '0.75rem',
            color: '#7b8794',
            cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

Run: `cd apps/citizen-pwa && npx vitest run src/components/RevealSheet.test.tsx`
Expected: All pass

- [ ] **Step 6: Commit**

```
feat(citizen-pwa): add session upgrade prompt to RevealSheet per spec §4.1
```

---

## Task 5: Fix LookupScreen design per spec §4.2

**Files:**

- Modify: `apps/citizen-pwa/src/components/LookupScreen.tsx`

Missing: "Track your report" heading + bilingual sub-copy, Stone Alt bg `#f2f4f6` on inputs, JetBrains Mono font, "Checking…" button text with animated dots, "Verified by" attribution row in result card.

- [ ] **Step 1: Add heading and bilingual sub-copy after the header div (after line 62)**

After the `</div>` closing the header, before the `<form>`, add:

```tsx
<div style={{ padding: '24px 16px 0' }}>
  <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800, color: '#001e40' }}>
    Track your report
  </h2>
  <p style={{ margin: '0 0 4px', fontSize: '0.8125rem', color: '#52606d' }}>
    Enter your reference code and secret code to check your report status.
  </p>
  <p style={{ margin: 0, fontSize: '0.6875rem', color: '#7b8794', fontStyle: 'italic' }}>
    Ilagay ang reference at secret code para macheck ang ulat.
  </p>
</div>
```

- [ ] **Step 2: Fix input backgrounds and fonts**

On both input styles (lines 88-97 and 125-134), change:

- `background: 'transparent'` → `background: '#f2f4f6'`
- Add `fontFamily: "'JetBrains Mono', monospace"`
- Add `borderRadius: '8px 8px 0 0'` (top corners only, Material-underline style)

- [ ] **Step 3: Fix submit button text**

Change line 155 from:

```tsx
{
  loading ? 'Looking up…' : 'Look Up'
}
```

to:

```tsx
{
  loading ? 'Checking…' : 'Check Status'
}
```

- [ ] **Step 4: Add "Verified by" row to result card**

After the "Last update" row (line 180), add a new row:

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between' }}>
  <span style={{ fontSize: '0.8125rem', color: '#52606d' }}>Verified by</span>
  <span style={{ fontWeight: 600, color: '#001e40' }}>
    {(result as LookupResult & { verifiedBy?: string }).verifiedBy ?? 'Daet MDRRMO'}
  </span>
</div>
```

- [ ] **Step 5: Add `verifiedBy` to LookupResult interface**

Update the interface:

```tsx
interface LookupResult {
  status: string
  lastStatusAt: number
  municipalityLabel: string
  verifiedBy?: string
}
```

- [ ] **Step 6: Run tests**

Run: `cd apps/citizen-pwa && npx vitest run src/components/LookupScreen.test.tsx`
Expected: All pass

- [ ] **Step 7: Commit**

```
fix(citizen-pwa): LookupScreen design compliance per spec §4.2
```

---

## Task 6: Add Step 4 (Consent) to RegisterPage (§4.4)

**Files:**

- Modify: `apps/citizen-pwa/src/pages/RegisterPage.tsx`

The spec requires a 4-step flow. Step 3 (name) already exists. Need to add Step 4: Consent with privacy checkbox and `privacyNoticeVersion` write.

- [ ] **Step 1: Update Step type and add consent state**

Change `type Step = 'phone' | 'otp' | 'name'` to:

```tsx
type Step = 'phone' | 'otp' | 'name' | 'consent'
```

Add state after `displayName`:

```tsx
const [consentGiven, setConsentGiven] = useState(false)
```

- [ ] **Step 2: Change handleSaveName to navigate to consent instead of home**

In `handleSaveName`, change:

```tsx
void navigate('/', { replace: true })
```

to:

```tsx
setStep('consent')
```

- [ ] **Step 3: Add handleConsent handler**

```tsx
const handleConsent = useCallback(async () => {
  if (!consentGiven) return
  toast('Welcome to Bantayog Alert', 'success')
  void navigate('/', { replace: true })
}, [consentGiven, navigate, toast])
```

- [ ] **Step 4: Add consent step UI after the name step div**

After the closing `</div>` of step === 'name', add:

```tsx
{
  step === 'consent' && (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#001e40' }}>
        Your previous reports are already linked to this account.
      </p>
      <p
        style={{ margin: '0 0 4px', fontSize: '0.6875rem', color: '#7b8794', fontStyle: 'italic' }}
      >
        Nakakonekta na ang iyong mga naunang ulat sa account na ito.
      </p>
      <div
        style={{
          margin: '16px 0',
          padding: '12px',
          borderRadius: 8,
          background: '#f2f4f6',
        }}
      >
        <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', fontWeight: 600, color: '#001e40' }}>
          Privacy Notice
        </p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#52606d', lineHeight: 1.5 }}>
          Your data is processed under RA 10173 (Data Privacy Act of 2012). We collect only what is
          necessary to process your reports and keep you informed. You may request data deletion at
          any time.
        </p>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: '0.6875rem',
            color: '#7b8794',
            fontStyle: 'italic',
          }}
        >
          Ang iyong datos ay pinoproseso ayon sa RA 10173. Kinokolekta lamang ang kailangan para sa
          iyong mga ulat.
        </p>
      </div>
      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
          marginBottom: 16,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={consentGiven}
          onChange={(e) => {
            setConsentGiven(e.target.checked)
          }}
          style={{ marginTop: 2 }}
        />
        <span style={{ fontSize: '0.8125rem', color: '#001e40' }}>
          I have read and agree to the Terms of Use and Privacy Notice
        </span>
      </label>
      <button
        type="button"
        onClick={() => {
          void handleConsent()
        }}
        disabled={loading || !consentGiven}
        style={{
          width: '100%',
          padding: '14px',
          border: 'none',
          borderRadius: 999,
          background: '#f26522',
          color: '#fff',
          fontSize: '1rem',
          fontWeight: 700,
          cursor: loading || !consentGiven ? 'not-allowed' : 'pointer',
          opacity: loading || !consentGiven ? 0.7 : 1,
        }}
      >
        Create Account
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Add progress bar at top of content area**

Before the step conditionals, add a 4-segment progress bar:

```tsx
<div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
  {(['phone', 'otp', 'name', 'consent'] as const).map((s) => (
    <div
      key={s}
      style={{
        flex: 1,
        height: 4,
        borderRadius: 2,
        background: step === s ? '#f26522' : '#e0e3e5',
      }}
    />
  ))}
</div>
```

- [ ] **Step 6: Run tests**

Run: `cd apps/citizen-pwa && npx vitest run src/pages/RegisterPage.test.tsx`
Expected: All pass

- [ ] **Step 7: Commit**

```
feat(citizen-pwa): add Step 4 consent to RegisterPage per spec §4.4
```

---

## Task 7: Fix SettingsPage missing sections (§4.5)

**Files:**

- Modify: `apps/citizen-pwa/src/pages/SettingsPage.tsx`

Missing: Alert sounds toggle, Location section (auto-detect), Privacy Policy link, functional data export button.

- [ ] **Step 1: Add alert sounds and auto-detect location state**

After the `offlineMode` state, add:

```tsx
const [alertSounds, setAlertSounds] = useState(() => {
  try {
    return localStorage.getItem('bantayog_alert_sounds') === 'true'
  } catch {
    return true
  }
})
const [autoLocation, setAutoLocation] = useState(() => {
  try {
    return localStorage.getItem('bantayog_location_auto') !== 'false'
  } catch {
    return true
  }
})
const [exportDisabled, setExportDisabled] = useState(() => {
  try {
    return sessionStorage.getItem('bantayog_export_requested') === '1'
  } catch {
    return false
  }
})
```

- [ ] **Step 2: Add toggle handlers**

```tsx
const handleAlertSoundsToggle = (v: boolean) => {
  setAlertSounds(v)
  try {
    localStorage.setItem('bantayog_alert_sounds', String(v))
  } catch {
    /* */
  }
}

const handleAutoLocationToggle = (v: boolean) => {
  setAutoLocation(v)
  try {
    localStorage.setItem('bantayog_location_auto', String(v))
  } catch {
    /* */
  }
}

const handleDataExport = async () => {
  try {
    sessionStorage.setItem('bantayog_export_requested', '1')
    setExportDisabled(true)
    const { requestDataExport } = await import('../services/callables.js')
    await requestDataExport()
    toast("We'll email your data within 24 hours.", 'success')
  } catch {
    toast('Data export failed. Please try again.', 'error')
  }
  setTimeout(() => {
    try {
      sessionStorage.removeItem('bantayog_export_requested')
    } catch {
      /* */
    }
    setExportDisabled(false)
  }, 60000)
}
```

- [ ] **Step 3: Add Alert sounds toggle to Notifications section**

After the Push notifications toggle in the Notifications section, add:

```tsx
<div style={{ marginTop: 12 }}>
  <Toggle checked={alertSounds} onChange={handleAlertSoundsToggle} label="Alert sounds" />
</div>
```

- [ ] **Step 4: Add Location section after Notifications**

After the Notifications `</div>`, add:

```tsx
<div style={sectionStyle}>
  <div style={labelStyle}>Location</div>
  <Toggle checked={autoLocation} onChange={handleAutoLocationToggle} label="Auto-detect location" />
</div>
```

- [ ] **Step 5: Replace the Account section's "Request Data Export" button**

Replace the existing button (lines 122-138) with:

```tsx
        <button
          type="button"
          onClick={() => { void handleDataExport() }}
          disabled={exportDisabled}
          style={{
            border: 'none',
            background: 'none',
            color: exportDisabled ? '#7b8794' : '#001e40',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: exportDisabled ? 'not-allowed' : 'pointer',
            padding: '8px 0',
          }}
        >
          {exportDisabled ? 'Coming soon' : 'Download my data'}
        </button>
        <a
          href="https://bantayog.alert/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block', marginTop: 8, fontSize: '0.875rem', fontWeight: 600, color: '#001e40', textDecoration: 'none' }}
        >
          Privacy Policy
        </a>
```

- [ ] **Step 6: Run tests**

Run: `cd apps/citizen-pwa && npx vitest run src/pages/SettingsPage.test.tsx`
Expected: All pass

- [ ] **Step 7: Commit**

```
feat(citizen-pwa): add missing SettingsPage sections per spec §4.5
```

---

## Task 8: Fix useOfflineQueueCount per spec §4.6

**Files:**

- Modify: `apps/citizen-pwa/src/hooks/useOfflineQueueCount.ts`

Spec requires: 2000ms poll interval, sync states `'queued' | 'syncing' | 'failed_retryable'`, returns `{ isOnline: boolean; queueCount: number }`.

- [ ] **Step 1: Update hook to return object, fix interval and filter**

Replace the entire file content with:

```tsx
import { useState, useEffect } from 'react'
import { useOnlineStatus } from './useOnlineStatus.js'
import { draftStore } from '../services/draft-store'

const POLL_INTERVAL_MS = 2000

interface OfflineQueueStatus {
  isOnline: boolean
  queueCount: number
}

export function useOfflineQueueCount(): OfflineQueueStatus {
  const { navigatorOnline } = useOnlineStatus()
  const [count, setCount] = useState(0)

  useEffect(() => {
    let isMounted = true
    const update = async () => {
      try {
        const drafts = await draftStore.list()
        const pending = drafts.filter(
          (d) =>
            d.syncState === 'queued' ||
            d.syncState === 'syncing' ||
            d.syncState === 'failed_retryable',
        )
        if (isMounted) setCount(pending.length)
      } catch (e) {
        console.error('Offline queue count failed:', e)
      }
    }

    void update()
    const interval = setInterval(() => {
      void update()
    }, POLL_INTERVAL_MS)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  return { isOnline: navigatorOnline, queueCount: count }
}
```

- [ ] **Step 2: Update CitizenShell to use new return type**

In `CitizenShell.tsx`, change:

```tsx
const queueCount = useOfflineQueueCount()
```

to:

```tsx
const { isOnline: queueIsOnline, queueCount } = useOfflineQueueCount()
```

And change:

```tsx
const showBanner = !navigatorOnline
```

to:

```tsx
const showBanner = !queueIsOnline && queueCount > 0
```

Remove the old `useOnlineStatus` import and usage if no longer needed (but keep it if other things use `navigatorOnline` in the shell). Actually, `CitizenShell` uses `useOnlineStatus` directly for the banner. Since `useOfflineQueueCount` now returns `isOnline`, we can remove the separate `useOnlineStatus` import. Change imports to remove `useOnlineStatus` and update usage.

Actually, let me be more careful. The current `CitizenShell` imports both hooks. After the change, we only need `useOfflineQueueCount`. Remove `useOnlineStatus` import and the line `const { navigatorOnline } = useOnlineStatus()`.

- [ ] **Step 3: Update useOfflineQueueCount test**

In `useOfflineQueueCount.test.tsx`, update assertions to check for `{ isOnline, queueCount }` object instead of just a number.

- [ ] **Step 4: Run tests**

Run: `cd apps/citizen-pwa && npx vitest run src/hooks/useOfflineQueueCount.test.tsx src/components/CitizenShell.test.tsx`
Expected: All pass

- [ ] **Step 5: Commit**

```
fix(citizen-pwa): useOfflineQueueCount returns object with isOnline, 2s interval
```

---

## Task 9: Replace empty-state emojis with Lucide icons (§3.1 item 2)

**Files:**

- Modify: `apps/citizen-pwa/src/components/FeedTab.tsx`
- Modify: `apps/citizen-pwa/src/components/AlertsTab.tsx`
- Modify: `apps/citizen-pwa/src/components/ProfileTab.tsx`

The spec §3.2 defines empty state icons: `CheckCircle` (all clear / no incidents), `ClipboardList` (no reports yet), `BellOff` (no alerts). Also `MapPin` for location pins instead of `📍`.

- [ ] **Step 1: FeedTab — replace 🌿 with CheckCircle and 📍 with MapPin**

Add to imports:

```tsx
import { CheckCircle, MapPin } from 'lucide-react'
```

Replace `🌿` empty state (line 270) with:

```tsx
<p style={{ margin: '0 0 8px', color: '#16a34a' }}>
  <CheckCircle size={40} />
</p>
```

Replace `📍` in FeedCard (line 65) with:

```tsx
<MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
```

- [ ] **Step 2: AlertsTab — replace ⚠️ and ✅ with Lucide**

Add to imports:

```tsx
import { AlertTriangle, BellOff } from 'lucide-react'
```

Replace `⚠️` error state (line 223) with:

```tsx
<p style={{ margin: '0 0 8px', color: '#b71c1c' }}>
  <AlertTriangle size={40} />
</p>
```

Replace `✅` empty state (line 240) with:

```tsx
<p style={{ margin: '0 0 8px', color: '#16a34a' }}>
  <BellOff size={40} />
</p>
```

- [ ] **Step 3: ProfileTab — replace 📋 with ClipboardList and 📍 with MapPin**

Add to imports:

```tsx
import { ClipboardList, MapPin, Settings } from 'lucide-react'
```

Replace `📋` empty state (line 305) with:

```tsx
<p style={{ margin: '0 0 8px', color: '#52606d' }}>
  <ClipboardList size={40} />
</p>
```

Replace `📍` in ReportCard (line 113) with `<MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />`

Replace `⚙` emoji settings icon (line 254) with `<Settings size={20} color="#52606d" />`

- [ ] **Step 4: Run all tests**

Run: `cd apps/citizen-pwa && npx vitest run`
Expected: All pass

- [ ] **Step 5: Commit**

```
fix(citizen-pwa): replace all remaining emojis with Lucide icons per spec §3.2
```

---

## Task 10: Add requestDataExport callable (§4.5 dependency)

**Files:**

- Create: `functions/src/callables/request-data-export.ts`

The spec mentions this callable as a dependency for the SettingsPage "Download my data" button.

- [ ] **Step 1: Create the callable stub**

Check existing callables in `functions/src/callables/` for the pattern, then create a minimal stub that queues the export:

```ts
import { onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'

export const requestDataExport = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('Unauthenticated')
  }
  logger.info(`Data export requested by ${request.auth.uid}`)
  // TODO: Implement actual export queueing (Phase 10)
  return { status: 'queued' }
})
```

Check if there's an index file that registers callables and add it there.

- [ ] **Step 2: Run typecheck**

Run: `cd functions && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Commit**

```
feat(functions): add requestDataExport callable stub
```

---

## Task 11: Final lint + typecheck + full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd apps/citizen-pwa && npx vitest run`
Expected: All pass

- [ ] **Step 2: Run typecheck**

Run: `cd apps/citizen-pwa && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Run lint**

Run: `cd apps/citizen-pwa && npx eslint src`
Expected: Clean (no errors)

- [ ] **Step 4: Update docs/progress.md and docs/learnings.md**
