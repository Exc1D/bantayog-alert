# Legal Compliance (DPA) Implementation Plan (REVISED v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for all implementation tasks.
> Tests MUST be written BEFORE implementation code.

**Goal:** Implement Data Privacy Act (RA 10173) compliance features: privacy policy, consent flow, data deletion, and user data access.

**Existing Infrastructure (already implemented):**
- `exportUserData()` and `deleteUserAccount()` already exist in `src/features/profile/services/profile.service.ts`
- `deleteUserData` Cloud Function exists in `functions/src/index.ts`
- Download/Delete buttons already exist in `RegisteredProfile.tsx` Settings tab
- AgeGate with COPPA compliance exists (`AgeGate.tsx`)

**What's Missing (Actual Gaps per codebase analysis):**
1. Privacy Policy page (component + route) - WAS COMPLETELY MISSING
2. Privacy Policy consent checkbox in ReportForm - THE ACTUAL MISSING PIECE
3. Privacy Policy link accessible from profile settings

**Tech Stack:** React components (consent UI), Firebase Functions (deletion), Firestore (data retention)

**Priority:** CRITICAL - Blocks public release due to legal liability

---

## File Structure

**New files to create:**
- `public/privacy-policy.md` - Plain-language privacy policy
- `src/app/components/PrivacyPolicy.tsx` - Privacy policy viewer component

**Files to modify:**
- `src/app/routes.tsx` - Add privacy policy route
- `src/features/profile/components/RegisteredProfile.tsx` - Add privacy policy link
- `src/features/report/components/ReportForm.tsx` - Add consent checkbox

**No changes needed (already implemented):**
- `functions/src/deleteAccount.ts` - Already exists as `deleteUserData` in functions/src/index.ts
- `functions/src/exportUserData.ts` - Already exists as client-side `exportUserData` in profile.service.ts
- `src/features/profile/components/DataDeletion.tsx` - Already exists inline in RegisteredProfile.tsx
- `src/features/profile/components/DownloadData.tsx` - Already exists inline in RegisteredProfile.tsx

---

## Task 1: Privacy Policy Page

**Files:**
- Create: `public/privacy-policy.md`
- Create: `src/app/components/PrivacyPolicy.tsx`
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Write failing test for PrivacyPolicy component**

```typescript
// src/app/components/__tests__/PrivacyPolicy.test.tsx

import { render, screen } from '@testing-library/react'
import PrivacyPolicy from '../PrivacyPolicy'

describe('PrivacyPolicy', () => {
  it('should render privacy policy title', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByText(/privacy policy/i)).toBeInTheDocument()
  })

  it('should render data collection section', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByText(/what data we collect/i)).toBeInTheDocument()
  })

  it('should render user rights section', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByText(/your rights/i)).toBeInTheDocument()
  })

  it('should render contact information', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByText(/contact us/i)).toBeInTheDocument()
    expect(screen.getByText(/privacy@bantayogalert.gov.ph/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PrivacyPolicy.test.tsx`
Expected: FAIL - PrivacyPolicy component does not exist

- [ ] **Step 3: Create privacy policy markdown document**

```markdown
<!-- public/privacy-policy.md -->

# Privacy Policy

**Bantayog Alert**
**Last Updated:** April 12, 2026
**Version:** 1.0

---

## What Data We Collect

### When You Submit a Report
- **Photos/Videos:** Evidence of the incident (optional)
- **Location:** Where the incident happened (GPS or manual)
- **Description:** What you observed
- **Contact Information:** Phone number (required) and email (optional)

### When You Create an Account
- **Name:** Your display name
- **Phone Number:** For verification and notifications
- **Email:** For account recovery (optional)
- **Municipality & Barangay:** Your location in Camarines Norte

### Technical Data
- **Device Information:** Browser type, OS version
- **Usage Data:** Which features you use, when you use them
- **Location Data:** Approximate location for relevant alerts

---

## How We Use Your Data

### Primary Purpose
To coordinate disaster response in Camarines Norte by:
- Verifying and triaging incident reports
- Dispatching emergency responders
- Sending official alerts and warnings
- Improving response times through data analysis

### Legal Basis
- **Consent:** You explicitly agree when submitting reports
- **Legitimate Interest:** Coordinating emergency response
- **Legal Requirement:** Compliance with disaster response laws

---

## Who Can See Your Data

### Public (Everyone)
- **Report Content:** What happened (no personal info)
- **Photos:** After verification (no faces/identifying info)
- **Location:** Approximate (barangay level, not exact address)

### Administrators (MDRRMO Staff)
- **All Report Data:** Including contact info for follow-up
- **Your Identity:** Even for anonymous reports (legal compliance)

### Responders (Emergency Services)
- **Report Content:** What and where
- **NO Contact Info:** Privacy protection

### NEVER Shared Publicly
- Your name
- Your phone number
- Your email
- Your exact address

---

## Anonymous Reporting

When you report anonymously:
- **Hidden From:** Public, responders, municipal admins
- **Visible To:** Provincial superadmins (legal compliance only)
- **Exception:** Court order can reveal identity (legal requirement)

**Important:** Even anonymous reports store your phone number for:
1. Follow-up questions about the incident
2. Legal compliance (court orders)
3. Fraud prevention (abuse detection)

---

## Data Retention

| Data Type | How Long We Keep It |
|-----------|---------------------|
| Verified reports | Forever (public record) |
| Unverified reports | 6 months, then auto-deleted |
| Anonymous reports | 1 year (analytics only) |
| Account data | Until you delete your account |
| Contact logs | 1 year |
| Location data | Same as report |

**After Deletion:**
- Your name, email, phone are deleted
- Verified reports remain (public record)
- Unverified reports are anonymized ("Citizen" instead of name)

---

## Your Rights (Data Privacy Act)

### 1. Right to Access
You can request a copy of all data we have about you.
- **How:** Profile → Download My Data
- **Format:** JSON file
- **Timeline:** Within 24 hours

### 2. Right to Correct
You can update your account information anytime.
- **How:** Profile → Edit Profile
- **Changes:** Immediate

### 3. Right to Delete
You can delete your account and personal data.
- **How:** Profile → Delete Account
- **What's Deleted:** Name, email, phone
- **What's Kept:** Verified reports (public record)
- **Timeline:** Immediate for account, 30 days for data

### 4. Right to Object
You can object to how we use your data.
- **How:** Email privacy@bantayogalert.gov.ph
- **Response:** Within 15 days

### 5. Right to File a Complaint
You can file a complaint with the National Privacy Commission.
- **Website:** https://privacy.gov.ph
- **Email:** complaints@privacy.gov.ph

---

## Data Security

We protect your data with:
- **Encryption:** All data encrypted in transit and at rest
- **Access Controls:** Only authorized staff can access personal data
- **Audit Logs:** All data access is logged
- **Regular Audits:** Security reviewed quarterly

**Data Breaches:** If your data is exposed, we will notify you within 72 hours via email and push notification.

---

## Third-Party Services

We use these services to run Bantayog Alert:

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| Firebase (Google) | Database, hosting | All data (encrypted) |
| Firebase Cloud Messaging | Push notifications | Device token only |
| Leaflet | Maps | Location coordinates (public) |

**All services comply with data privacy standards.**

---

## Children's Privacy

**You must be 13 years or older to use this app.**

If we discover a child under 13 has submitted a report:
- We will delete their account and personal data
- We will keep the report (important for emergency response)
- We will flag the account for parental contact

---

## Changes to This Policy

We may update this policy. We will notify you of significant changes via:
- In-app notification
- Email (if provided)
- Push notification

**Last Updated:** April 12, 2026

---

## Contact Us

**Questions about this policy?**
Email: privacy@bantayogalert.gov.ph
MDRRMO Office: [Phone number set by admin]
[Address set by admin]

---

**This policy is written in plain language as required by the Data Privacy Act of 2012 (Republic Act No. 10173).**
```

- [ ] **Step 4: Create PrivacyPolicy viewer component**

**Security Note:** Use React elements for safe rendering (NO dangerouslySetInnerHTML).

```typescript
// src/app/components/PrivacyPolicy.tsx

import React from 'react'

/**
 * Privacy Policy Viewer Component
 *
 * Renders the plain-language privacy policy for Bantayog Alert.
 * Uses React elements for safe rendering.
 */
export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last Updated: April 12, 2026</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2>What Data We Collect</h2>

            <h3>When You Submit a Report</h3>
            <ul>
              <li><strong>Photos/Videos:</strong> Evidence of the incident (optional)</li>
              <li><strong>Location:</strong> Where the incident happened (GPS or manual)</li>
              <li><strong>Description:</strong> What you observed</li>
              <li><strong>Contact Information:</strong> Phone number (required) and email (optional)</li>
            </ul>

            <h3>When You Create an Account</h3>
            <ul>
              <li><strong>Name:</strong> Your display name</li>
              <li><strong>Phone Number:</strong> For verification and notifications</li>
              <li><strong>Email:</strong> For account recovery (optional)</li>
              <li><strong>Municipality & Barangay:</strong> Your location in Camarines Norte</li>
            </ul>
          </section>

          <section>
            <h2>How We Use Your Data</h2>
            <p>To coordinate disaster response in Camarines Norte by:</p>
            <ul>
              <li>Verifying and triaging incident reports</li>
              <li>Dispatching emergency responders</li>
              <li>Sending official alerts and warnings</li>
              <li>Improving response times through data analysis</li>
            </ul>
          </section>

          <section>
            <h2>Who Can See Your Data</h2>

            <h3>Public (Everyone)</h3>
            <ul>
              <li><strong>Report Content:</strong> What happened (no personal info)</li>
              <li><strong>Photos:</strong> After verification (no faces/identifying info)</li>
              <li><strong>Location:</strong> Approximate (barangay level, not exact address)</li>
            </ul>

            <h3>Administrators (MDRRMO Staff)</h3>
            <ul>
              <li><strong>All Report Data:</strong> Including contact info for follow-up</li>
              <li><strong>Your Identity:</strong> Even for anonymous reports (legal compliance)</li>
            </ul>

            <h3>Responders (Emergency Services)</h3>
            <ul>
              <li><strong>Report Content:</strong> What and where</li>
              <li><strong>NO Contact Info:</strong> Privacy protection</li>
            </ul>
          </section>

          <section>
            <h2>Your Rights (Data Privacy Act)</h2>

            <h3>1. Right to Access</h3>
            <p>You can request a copy of all data we have about you via Profile → Download My Data</p>

            <h3>2. Right to Correct</h3>
            <p>You can update your account information anytime via Profile → Edit Profile</p>

            <h3>3. Right to Delete</h3>
            <p>You can delete your account and personal data via Profile → Delete Account</p>
            <p><strong>What's Deleted:</strong> Name, email, phone</p>
            <p><strong>What's Kept:</strong> Verified reports (public record)</p>

            <h3>4. Right to Object</h3>
            <p>Email: privacy@bantayogalert.gov.ph</p>

            <h3>5. Right to File a Complaint</h3>
            <p>National Privacy Commission: privacy.gov.ph</p>
          </section>

          <section>
            <h2>Data Security</h2>
            <p>We protect your data with:</p>
            <ul>
              <li><strong>Encryption:</strong> All data encrypted in transit and at rest</li>
              <li><strong>Access Controls:</strong> Only authorized staff can access personal data</li>
              <li><strong>Audit Logs:</strong> All data access is logged</li>
            </ul>
          </section>

          <section>
            <h2>Children's Privacy</h2>
            <p><strong>You must be 13 years or older to use this app.</strong></p>
          </section>

          <section>
            <h2>Contact Us</h2>
            <p>Email: privacy@bantayogalert.gov.ph</p>
            <p><em>This policy is written in plain language as required by the Data Privacy Act of 2012 (Republic Act No. 10173).</em></p>
          </section>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add route to routes.tsx**

```typescript
// src/app/routes.tsx

// Add import
import PrivacyPolicy from './components/PrivacyPolicy'

// Add to routes array
{
  path: '/privacy-policy',
  element: <PrivacyPolicy />,
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- PrivacyPolicy.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add public/privacy-policy.md src/app/components/PrivacyPolicy.tsx src/app/routes.tsx
git commit -m "feat(legal): add privacy policy page and route

- Create PrivacyPolicy component with DPA-compliant content
- Add /privacy-policy route
- Written in plain language per RA 10173

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add Privacy Policy Link to Profile Settings

**Files:**
- Modify: `src/features/profile/components/RegisteredProfile.tsx`

- [ ] **Step 1: Write failing test for privacy policy link**

```typescript
// src/features/profile/components/__tests__/RegisteredProfile.privacyLink.test.tsx

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisteredProfile } from '../RegisteredProfile'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

// Wrapper with all providers...

describe('RegisteredProfile - Privacy Link', () => {
  it('should render privacy policy link in settings tab', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <RegisteredProfile />
      </Wrapper>
    )

    // Navigate to settings tab
    const settingsTab = screen.getByTestId('tab-settings')
    await user.click(settingsTab)

    const privacyLink = screen.getByRole('link', { name: /privacy policy/i })
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy')
  })
})
```

- [ ] **Step 2: Add privacy link to SettingsTab**

Add privacy link in the Data Management section (after the buttons):

```typescript
// In SettingsTab component, in Data Management section:
<div className="mt-4 pt-4 border-t border-gray-200">
  <a
    href="/privacy-policy"
    className="text-sm text-primary-blue underline hover:text-blue-700"
    target="_blank"
    rel="noopener noreferrer"
  >
    View Privacy Policy
  </a>
</div>
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- RegisteredProfile.privacyLink.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/components/RegisteredProfile.tsx
git commit -m "feat(legal): add privacy policy link to profile settings

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Add Consent Checkbox to Report Form

**Files:**
- Modify: `src/features/report/components/ReportForm.tsx`

- [ ] **Step 1: Write failing test for consent checkbox**

```typescript
// src/features/report/components/__tests__/ReportForm.consent.test.tsx

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportForm } from '../ReportForm'
import { BrowserRouter } from 'react-router-dom'

describe('ReportForm - Privacy Consent', () => {
  it('should require privacy policy agreement before submission', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <ReportForm />
      </BrowserRouter>
    )

    // Fill all required fields except consent
    await fillAllRequiredFields(screen, user)

    const submitButton = screen.getByRole('button', { name: /submit/i })
    await user.click(submitButton)

    // Should show validation error
    expect(screen.getByText(/agree to privacy policy/i)).toBeInTheDocument()
  })

  it('should link to privacy policy from consent checkbox', () => {
    render(
      <BrowserRouter>
        <ReportForm />
      </BrowserRouter>
    )

    const privacyLink = screen.getByRole('link', { name: /privacy policy/i })
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy')
  })

  it('should enable submission when consent is given', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <BrowserRouter>
        <ReportForm onSubmit={onSubmit} />
      </BrowserRouter>
    )

    await fillAllRequiredFields(screen, user)

    const consentCheckbox = screen.getByRole('checkbox', { name: /agree/i })
    await user.click(consentCheckbox)

    const submitButton = screen.getByRole('button', { name: /submit/i })
    await user.click(submitButton)

    expect(onSubmit).toHaveBeenCalled()
  })
})

async function fillAllRequiredFields(screen, user) {
  // Fill incident type
  await user.selectOptions(screen.getByRole('combobox'), 'flood')

  // Fill description
  const descriptionInput = screen.getByLabelText(/description/i)
  await user.type(descriptionInput, 'Test report description')

  // Fill phone
  const phoneInput = screen.getByLabelText(/phone/i)
  await user.type(phoneInput, '09123456789')
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ReportForm.consent.test.tsx`
Expected: FAIL - No consent checkbox exists

- [ ] **Step 3: Implement consent checkbox in ReportForm**

Locate the submit button section in ReportForm and add before it:

```typescript
// Add to form state
const [privacyConsent, setPrivacyConsent] = useState(false)
const [privacyConsentError, setPrivacyConsentError] = useState<string | null>(null)

// Add to form JSX, before submit button:
<div className="space-y-2">
  <label className="flex items-start gap-3 cursor-pointer">
    <input
      type="checkbox"
      name="privacyConsent"
      required
      className="mt-1 w-4 h-4 text-primary-blue border-gray-300 rounded focus:ring-primary-blue"
      checked={privacyConsent}
      onChange={(e) => {
        setPrivacyConsent(e.target.checked)
        if (e.target.checked) setPrivacyConsentError(null)
      }}
    />
    <span className="text-sm text-gray-700">
      I have read and agree to the{' '}
      <a
        href="/privacy-policy"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-blue underline hover:text-blue-700"
      >
        Privacy Policy
      </a>{' '}
      and consent to the collection and processing of my personal data.
    </span>
  </label>
  {privacyConsentError && (
    <span className="text-sm text-red-600" role="alert">
      {privacyConsentError}
    </span>
  )}
</div>
```

- [ ] **Step 4: Add validation in handleSubmit**

```typescript
// In handleSubmit function, before existing validation:

if (!privacyConsent) {
  setPrivacyConsentError('You must agree to the Privacy Policy to submit a report.')
  return
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- ReportForm.consent.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/report/components/ReportForm.tsx src/features/report/components/__tests__/ReportForm.consent.test.tsx
git commit -m "feat(legal): add privacy policy consent to report form

- Add required checkbox for privacy policy agreement
- Link to full privacy policy document
- Validate consent before submission
- DPA compliance (explicit consent requirement)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Verify Firestore Rules for Data Deletion

**Files:**
- Review: `firestore.rules`

- [ ] **Step 1: Verify deletion rules allow user data deletion**

Review that users can delete their own data via client-side SDK (already implemented in `profile.service.ts`).

Expected: `deleteUserAccount()` in profile.service.ts already handles:
- Deleting from `report_private` collection
- Deleting from `report_ops` collection
- Deleting user profile from `users` collection
- Deleting Firebase Auth user

No changes needed - this is already implemented.

- [ ] **Step 2: Commit (if any changes needed)**

```bash
git add firestore.rules
git commit -m "docs(legal): verify firestore rules for DPA compliance

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review Checklist

**Spec Coverage:**
- [x] Privacy policy document (plain-language per RA 10173)
- [x] Privacy policy page with route
- [x] Privacy policy link from profile settings
- [x] Consent checkbox in ReportForm with validation
- [x] Download my data (already exists in RegisteredProfile)
- [x] Delete account (already exists in RegisteredProfile)
- [x] Firestore rules verified for deletion

**TDD Compliance:**
- [x] All tasks have tests written FIRST
- [x] Tests fail before implementation
- [x] Tests pass after implementation

**No Duplicate Work:**
- [x] No new Cloud Functions created (deleteUserData already exists)
- [x] No new client-side services (exportUserData/deleteUserAccount already exist)
- [x] No new components for download/deletion (already inline in RegisteredProfile)

**Scope Reduction from Original Plan:**
- Removed: `src/shared/components/ConsentCheckbox.tsx` (consent is directly in ReportForm)
- Removed: `src/features/profile/components/DataDeletion.tsx` (already inline)
- Removed: `src/features/profile/components/DownloadData.tsx` (already inline)
- Removed: `functions/src/deleteAccount.ts` (already exists as deleteUserData)
- Removed: `functions/src/exportUserData.ts` (already exists client-side)
- Removed: Firestore.rules changes (rules already support deletion)

**Files Modified (reduced scope):**
- Task 1: 3 files (privacy-policy.md, PrivacyPolicy.tsx, routes.tsx)
- Task 2: 1 file (RegisteredProfile.tsx)
- Task 3: 2 files (ReportForm.tsx, test file)

**Total New Files:** 2 (privacy-policy.md, PrivacyPolicy.tsx)
**Total Modified Files:** 4

---

## Plan Complete

**Revised based on actual codebase analysis:**

Much of the DPA functionality was already implemented:
- `exportUserData()` and `deleteUserAccount()` in profile.service.ts
- Download/Delete buttons in RegisteredProfile.tsx Settings tab
- AgeGate with COPPA compliance

**What's new (minimal scope):**
1. Privacy Policy page (was completely missing)
2. Privacy policy link from profile settings
3. Consent checkbox in ReportForm (the actual missing piece)

This is a much smaller implementation than originally planned, avoiding duplication of existing functionality.
