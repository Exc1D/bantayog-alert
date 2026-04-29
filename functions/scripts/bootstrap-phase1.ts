import { adminDb } from '../src/admin-init.js'
import { buildPhase1SeedDocs } from '../src/bootstrap/phase1-seed.js'

async function main() {
  const updatedAt = Date.now()
  const seed = buildPhase1SeedDocs(updatedAt)

  await adminDb
    .collection('system_config')
    .doc('min_app_version')
    .set(seed.systemConfig.min_app_version)

  await adminDb
    .collection('system_config')
    .doc('update_urls')
    .set(seed.systemConfig.update_urls)

  for (const alert of seed.alerts) {
    await adminDb.collection('alerts').doc(alert.id).set(alert)
  }

  console.log('Phase 1 seed complete.')
  console.log('  min_app_version: 1.0.0 (citizen, admin, responder)')
  console.log('  update_urls: written')
}

void main()
