import { adminDb } from '../src/firebase-admin.js'
import { buildPhase1SeedDocs } from '../src/bootstrap/phase1-seed.js'

async function main() {
  const updatedAt = Date.now()
  const seed = buildPhase1SeedDocs(updatedAt)

  await adminDb
    .collection('system_config')
    .doc('min_app_version')
    .set(seed.systemConfig.min_app_version)

  for (const alert of seed.alerts) {
    await adminDb.collection('alerts').doc(alert.id).set(alert)
  }
}

void main()
