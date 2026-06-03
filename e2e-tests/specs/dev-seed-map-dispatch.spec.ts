import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import {
  getFirestore,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8081'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= '127.0.0.1:9000'

const PROJECT_ID = process.env.BANTAYOG_FIREBASE_PROJECT_ID ?? 'bantayog-alert-staging'
const ADMIN_EMAIL = 'daet-admin-test-01@test.local'
const RESPONDER_EMAIL = 'bfp-responder-test-01@test.local'
const PASSWORD = 'test123456'
const RESPONDER_UID = 'bfp-responder-test-01'

function getEmulatorFirestore(): Firestore {
  const app =
    getApps()[0] ??
    initializeApp({
      projectId: PROJECT_ID,
      databaseURL: `http://127.0.0.1:9000?ns=${PROJECT_ID}`,
    })
  return getFirestore(app)
}

function appUrl(baseUrl: string, pathname: string): string {
  return new URL(pathname, baseUrl).toString()
}

async function dismissAdminTourIfPresent(page: Page): Promise<void> {
  const skipButton = page.getByRole('button', { name: /skip tour/i })
  if (await skipButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    console.log('[dev-seed-map] admin: dismiss tour')
    await skipButton.click({ timeout: 5_000 })
    await expect(skipButton).toBeHidden({ timeout: 10_000 })
  }
}

async function dismissResponderPrivacyNoticeIfPresent(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog').filter({ hasText: /data privacy notice/i })
  if (await dialog.isVisible({ timeout: 12_000 }).catch(() => false)) {
    console.log('[dev-seed-map] responder: dismiss privacy notice')
    const agreeButton = dialog.locator('button').last()
    await agreeButton.scrollIntoViewIfNeeded({ timeout: 5_000 })
    await agreeButton.click({ timeout: 5_000 })
    await expect(dialog).toBeHidden({ timeout: 10_000 })
  }
}

async function signIn(page: Page, baseUrl: string, email: string): Promise<void> {
  console.log(`[dev-seed-map] auth: open login for ${email}`)
  await page.goto(appUrl(baseUrl, '/login'), { waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 60_000 })
  await page.getByLabel(/email/i).fill(email)
  await page.locator('#password').fill(PASSWORD)
  const signInButton = page.getByRole('button', { name: /sign in/i })
  await expect(signInButton).toBeEnabled({ timeout: 10_000 })
  console.log(`[dev-seed-map] auth: submit login for ${email}`)
  await signInButton.click({ timeout: 10_000 })
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
  console.log(`[dev-seed-map] auth: signed in ${email}`)
}

async function waitForDoc(db: Firestore, path: string): Promise<DocumentSnapshot> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 30_000) {
    const snapshot = await db.doc(path).get()
    if (snapshot.exists) return snapshot
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Timed out waiting for ${path}`)
}

async function waitForFirstQuery<T extends DocumentData>(
  read: () => Promise<FirebaseFirestore.QuerySnapshot<T>>,
  label: string,
): Promise<QueryDocumentSnapshot<T>> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 30_000) {
    const snapshot = await read()
    const doc = snapshot.docs[0]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (doc) return doc
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function seedResponderConsent(db: Firestore): Promise<void> {
  await db.collection('user_consents').doc(RESPONDER_UID).set({
    consentVersion: '1.0',
    consentGivenAt: Date.now(),
    method: 'dev_seed_map_dispatch_test',
  })
}

async function createCitizenReport(page: Page, runId: string): Promise<string> {
  console.log('[dev-seed-map] citizen: open report form')
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.setItem('bantayog_location_auto', 'false')
  })
  await page.goto('http://localhost:5173/report', { waitUntil: 'domcontentloaded' })
  if (await page.locator('.z-splash').isVisible()) {
    await page.locator('.z-splash').waitFor({ state: 'hidden', timeout: 10_000 })
  }
  console.log('[dev-seed-map] citizen: fill step 1')
  await page.getByRole('button', { name: /flood/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()
  console.log('[dev-seed-map] citizen: fill step 2')
  await page.getByRole('button', { name: /pick my municipality manually/i }).click()
  await page.getByLabel('Municipality').selectOption({ label: 'Daet' })
  await page.locator('#reporter-name').fill(`Manual Map ${runId}`)
  await page.locator('#reporter-msisdn').fill('+639123456789')
  await page.getByRole('button', { name: /^no$/i }).click()
  await page.getByRole('button', { name: /review report/i }).click()
  console.log('[dev-seed-map] citizen: submit')
  await page.getByRole('checkbox', { name: /i confirm this report is accurate/i }).check()
  await page.getByRole('checkbox', { name: /yes, this is a real emergency/i }).check()
  await page.getByRole('button', { name: /submit report/i }).click()
  await expect(page.getByText(/we heard you\. we are here\./i)).toBeVisible({ timeout: 25_000 })
  const publicRef = (await page.locator('.reveal-ref-code').textContent())?.trim() ?? ''
  expect(publicRef).toMatch(/^[a-z0-9]{8}$/)
  return publicRef
}

async function verifyReportFromMap(page: Page): Promise<void> {
  console.log('[dev-seed-map] admin: verify report')
  await page.getByRole('button', { name: /advance to review/i }).click()
  await confirmVerify(page)
  await expect(page.getByRole('button', { name: /^verify$/i })).toBeVisible()
  await page.getByRole('button', { name: /^verify$/i }).click()
  await confirmVerify(page)
}

async function confirmVerify(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: /verify report/i })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /^verify$/i }).click()
  await expect(dialog).toBeHidden()
}

async function dispatchResponderFromMap(page: Page): Promise<void> {
  console.log('[dev-seed-map] admin: dispatch responder')
  await expect(page.getByRole('button', { name: /dispatch responder/i })).toBeVisible()
  await page.getByRole('button', { name: /dispatch responder/i }).click()
  await page.getByLabel(/select agency/i).selectOption('BFP')
  const responderSelect = page.getByLabel(/select responder/i)
  await expect(responderSelect.locator(`option[value="${RESPONDER_UID}"]`)).toHaveCount(1)
  await responderSelect.selectOption(RESPONDER_UID)
  const holdButton = page.getByRole('button', { name: /hold to dispatch responder/i })
  await holdButton.focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(1_300)
  await page.keyboard.up('Space')
}

async function attachFailureContext(
  testInfo: {
    attach: (name: string, options: { body: string; contentType: string }) => Promise<void>
  },
  label: string,
  pages: Page[],
): Promise<void> {
  const bodies = await Promise.all(
    pages.map(async (page) => ({
      url: page.url(),
      text: (
        await page
          .locator('body')
          .innerText({ timeout: 2_000 })
          .catch(() => '')
      ).slice(0, 2_000),
    })),
  )
  await testInfo.attach(label, {
    body: JSON.stringify(bodies, null, 2),
    contentType: 'application/json',
  })
}

async function withCleanupTimeout(promise: Promise<unknown>): Promise<void> {
  await Promise.race([
    promise,
    new Promise<void>((resolve) => {
      setTimeout(resolve, 5_000)
    }),
  ])
}

test.describe.configure({ mode: 'serial' })

test('normal dev seed supports Citizen submission, Admin Map dispatch, and responder accept', async ({
  browser,
}, testInfo) => {
  test.setTimeout(180_000)
  const db = getEmulatorFirestore()
  getDatabase().goOffline()
  const runId = `dev-seed-map-${Date.now().toString(36)}`
  const citizenContext = await browser.newContext({ reducedMotion: 'reduce' })
  await citizenContext.addInitScript(() => {
    window.localStorage.setItem('bantayog_onboarding_complete', 'true')
  })
  const adminContext = await browser.newContext({ reducedMotion: 'reduce' })
  await adminContext.addInitScript(() => {
    window.localStorage.setItem('bantayog.onboarding-completed', '1')
  })
  const responderContext: BrowserContext = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 },
  })
  const citizenPage = await citizenContext.newPage()
  const adminPage = await adminContext.newPage()
  const responderPage = await responderContext.newPage()

  let publicRef = ''
  let reportId = ''
  let dispatchId = ''

  try {
    publicRef = await createCitizenReport(citizenPage, runId)
    console.log(`[dev-seed-map] citizen: publicRef ${publicRef}`)
    const lookup = await waitForDoc(db, `report_lookup/${publicRef}`)
    reportId = String(lookup.data()?.reportId ?? '')
    expect(reportId).not.toBe('')
    await waitForDoc(db, `reports/${reportId}`)
    await waitForDoc(db, `report_ops/${reportId}`)
    await waitForDoc(db, `report_private/${reportId}`)

    console.log('[dev-seed-map] admin: sign in and open map')
    await signIn(adminPage, 'http://localhost:5175', ADMIN_EMAIL)
    await adminPage.goto('http://localhost:5175/map', {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    })
    await dismissAdminTourIfPresent(adminPage)
    await expect(adminPage.locator(`[data-report-id="${reportId}"]`)).toBeAttached({
      timeout: 25_000,
    })
    const incidentMarker = adminPage.locator('.leaflet-marker-icon').first()
    await expect(incidentMarker).toBeVisible({ timeout: 25_000 })
    await incidentMarker.click({ timeout: 10_000 })
    await expect(
      adminPage
        .getByRole('dialog', { name: /report detail/i })
        .getByText(new RegExp(`Report #${reportId.slice(0, 8)}`)),
    ).toBeVisible()

    await verifyReportFromMap(adminPage)
    await dispatchResponderFromMap(adminPage)
    console.log('[dev-seed-map] admin: wait for dispatch document')
    const dispatchDoc = await waitForFirstQuery(
      () => db.collection('dispatches').where('reportId', '==', reportId).get(),
      'dispatch for dev-seed Map report',
    )
    dispatchId = dispatchDoc.id
    expect(dispatchDoc.data().assignedTo?.uid).toBe(RESPONDER_UID)

    console.log('[dev-seed-map] responder: sign in and accept dispatch')
    await seedResponderConsent(db)
    await signIn(responderPage, 'http://localhost:5174', RESPONDER_EMAIL)
    await responderPage.goto(`http://localhost:5174/dispatches/${dispatchId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    })
    await dismissResponderPrivacyNoticeIfPresent(responderPage)
    await expect(responderPage.getByRole('button', { name: /accept$/i })).toBeVisible({
      timeout: 15_000,
    })
    await responderPage.getByRole('button', { name: /accept$/i }).click({ timeout: 10_000 })
    await expect
      .poll(async () => (await db.collection('dispatches').doc(dispatchId).get()).data()?.status, {
        timeout: 15_000,
      })
      .toBe('acknowledged')
  } catch (error) {
    console.error(
      '[dev-seed-map] failure:',
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    )
    await attachFailureContext(testInfo, 'dev-seed-map-dispatch-context', [
      citizenPage,
      adminPage,
      responderPage,
    ])
    throw error
  } finally {
    await withCleanupTimeout(
      Promise.allSettled([
        publicRef ? db.collection('report_lookup').doc(publicRef).delete() : undefined,
        reportId ? db.collection('reports').doc(reportId).delete() : undefined,
        reportId ? db.collection('report_ops').doc(reportId).delete() : undefined,
        reportId ? db.collection('report_private').doc(reportId).delete() : undefined,
        dispatchId ? db.collection('dispatches').doc(dispatchId).delete() : undefined,
        db.collection('user_consents').doc(RESPONDER_UID).delete(),
        citizenContext.close(),
        adminContext.close(),
        responderContext.close(),
      ]).then(() => undefined),
    )
  }
})
