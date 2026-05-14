import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const PROJECT_ID = 'bantayog-alert-staging'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}

const auth = getAuth()
const db = getFirestore()

async function main() {
  const email = 'superadmin@test.local'
  const user = await auth.getUserByEmail(email)
  const now = Date.now()

  const claims = {
    role: 'provincial_superadmin',
    accountStatus: 'active',
    mfaEnrolled: false,
    lastClaimIssuedAt: now,
    permittedMunicipalityIds: [],
  }

  await auth.setCustomUserClaims(user.uid, claims)
  console.log(`Set claims for ${email} (${user.uid})`)

  await db
    .collection('active_accounts')
    .doc(user.uid)
    .set({
      uid: user.uid,
      role: 'provincial_superadmin',
      accountStatus: 'active',
      municipalityId: null,
      agencyId: null,
      permittedMunicipalityIds: [],
      mfaEnrolled: false,
      lastClaimIssuedAt: Timestamp.fromMillis(now),
      updatedAt: Timestamp.fromMillis(now),
    })
  console.log(`Wrote active_accounts/${user.uid}`)

  console.log('\nDone! You can now log in with superadmin@test.local')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
