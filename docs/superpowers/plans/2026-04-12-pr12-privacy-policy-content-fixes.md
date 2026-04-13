# PR #12 Privacy Policy Content Fixes Implementation Plan

**Branch:** `fix/pr12-registeredprofile-error-handling` (worktree)
**Goal:** Fix content accuracy issues in PrivacyPolicy.tsx identified during PR review

**Issues to Fix:**
1. Leaflet disclosure - clarify map tile loading from external servers
2. Anonymous/pseudonymous distinction - clarify that "anonymous" reports store phone
3. Placeholders - remove "[Phone number set by admin]" and "[Address set by admin]"
4. Parental contact section - clarify how/what for parental contact
5. Data breach notification - clarify notification limitations
6. DPA Article 17 scope - clarify anonymization vs. deletion for public records

---

## Task 1: Fix Placeholders in Contact Section

**Files:**
- Modify: `src/app/components/PrivacyPolicy.tsx` (from `feature/legal-compliance-dpa` branch)

**Issue:** Lines 302-303 have `[Phone number set by admin]` and `[Address set by admin]` as placeholders.

**Fix:**
```typescript
// Replace lines 301-303:
// FROM:
<ul className="list-disc pl-6 space-y-1 text-gray-700 mb-4">
  <li>
    Email: <a href={`mailto:${PRIVACY_EMAIL}`} className="text-blue-600 underline">{PRIVACY_EMAIL}</a>
  </li>
  <li>MDRRMO Office: [Phone number set by admin]</li>
  <li>[Address set by admin]</li>
</ul>

// TO:
<ul className="list-disc pl-6 space-y-1 text-gray-700 mb-4">
  <li>
    Email: <a href={`mailto:${PRIVACY_EMAIL}`} className="text-blue-600 underline">{PRIVACY_EMAIL}</a>
  </li>
  <li>MDRRMO Office: Contact your local MDRRMO for office details</li>
</ul>
```

---

## Task 2: Fix Leaflet Third-Party Disclosure

**Files:**
- Modify: `src/app/components/PrivacyPolicy.tsx`

**Issue:** Line 246 says "Location coordinates (public)" for Leaflet, but doesn't clarify that map tiles are loaded from external servers (OpenStreetMap/CDN).

**Fix:**
```typescript
// Update the Leaflet row in the table:
// FROM:
<td className="px-4 py-2 text-sm text-gray-700">Leaflet</td>
<td className="px-4 py-2 text-sm text-gray-700">Maps</td>
<td className="px-4 py-2 text-sm text-gray-700">Location coordinates (public)</td>

// TO:
<td className="px-4 py-2 text-sm text-gray-700">Leaflet + OpenStreetMap</td>
<td className="px-4 py-2 text-sm text-gray-700">Maps</td>
<td className="px-4 py-2 text-sm text-gray-700">Map tiles loaded from external servers; location coordinates you provide</td>
```

---

## Task 3: Clarify Anonymous Reporting / Pseudonymous Distinction

**Files:**
- Modify: `src/app/components/PrivacyPolicy.tsx`

**Issue:** Line 162-171 section "Anonymous Reporting" implies no data is stored, but phone IS stored. DPA requires accurate disclosure.

**Fix:**
```typescript
// Replace the Anonymous Reporting section text:
// FROM:
<h2 className="text-2xl font-semibold text-gray-900 mb-4">Anonymous Reporting</h2>
<p className="text-gray-700 mb-2">When you report anonymously:</p>

// TO:
<h2 className="text-2xl font-semibold text-gray-900 mb-4">Pseudonymous Reporting</h2>
<p className="text-gray-700 mb-2">When you choose not to display your name:</p>

// Also update the important box:
// FROM:
<div className="bg-amber-50 p-4 rounded-lg">
  <p className="text-amber-800 font-medium mb-2">Important:</p>
  <p className="text-amber-700">Even anonymous reports store your phone number for:</p>

// TO:
<div className="bg-amber-50 p-4 rounded-lg">
  <p className="text-amber-800 font-medium mb-2">Important:</p>
  <p className="text-amber-700">Your phone number is still stored for:</p>
```

---

## Task 4: Fix Parental Contact Section

**Files:**
- Modify: `src/app/components/PrivacyPolicy.tsx`

**Issue:** Line 278 says "We will flag the account for parental contact" - unclear how/what this means.

**Fix:**
```typescript
// FROM:
<ul className="list-disc pl-6 space-y-1 text-gray-700">
  <li>We will delete their account and personal data</li>
  <li>We will keep the report (important for emergency response)</li>
  <li>We will flag the account for parental contact</li>
</ul>

// TO:
<ul className="list-disc pl-6 space-y-1 text-gray-700">
  <li>We will delete their account and personal data</li>
  <li>We will keep the report (important for emergency response)</li>
  <li>If contact information is available, we may attempt to notify parents/guardians</li>
</ul>
```

---

## Task 5: Clarify DPA Article 17 Right to Erasure / Data Deletion

**Files:**
- Modify: `src/app/components/PrivacyPolicy.tsx`

**Issue:** "Right to Delete" section doesn't clarify that verified reports cannot be deleted (public record) - only anonymized.

**Fix:**
```typescript
// Update the Right to Delete section:
// FROM:
<div className="mb-6">
  <h3 className="text-lg font-medium text-gray-800 mb-2">3. Right to Delete</h3>
  <p className="text-gray-700 mb-2">You can delete your account and personal data.</p>
  <ul className="list-disc pl-6 space-y-1 text-gray-700">
    <li><strong>How:</strong> Profile → Delete Account</li>
    <li><strong>What's Deleted:</strong> Name, email, phone</li>
    <li><strong>What's Kept:</strong> Verified reports (public record)</li>
    <li><strong>Timeline:</strong> Immediate for account, 30 days for data</li>
  </ul>
</div>

// TO:
<div className="mb-6">
  <h3 className="text-lg font-medium text-gray-800 mb-2">3. Right to Erasure (Article 17)</h3>
  <p className="text-gray-700 mb-2">You can request deletion of your personal data.</p>
  <ul className="list-disc pl-6 space-y-1 text-gray-700">
    <li><strong>How:</strong> Profile → Delete Account</li>
    <li><strong>What's Deleted:</strong> Name, email, phone, unverified reports</li>
    <li><strong>What's Anonymized:</strong> Verified reports become "Anonymous Citizen" (public record cannot be removed)</li>
    <li><strong>Timeline:</strong> Immediate for account, within 30 days for data deletion</li>
  </ul>
</div>
```

---

## Task 6: Clarify Data Breach Notification Limitations

**Files:**
- Modify: `src/app/components/PrivacyPolicy.tsx`

**Issue:** Line 235 says "we will notify you within 72 hours via email and push notification" - doesn't account for cases where contact info is already removed.

**Fix:**
```typescript
// FROM:
<div className="bg-blue-50 p-4 rounded-lg">
  <p className="text-blue-800">
    <strong>Data Breaches:</strong> If your data is exposed, we will notify you within 72 hours via email and push notification.
  </p>
</div>

// TO:
<div className="bg-blue-50 p-4 rounded-lg">
  <p className="text-blue-800">
    <strong>Data Breaches:</strong> If your data is exposed, we will notify you within 72 hours via email and push notification where contact information is still available. We will also post a notice on our website.
  </p>
</div>
```

---

## Verification

After all changes:
```bash
# Run privacy policy tests
npm run test -- PrivacyPolicy.test.tsx

# Run typecheck
npm run typecheck
```

---

## Commit

```bash
git add src/app/components/PrivacyPolicy.tsx
git commit -m "fix(legal): correct privacy policy content accuracy issues

- Clarify Leaflet/OpenStreetMap external tile server loading
- Rename 'Anonymous' to 'Pseudonymous' reporting (phone is stored)
- Remove placeholder text in Contact section
- Clarify parental contact procedure
- Clarify DPA Article 17 right to erasure (anonymization vs deletion)
- Clarify data breach notification limitations

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
