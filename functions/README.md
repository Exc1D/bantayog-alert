# Firebase Cloud Functions for Bantayog Alert

This directory contains Firebase Cloud Functions that handle backend operations requiring elevated privileges, including custom claims management, audit logging, and data retention policies.

## Overview

The Cloud Functions implement critical security features:

1. **Custom Claims Management** — Sets role-based claims for authorization
2. **Token Refresh Signals** — Forces clients to refresh tokens after permission changes
3. **Audit Logging** — Logs administrative actions for accountability
4. **Data Retention** — Scheduled deletion of old data (GDPR compliance)
5. **User Deletion** — Complete data removal for GDPR "right to be forgotten"

## Prerequisites

1. **Firebase CLI** — Install globally: `npm install -g firebase-tools`
2. **Node.js 18+** — Required by Firebase Functions
3. **Firebase Project** — Already initialized in parent directory

## Setup Instructions

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Initialize Firebase Functions (if not already done)

```bash
# From project root
firebase init functions

# When prompted:
# - Select: Use an existing project
# - Select: Bantayog Alert project
# - Language: TypeScript
# - ESLint: Yes
# - Install dependencies: Yes
```

### 3. Configure Firebase Project

Ensure your `firebase.json` includes functions configuration:

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs18"
  }
}
```

### 4. Set Up Service Account (for local development)

```bash
# Generate service account key from Firebase Console
# Download and place in: functions/service-account-key.json

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="functions/service-account-key.json"
```

## Available Functions

### Triggers

#### `setCustomClaimsOnUserCreation`
**Type:** Auth trigger (`functions.auth.user().onCreate`)

Automatically sets custom claims when a new user registers. Claims are based on the user's role in Firestore:

- **citizen**: Basic access
- **responder**: Phone verification required
- **municipal_admin`: Municipality-based access
- **provincial_superadmin`: Full province access + MFA required

**No manual invocation needed** — fires automatically on user creation.

### Callable Functions

#### `updateCustomClaims`
Updates custom claims when a user's role changes (e.g., promotion, demotion).

**Requires:** Provincial superadmin role

**Parameters:**
```typescript
{
  targetUserUid: string  // UID of user to update
}
```

**Usage:**
```typescript
const functions = getFunctions()
const updateCustomClaims = httpsCallable(functions, 'updateCustomClaims')

await updateCustomClaims({ targetUserUid: 'user-123' })
```

#### `forceTokenRefresh`
Signals a user to refresh their ID token to pick up new permissions.

**Requires:** Municipal admin or provincial superadmin role

**Parameters:**
```typescript
{
  targetUserUid: string  // UID of user (optional, defaults to caller)
}
```

**Usage:**
```typescript
const forceTokenRefresh = httpsCallable(functions, 'forceTokenRefresh')

await forceTokenRefresh({ targetUserUid: 'user-123' })
```

#### `deleteUserData`
Completely removes all user data (GDPR compliance).

**Requires:** User can delete own account, superadmins can delete any account

**Parameters:**
```typescript
{
  targetUserUid?: string  // Optional, defaults to caller's UID
}
```

**Usage:**
```typescript
const deleteUserData = httpsCallable(functions, 'deleteUserData')

// Delete own account
await deleteUserData()

// Delete another user (superadmin only)
await deleteUserData({ targetUserUid: 'user-123' })
```

### Scheduled Functions

#### `scheduledDataRetention`
Runs daily at midnight UTC to:
1. Archive reports older than 6 months → `reports_archive` collection
2. Delete reports older than 12 months → permanently removed

**No manual invocation needed** — runs on schedule.

## Local Development

### Run Firebase Emulator

```bash
# From project root
firebase emulators:start

# Or using npm script
cd functions
npm run serve
```

The emulator will:
- Start Functions emulator on port 5001
- Start Firestore emulator on port 8080
- Start Auth emulator on port 9099

### Test Functions Locally

```bash
# Shell interface for testing
cd functions
npm run shell

# In the shell, invoke functions:
await setCustomClaimsOnUserCreation({ uid: 'test-user', email: 'test@example.com' })
```

## Deployment

### Deploy All Functions

```bash
firebase deploy --only functions
```

### Deploy Specific Function

```bash
firebase deploy --only functions:setCustomClaimsOnUserCreation
```

### View Function Logs

```bash
firebase functions:log
```

## Client-Side Integration

### Listening for Claim Changes

After role changes or custom claim updates, clients must refresh their ID token:

```typescript
import { getAuth, onIdTokenChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/app/firebase/config'

const auth = getAuth()

// Listen for token changes
onIdTokenChanged(auth, async (user) => {
  if (user) {
    // Force token refresh to pick up new claims
    const idTokenResult = await user.getIdTokenResult(true)
    const claims = idTokenResult.claims

    console.log('User role:', claims.role)
    console.log('User municipality:', claims.municipality)
  }
})

// Alternative: Listen for metadata changes
const user = auth.currentUser
if (user) {
  const metadataRef = doc(db, 'user_metadata', user.uid)

  onSnapshot(metadataRef, (doc) => {
    if (doc.data()?.claimsUpdated) {
      // Force token refresh
      user.getIdToken(true)
    }
  })
}
```

### Calling Cloud Functions from Client

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth } from 'firebase/auth'

const functions = getFunctions()
const auth = getAuth()

// Update custom claims (superadmin only)
const updateCustomClaims = httpsCallable(functions, 'updateCustomClaims')

try {
  const result = await updateCustomClaims({
    targetUserUid: 'user-to-promote',
  })

  console.log(result.data.message)
} catch (error) {
  console.error('Error updating claims:', error)
}

// Force token refresh
const forceTokenRefresh = httpsCallable(functions, 'forceTokenRefresh')

await forceTokenRefresh({ targetUserUid: 'user-123' })
```

## Firestore Security Rules

The security rules reference the custom claims set by these functions:

```javascript
// In firestore.rules
function getRole() {
  return request.auth.token.role
}

function getMunicipality() {
  return request.auth.token.municipality
}

// Example usage
match /municipalities/{municipalityId} {
  allow read: if getRole() == 'municipal_admin' &&
               getMunicipality() == municipalityId
}
```

## Monitoring

### View Logs in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to Functions → Logs

### Common Issues

**Issue:** "Error: Could not handle the request"
**Solution:** Check that all dependencies are installed: `npm install`

**Issue:** Functions timeout
**Solution:** Increase timeout in firebase.json:
```json
{
  "functions": {
    "timeout": 540
  }
}
```

**Issue:** Custom claims not appearing in token
**Solution:** Force token refresh on client:
```typescript
await user.getIdToken(true)
```

## Data Retention Policy

Bantayog Alert implements GDPR-compliant data retention:

- **6 months:** Reports moved to archive collection
- **12 months:** Archived reports permanently deleted
- **User request:** Immediate deletion via `deleteUserData` function

Archive collections are read-only and excluded from regular queries.

## Security Considerations

1. **Elevated Privileges:** These functions run with admin privileges
2. **Authentication:** All callable functions verify caller identity
3. **Authorization:** Role checks before performing sensitive operations
4. **Audit Trail:** All administrative actions are logged to `audit_logs` collection
5. **Input Validation:** All inputs are validated before processing

## Testing

### Unit Tests (Future)

```bash
cd functions
npm test
```

### Integration Tests (Future)

Test functions against Firebase Emulator:

```bash
firebase emulators:exec "./test-integration.sh"
```

## Troubleshooting

**Custom claims not set:**
- Check Functions logs for errors
- Verify Firestore profile exists before user creation
- Ensure trigger is deployed: `firebase deploy --only functions`

**Token refresh not working:**
- Verify client is listening for metadata changes
- Check that metadata node is being written
- Force manual token refresh: `user.getIdToken(true)`

**Data retention not running:**
- Check Pub/Sub scheduler is deployed
- Verify cron expression in function definition
- Check logs for execution errors

## Additional Resources

- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Custom Claims Guide](https://firebase.google.com/docs/auth/admin/custom-claims)
- [TypeScript Cloud Functions](https://firebase.google.com/docs/functions/typescript)

## License

MIT

## Support

For issues or questions:
1. Check Firebase Console logs
2. Review this README
3. Check troubleshooting section
4. Contact Firebase Support
