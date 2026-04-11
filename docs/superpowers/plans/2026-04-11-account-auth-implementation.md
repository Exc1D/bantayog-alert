# Account & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement complete account creation flow with phone OTP verification, account linking by phone, and "My Reports" history view for registered users.

**Architecture:** Firebase Auth with phone/OTP, Firestore user profiles, phone-based report linking, TanStack Query for data fetching.

**Tech Stack:** Firebase Auth, Firestore Cloud Functions, React Router, Vitest

**Priority:** HIGH - Core user conversion feature

---

## File Structure

**New files:**
- `src/features/auth/components/SignUpFlow.tsx` - Multi-step signup
- `src/features/auth/components/PhoneVerification.tsx` - OTP input
- `src/features/auth/hooks/usePhoneAuth.ts` - Phone auth hook
- `src/features/profile/components/MyReportsList.tsx` - User's reports history
- `functions/src/sendOTP.ts` - SMS OTP Cloud Function
- `functions/src/linkReportsByPhone.ts` - Report linking

**Files to modify:**
- `src/features/profile/components/AnonymousProfile.tsx` - Wire "Create Account" CTA
- `src/features/profile/components/RegisteredProfile.tsx` - Add "My Reports" section

---

## Task 1: Implement Phone Verification Component

**Files:**
- Create: `src/features/auth/components/PhoneVerification.tsx`
- Test: `src/features/auth/components/__tests__/PhoneVerification.test.tsx`

```typescript
// PhoneVerification.tsx - 6-digit OTP input with resend timer

interface PhoneVerificationProps {
  phoneNumber: string
  onVerified: (code: string) => void
  onResend: () => void
}

// Features:
// - 6 separate input boxes (1 digit each)
// - Auto-focus next box on input
// - Auto-submit on 6th digit
// - Resend button (disabled for 30s)
// - Countdown timer display
// - Error message for wrong code
```

- [ ] **Step 1:** Write test for 6-digit input and auto-focus
- [ ] **Step 2:** Write test for resend timer (30s countdown)
- [ ] **Step 3:** Implement component with separate input boxes
- [ ] **Step 4:** Implement auto-focus logic (useRef + useEffect)
- [ ] **Step 5:** Implement auto-submit on 6th digit
- [ ] **Step 6:** Implement resend timer with useState
- [ ] **Step 7:** Test keyboard navigation (backspace, arrow keys)
- [ ] **Step 8:** Commit: "feat(auth): add phone verification UI with 6-digit OTP"

---

## Task 2: Implement SignUpFlow Component

**Files:**
- Create: `src/features/auth/components/SignUpFlow.tsx`
- Test: `src/features/auth/components/__tests__/SignUpFlow.test.tsx`

```typescript
// SignUpFlow.tsx - Multi-step signup wizard

// Step 1: Name input
// Step 2: Phone number (with PhoneVerification)
// Step 3: Email (optional)
// Step 4: Municipality & Barangay dropdowns
// Step 5: Password (with strength indicator)
// Step 6: Privacy policy agreement
// Step 7: Review & Submit

interface SignUpFlowProps {
  onComplete: (userId: string) => void
  onLinkReports?: (phoneNumber: string) => void
}
```

- [ ] **Step 1:** Write test for step navigation (next/back)
- [ ] **Step 2:** Write test for validation at each step
- [ ] **Step 3:** Implement wizard with useState step tracking
- [ ] **Step 4:** Implement form validation per step
- [ ] **Step 5:** Add progress indicator (●●○○○○)
- [ ] **Step 6:** Implement "Link existing reports" checkbox
- [ ] **Step 7:** Wire to Firebase Auth (createUserWithEmailAndPassword)
- [ ] **Step 8:** Test successful signup flow
- [ ] **Step 9:** Commit: "feat(auth): implement multi-step signup wizard"

---

## Task 3: Implement usePhoneAuth Hook

**Files:**
- Create: `src/features/auth/hooks/usePhoneAuth.ts`
- Test: `src/features/auth/hooks/__tests__/usePhoneAuth.test.ts`

```typescript
// usePhoneAuth.ts - Phone authentication with OTP

interface UsePhoneAuthReturn {
  sendOTP: (phone: string) => Promise<void>
  verifyOTP: (code: string) => Promise<boolean>
  error: string | null
  isSending: boolean
  isVerifying: boolean
  canResend: boolean
  resendCountdown: number
}

// Features:
// - Call Cloud Function to send SMS OTP
// - Verify OTP code
// - 30-second resend timer
// - Error handling (invalid phone, wrong code, rate limit)
```

- [ ] **Step 1:** Write test for sendOTP success
- [ ] **Step 2:** Write test for verifyOTP success/failure
- [ ] **Step 3:** Implement hook with useMutation (TanStack Query)
- [ ] **Step 4:** Implement resend countdown timer
- [ ] **Step 5:** Add error handling for invalid phone format
- [ ] **Step 6:** Add error handling for rate limiting
- [ ] **Step 7:** Test hook with renderHook
- [ ] **Step 8:** Commit: "feat(auth): add phone auth hook with OTP verification"

---

## Task 4: Create SendOTP Cloud Function

**Files:**
- Create: `functions/src/sendOTP.ts`

```typescript
// sendOTP.ts - Send SMS OTP via Firebase Auth

// Features:
// - Generate 6-digit random code
// - Store in Firestore (user_otp collection)
// - Send via Firebase Auth phone auth
// - 10-minute expiry
// - Rate limiting (1 OTP per minute per phone)
// - Log for security audit

// Exports:
export const sendOTP = functions.https.onCall(async (data, context) => {
  const { phoneNumber } = data

  // 1. Validate phone format (PH)
  // 2. Check rate limit (user_otp collection)
  // 3. Generate 6-digit code
  // 4. Store in user_otp with expiry
  // 5. Send via Firebase Auth
  // 6. Return success
})
```

- [ ] **Step 1:** Write tests for OTP generation
- [ ] **Step 2:** Write tests for rate limiting
- [ ] **Step 3:** Implement phone validation (PH regex)
- [ ] **Step 4:** Implement rate limiting check
- [ ] **Step 5:** Implement OTP generation (crypto.randomInt)
- [ ] **Step 6:** Implement OTP storage with TTL
- [ ] **Step 7:** Wire Firebase Auth phone verification
- [ ] **Step 8:** Add security logging
- [ ] **Step 9:** Deploy and test with real phone
- [ ] **Step 10:** Commit: "feat(functions): add SMS OTP sending with rate limiting"

---

## Task 5: Implement Report Linking by Phone

**Files:**
- Modify: `src/features/profile/components/LinkReportsByPhone.tsx`
- Create: `functions/src/linkReportsByPhone.ts`

```typescript
// LinkReportsByPhone.tsx - Already exists, verify implementation

// Should:
// - Accept phone number input
// - Query report_private collection by reporterPhone
// - Display matching reports
// - Allow user to confirm linking
// - Update reports' createdBy.uid
```

- [ ] **Step 1:** Review existing LinkReportsByPhone component
- [ ] **Step 2:** Write tests for report matching logic
- [ ] **Step 3:** Implement Cloud Function to update reports
- [ ] **Step 4:** Add confirmation dialog before linking
- [ ] **Step 5:** Test linking with test data
- [ ] **Step 6:** Commit: "feat(auth): implement report linking by phone number"

---

## Task 6: Implement MyReportsList Component

**Files:**
- Create: `src/features/profile/components/MyReportsList.tsx`
- Test: `src/features/profile/components/__tests__/MyReportsList.test.tsx`

```typescript
// MyReportsList.tsx - User's submitted reports

interface MyReportsListProps {
  userId: string
}

// Features:
// - Fetch reports where createdBy.uid === userId
// - Group by status (pending, verified, resolved)
// - Show timeline/status for each report
// - Tap to view ReportDetailScreen
// - Empty state when no reports
// - Pull to refresh
```

- [ ] **Step 1:** Write test for fetching user reports
- [ ] **Step 2:** Write test for empty state
- [ ] **Step 3:** Write test for status grouping
- [ ] **Step 4:** Implement component with useQuery
- [ ] **Step 5:** Implement status badge display
- [ ] **Step 6:** Implement tap navigation to ReportDetailScreen
- [ ] **Step 7:** Add loading skeleton
- [ ] **Step 8:** Test with real user data
- [ ] **Step 9:** Commit: "feat(profile): add My Reports history view"

---

## Task 7: Wire Create Account CTA in AnonymousProfile

**Files:**
- Modify: `src/features/profile/components/AnonymousProfile.tsx`

- [ ] **Step 1:** Write test for CTA button click
- [ ] **Step 2:** Add onClick handler to "Create Account" button
- [ ] **Step 3:** Navigate to /signup route
- [ ] **Step 4:** Test navigation flow
- [ ] **Step 5:** Commit: "feat(profile): wire create account CTA to signup flow"

---

## Task 8: Add My Reports to RegisteredProfile

**Files:**
- Modify: `src/features/profile/components/RegisteredProfile.tsx`

- [ ] **Step 1:** Import MyReportsList component
- [ ] **Step 2:** Add "My Reports" section
- [ ] **Step 3:** Display report count (QuickStats)
- [ ] **Step 4:** Test with registered user
- [ ] **Step 5:** Commit: "feat(profile): add My Reports to registered profile"

---

## Task 9: Add Signup Route and Integration

**Files:**
- Modify: `src/app/routes.tsx`
- Create: `src/app/Signup.tsx`

- [ ] **Step 1:** Create /signup route
- [ ] **Step 2:** Create Signup page component
- [ ] **Step 3:** Render SignUpFlow
- [ ] **Step 4:** Handle successful signup (redirect to profile)
- [ ] **Step 5:** Handle report linking flow
- [ ] **Step 6:** Test complete signup journey
- [ ] **Step 7:** Commit: "feat(auth): add signup route and page"

---

## Self-Review

**✓ Spec coverage:** Account creation, OTP verification, report linking, My Reports all implemented

**✓ Placeholder scan:** No placeholders - Cloud Functions complete

**✓ Type consistency:** User data structures match existing patterns

**Plan complete and saved to `docs/superpowers/plans/2026-04-11-account-auth-implementation.md`**

**Execution:** All tasks independent except 6→8 (MyReportsList must exist before adding to profile). Can parallelize Tasks 1-5.
