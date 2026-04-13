# Account & Auth Implementation Plan (Revised)

> **Revised approach:** Anonymous-first, optional registration. Email/password auth (no phone OTP). Phone as optional contact field.

**Goal:** Enable registered users to track their reports, receive updates, and link anonymous submissions to their account. Non-registered users can still submit reports.

**Architecture:** Firebase Auth with email/password, Firestore user profiles, phone-based report linking via existing LinkReportsByPhone, TanStack Query for data fetching.

**Core Principle:** "Submit first, register later." Auth is never a barrier to reporting.

---

## File Structure

**New files:**
- `src/features/auth/components/SignUpFlow.tsx` - Multi-step signup wizard
- `src/features/profile/components/MyReportsList.tsx` - User's reports history
- `src/app/Signup.tsx` - Signup page component

**Files to modify:**
- `src/features/profile/components/AnonymousProfile.tsx` - Wire `onCreateAccount` to navigate to `/signup`
- `src/features/profile/components/LinkReportsByPhone.tsx` - Add post-link registration prompt
- `src/features/profile/components/RegisteredProfile.tsx` - Add "My Reports" section
- `src/app/routes.tsx` - Add `/signup` route

**Existing (reuse):**
- `src/domains/citizen/services/auth.service.ts` - Already has `registerCitizen` with email/password
- `src/features/profile/components/LinkReportsByPhone.tsx` - Already exists, enhance it

---

## Task 1: Create SignUpFlow Component

**Files:**
- Create: `src/features/auth/components/SignUpFlow.tsx`
- Test: `src/features/auth/components/__tests__/SignUpFlow.test.tsx`

**SignUpFlow - Multi-step wizard (Email/Password + optional phone)**

```
Step 1: Name input (required)
Step 2: Email input (required, validated)
Step 3: Password input (required, strength indicator)
Step 4: Phone number (optional, for report updates)
Step 5: Municipality dropdown (required, for response coordination)
Step 6: Privacy policy agreement (required checkbox)
Step 7: Review & Submit
```

```typescript
interface SignUpFlowProps {
  onComplete: (userId: string) => void
  onCancel?: () => void
}
```

**Why this order:** Name → Email → Password → Phone (optional) → Municipality → Privacy → Review

**Key decisions:**
- Phone is optional (users can add later)
- Password strength indicator (8+ chars, mix of types)
- Municipality required for emergency response coordination
- Privacy policy agreement required per DPA compliance

- [ ] **Step 1:** Write test for step navigation (next/back)
- [ ] **Step 2:** Write test for validation at each step
- [ ] **Step 3:** Write test for password strength indicator
- [ ] **Step 4:** Write test for privacy checkbox requirement
- [ ] **Step 5:** Implement wizard with `useState` step tracking
- [ ] **Step 6:** Implement form validation per step
- [ ] **Step 7:** Add progress indicator (●●○○○○○)
- [ ] **Step 8:** Wire to existing `registerCitizen` from auth.service
- [ ] **Step 9:** Test successful signup flow
- [ ] **Step 10:** Commit: "feat(auth): add multi-step signup wizard with email/password"

---

## Task 2: Create Signup Page Route

**Files:**
- Create: `src/app/Signup.tsx`
- Modify: `src/app/routes.tsx`

- [ ] **Step 1:** Create `src/app/Signup.tsx` page component
- [ ] **Step 2:** Render `<SignUpFlow>` with proper callbacks
- [ ] **Step 3:** Handle `onComplete` to redirect to profile
- [ ] **Step 4:** Add `/signup` route to router
- [ ] **Step 5:** Test navigation to /signup and successful signup redirects
- [ ] **Step 6:** Commit: "feat(auth): add /signup route and page"

---

## Task 3: Wire Create Account CTA in AnonymousProfile

**Files:**
- Modify: `src/features/profile/components/AnonymousProfile.tsx`

The `AnonymousProfile` already has `onCreateAccount?: () => void` prop. Need to wire it to navigate to `/signup`.

- [ ] **Step 1:** Write test for CTA button click triggers navigation
- [ ] **Step 2:** Import `useNavigate` from react-router-dom
- [ ] **Step 3:** Wire button `onClick` to `navigate('/signup')`
- [ ] **Step 4:** Test navigation flow
- [ ] **Step 5:** Commit: "feat(profile): wire create account CTA to signup flow"

---

## Task 4: Enhance LinkReportsByPhone with Registration Prompt

**Files:**
- Modify: `src/features/profile/components/LinkReportsByPhone.tsx`
- Test: Update `src/features/profile/components/__tests__/LinkReportsByPhone.test.tsx`

**Enhancement:** After successfully linking reports, show a prompt to create an account so they can track these reports in the future.

```typescript
// Add to LinkReportsByPhoneProps
interface LinkReportsByPhoneProps {
  onSuccess?: (count: number) => void
  onCreateAccount?: () => void  // NEW: Navigate to signup
}
```

**UX flow:**
1. User enters phone → clicks "Link Reports"
2. Found reports displayed with confirmation
3. After confirming linking: show prompt "Create account to track these reports"
4. "Create Account" button → navigate to `/signup?phone={linkedPhone}`

- [ ] **Step 1:** Write test for post-link registration prompt
- [ ] **Step 2:** Add `onCreateAccount` callback prop
- [ ] **Step 3:** After successful linking, show registration prompt
- [ ] **Step 4:** Pass pre-filled phone number via URL query param
- [ ] **Step 5:** Test the full flow: link → prompt → signup with phone
- [ ] **Step 6:** Commit: "feat(profile): add post-link registration prompt to LinkReportsByPhone"

---

## Task 5: Implement MyReportsList Component

**Files:**
- Create: `src/features/profile/components/MyReportsList.tsx`
- Test: `src/features/profile/components/__tests__/MyReportsList.test.tsx`

```typescript
interface MyReportsListProps {
  userId: string
}
```

**Features:**
- Fetch reports where `createdBy.uid === userId` (registered reports)
- Fetch reports where `reporterPhone === user.phoneNumber` (linked anonymous reports)
- Combine and deduplicate results
- Group by status (pending, verified, resolved)
- Show timeline/status for each report
- Tap to view ReportDetailScreen
- Empty state when no reports
- Pull to refresh

**Query approach:**
```typescript
// Registered reports
const registeredQuery = query(
  collection(db, 'report_private'),
  where('createdBy.uid', '==', userId)
)

// Linked anonymous reports (via phone)
const linkedQuery = query(
  collection(db, 'report_private'),
  where('reporterPhone', '==', user.phoneNumber)
)
```

- [ ] **Step 1:** Write test for fetching user reports
- [ ] **Step 2:** Write test for empty state
- [ ] **Step 3:** Write test for status grouping
- [ ] **Step 4:** Write test for combined registered + linked reports
- [ ] **Step 5:** Implement component with useQuery
- [ ] **Step 6:** Implement status badge display
- [ ] **Step 7:** Implement tap navigation to ReportDetailScreen
- [ ] **Step 8:** Add loading skeleton
- [ ] **Step 9:** Test with real user data
- [ ] **Step 10:** Commit: "feat(profile): add My Reports history view"

---

## Task 6: Add My Reports to RegisteredProfile

**Files:**
- Modify: `src/features/profile/components/RegisteredProfile.tsx`

- [ ] **Step 1:** Import MyReportsList component
- [ ] **Step 2:** Add "My Reports" section below QuickStats
- [ ] **Step 3:** Display report count (from QuickStats or inline count)
- [ ] **Step 4:** Test with registered user that has reports
- [ ] **Step 5:** Commit: "feat(profile): add My Reports to registered profile"

---

## Task 7: Pre-fill Phone in SignUpFlow from Query Param

**Files:**
- Modify: `src/features/auth/components/SignUpFlow.tsx`
- Modify: `src/app/Signup.tsx`

**UX improvement:** When navigating to `/signup?phone=+639123456789`, pre-fill the phone field.

```typescript
// In Signup.tsx - parse query param
const searchParams = new URLSearchParams(location.search)
const prefillPhone = searchParams.get('phone') || ''

// Pass to SignUpFlow
<SignUpFlow initialPhone={prefillPhone} ... />
```

- [ ] **Step 1:** Write test for pre-filled phone from query param
- [ ] **Step 2:** Add `initialPhone?: string` prop to SignUpFlow
- [ ] **Step 3:** Pre-fill phone field if initialPhone provided
- [ ] **Step 4:** Skip phone step if already pre-filled (or allow edit)
- [ ] **Step 5:** Test: LinkReportsByPhone → Create Account → Phone pre-filled
- [ ] **Step 6:** Commit: "feat(auth): pre-fill phone from LinkReportsByPhone query param"

---

## Task 8: Handle SignUpFlow Success - Redirect to Profile

**Files:**
- Modify: `src/app/Signup.tsx`

**Current:** `onComplete(userId)` callback exists but needs proper redirect.

- [ ] **Step 1:** After successful registration, redirect to `/profile`
- [ ] **Step 2:** Consider: Should we auto-link reports by phone after signup?
  - If user just linked reports via LinkReportsByPhone → then created account with same phone, those reports should now show in MyReportsList
- [ ] **Step 3:** Test complete flow: Link → Signup → Profile shows linked reports
- [ ] **Step 4:** Commit: "feat(auth): redirect to profile after successful signup"

---

## Self-Review Checklist

- [ ] **Spec coverage:** Signup wizard, My Reports, CTA wiring, LinkReportsByPhone enhancement
- [ ] **No placeholders:** All Cloud Functions are Firebase native (existing)
- [ ] **Type consistency:** Uses existing `AuthCredentials`, `UserProfile` types
- [ ] **Anonymous-first:** Non-registered users can still submit reports
- [ ] **No phone OTP:** Email/password only, phone is optional contact field
- [ ] **DPA compliant:** Privacy policy checkbox required during signup

---

## Task Dependencies

```
Task 1 (SignUpFlow) ──┬── Task 2 (Signup route)
                      │
Task 3 (Wire CTA) ◄───┘
                      │
Task 4 (Enhance LinkReportsByPhone) ──→ Task 7 (Pre-fill phone)

Task 5 (MyReportsList) ──→ Task 6 (Add to RegisteredProfile)
```

**Parallelizable:** Tasks 1, 3, 5 can run in parallel (no shared state).

**Sequential:** Task 6 depends on Task 5. Task 7 depends on Tasks 1 and 4.

---

## What's NOT In This Plan

- Phone OTP / SMS verification (intentional - see rationale)
- Changing ReportForm to require auth (anonymous submission preserved)
- Deleting/moving existing auth service files
- Firebase Cloud Functions for auth (existing native Firebase Auth is sufficient)

**Plan complete and saved to `docs/superpowers/plans/2026-04-13-account-auth-revised.md`**
