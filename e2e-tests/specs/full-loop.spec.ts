import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import {
  cleanupProofRun,
  createProofLedger,
  getProofAuth,
  getProofEnvironment,
  getProofFirestore,
  getProofRealtimeDatabase,
  logCheckpoint,
  preflightProofServices,
  runManualInboxProcessor,
  seedLocalProofAccounts,
  waitForDoc,
  waitForQueryExactlyOne,
} from '../fixtures/reliability-spine.js'

const ADMIN_EMAIL = process.env.BANTAYOG_ADMIN_EMAIL ?? 'daet-admin-test-01@test.local'
const ADMIN_PASSWORD = process.env.BANTAYOG_ADMIN_PASSWORD ?? 'test123456'
const RESPONDER_EMAIL = process.env.BANTAYOG_RESPONDER_EMAIL ?? 'bfp-responder-test-01@test.local'
const RESPONDER_PASSWORD = process.env.BANTAYOG_RESPONDER_PASSWORD ?? 'test123456'

function monitorPage(page: Page, label: string) {
  const messages: string[] = []
  page.on('pageerror', (error) => {
    messages.push(`[pageerror] ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') messages.push(`[console] ${message.text()}`)
  })

  function assertHealthy(stage: string) {
    const bad = messages.filter(
      (message) =>
        !message.includes('auth/network-request-failed') &&
        /app-check|auth\/|functions\/internal|wrong region|unauthenticated|permission-denied/i.test(
          message,
        ),
    )
    if (bad.length > 0) {
      throw new Error(`${label} ${stage} encountered proof-blocking errors:\n${bad.join('\n')}`)
    }
  }

  return { assertHealthy }
}

function appUrl(baseUrl: string, pathname: string): string {
  return new URL(pathname, baseUrl).toString()
}

async function useResponderDemoViewport(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const applyLargeText = () => {
      document.documentElement.style.fontSize = '20px'
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyLargeText, { once: true })
      return
    }

    applyLargeText()
  })
}

async function assertNoHorizontalOverflow(page: Page): Promise<{
  clientWidth: number
  scrollWidth: number
}> {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
  return metrics
}

async function assertTimelineHintReadable(page: Page): Promise<{
  hintWidth: number
  timelineWidth: number
}> {
  const metrics = await page
    .getByText(/next step: tap the action button below to advance/i)
    .evaluate((node) => {
      const hintBox = node.getBoundingClientRect()
      const timelineBox = node.parentElement?.getBoundingClientRect()
      if (timelineBox === undefined) throw new Error('Missing timeline container')
      return {
        hintWidth: Math.round(hintBox.width),
        timelineWidth: Math.round(timelineBox.width),
      }
    })
  expect(metrics.hintWidth).toBeGreaterThanOrEqual(Math.floor(metrics.timelineWidth * 0.7))
  return metrics
}

async function signInAdmin(page: Page, baseUrl: string): Promise<void> {
  await page.goto(appUrl(baseUrl, '/login'), { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.locator('#password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/dashboard(?:\?.*)?$/, { timeout: 15_000 })
  await dismissAdminTourIfPresent(page)
}

async function signInResponder(page: Page, baseUrl: string): Promise<void> {
  await page.goto(appUrl(baseUrl, '/login'), { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/email/i).fill(RESPONDER_EMAIL)
  await page.locator('#password').fill(RESPONDER_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
  await dismissResponderPrivacyNoticeIfPresent(page)
}

async function dismissAdminTourIfPresent(page: Page): Promise<void> {
  const skipButton = page.getByRole('button', { name: /skip tour/i })
  if (!(await skipButton.isVisible({ timeout: 2_000 }).catch(() => false))) return

  await skipButton.click()
  await expect(skipButton).toBeHidden({ timeout: 10_000 })
}

async function dismissResponderPrivacyNoticeIfPresent(page: Page): Promise<void> {
  const agreeButton = page.getByRole('button', { name: /i agree/i })
  if (!(await agreeButton.isVisible({ timeout: 2_000 }).catch(() => false))) return

  await agreeButton.click()
  await expect(agreeButton).toBeHidden({ timeout: 10_000 })
}

async function createCitizenReport(page: Page, testRunId: string): Promise<string> {
  await page.evaluate(() => {
    localStorage.setItem('bantayog_location_auto', 'false')
  })
  await page.goto('/report', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.z-splash')).toBeHidden({ timeout: 10_000 })
  await page.getByRole('button', { name: /flood/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()
  await page.getByRole('button', { name: /pick my municipality manually/i }).click()
  const municipality = page.getByLabel('Municipality')
  await municipality.selectOption({ label: 'Daet' })
  await expect(municipality).toHaveValue('daet')
  await page.locator('#reporter-name').fill(`Reliability Spine ${testRunId}`)
  await page.locator('#reporter-msisdn').fill('+639123456789')
  await page.getByRole('button', { name: /no/i }).click()
  await page.getByRole('button', { name: /review report/i }).click()
  await page.getByRole('checkbox', { name: /i confirm this report is accurate/i }).check()
  await page.getByRole('checkbox', { name: /yes, this is a real emergency/i }).check()
  await page.getByRole('button', { name: /submit report/i }).click()

  await expect(page.getByText(/we heard you\. we are here\./i)).toBeVisible({ timeout: 20_000 })
  const publicRef = (await page.locator('.reveal-ref-code').textContent())?.trim() ?? ''
  expect(publicRef).toMatch(/^[a-z0-9]{8}$/)
  return publicRef
}

async function openExactReportOnMap(page: Page, reportId: string): Promise<void> {
  const incident = page.locator(`[data-report-id="${reportId}"]`)
  await expect(incident).toBeAttached({ timeout: 20_000 })
  await dismissAdminTourIfPresent(page)
  await incident.focus()
  await incident.click()
  await expect(
    page
      .getByRole('dialog', { name: /report detail/i })
      .getByText(new RegExp(`Report #${reportId.slice(0, 8)}`)),
  ).toBeVisible({ timeout: 10_000 })
}

async function chooseResponderAndDispatch(page: Page, responderUid: string): Promise<void> {
  await page.getByRole('button', { name: /advance to review/i }).click()
  await confirmReportVerification(page)
  await expect(page.getByRole('button', { name: /^verify$/i })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /^verify$/i }).click()
  await confirmReportVerification(page)
  await expect(page.getByRole('button', { name: /dispatch responder/i })).toBeVisible({
    timeout: 10_000,
  })
  await page.getByRole('button', { name: /dispatch responder/i }).click()
  await page.getByLabel(/select agency/i).selectOption('BFP')
  await page.getByLabel(/select responder/i).selectOption(responderUid)
  const holdButton = page.getByRole('button', { name: /hold to dispatch responder/i })
  await holdButton.focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(1200)
  await page.keyboard.up('Space')
}

async function confirmReportVerification(page: Page): Promise<void> {
  const confirmation = page.getByRole('dialog', { name: /verify report/i })
  await expect(confirmation).toBeVisible({ timeout: 10_000 })
  await confirmation.getByRole('button', { name: /^verify$/i }).click()
  await expect(confirmation).toBeHidden({ timeout: 10_000 })
}

async function declareAlert(page: Page, testRunId: string): Promise<void> {
  await page.getByRole('button', { name: /declare alert/i }).focus()
  await page.keyboard.press('Enter')
  const modal = page.getByRole('dialog', { name: /declare alert/i })
  await expect(modal).toBeVisible({ timeout: 10_000 })
  await modal.getByLabel(/alert type/i).selectOption('flood_advisory')
  await modal.getByRole('checkbox', { name: /daet/i }).check()
  await modal.getByLabel(/message/i).fill(`[TEST:${testRunId}] Flood proof alert`)
  await modal.getByRole('button', { name: /^review declaration$/i }).click()
  await page
    .getByRole('alertdialog', { name: /declare public alert/i })
    .getByRole('button', {
      name: /^declare public alert$/i,
    })
    .click()
}

test.describe.configure({ mode: 'serial' })

test.describe('reliability spine', () => {
  test('proves the core citizen → admin → responder loop', async ({ browser }, testInfo) => {
    const env = getProofEnvironment()
    const ledger = createProofLedger()
    const db = getProofFirestore()
    const auth = getProofAuth()
    const rtdb = getProofRealtimeDatabase()
    const cleanupContext = { db, auth, rtdb }
    await preflightProofServices({ env, db, auth })

    const citizenContext = await browser.newContext({ reducedMotion: 'reduce' })
    await citizenContext.addInitScript(() => {
      window.localStorage.setItem('bantayog_onboarding_complete', 'true')
    })
    const adminContext = await browser.newContext()
    const responderContext = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      reducedMotion: 'reduce',
      viewport: { width: 390, height: 844 },
    })
    await useResponderDemoViewport(responderContext)
    const citizenPage = await citizenContext.newPage()
    const adminPage = await adminContext.newPage()
    const responderPage = await responderContext.newPage()
    const citizenGuard = monitorPage(citizenPage, 'citizen')
    const adminGuard = monitorPage(adminPage, 'admin')
    const responderGuard = monitorPage(responderPage, 'responder')
    let currentCheckpoint = 'C00'

    try {
      if (env.target === 'local') {
        const accounts = await seedLocalProofAccounts()
        ledger.adminUid = accounts.admin.uid
        ledger.responderUid = accounts.responder.uid
      } else {
        ledger.adminUid = process.env.BANTAYOG_ADMIN_UID ?? 'daet-admin-test-01'
        ledger.responderUid = process.env.BANTAYOG_RESPONDER_UID ?? 'bfp-responder-test-01'
      }

      ledger.clientDraftRef = undefined
      ledger.publicRef = undefined
      ledger.reportId = undefined
      ledger.alertId = undefined
      ledger.dispatchId = undefined

      await citizenPage.goto(env.citizenBaseUrl, { waitUntil: 'domcontentloaded' })
      await adminPage.goto(appUrl(env.adminBaseUrl, '/login'), { waitUntil: 'domcontentloaded' })
      await responderPage.goto(appUrl(env.responderBaseUrl, '/login'), {
        waitUntil: 'domcontentloaded',
      })
      await expect(citizenPage.getByRole('navigation', { name: /main navigation/i })).toBeVisible({
        timeout: 15_000,
      })
      await expect(adminPage.getByRole('heading', { name: /bantayog alert/i })).toBeVisible({
        timeout: 60_000,
      })
      await expect(responderPage.getByRole('heading', { name: /bantayog alert/i })).toBeVisible({
        timeout: 60_000,
      })
      citizenGuard.assertHealthy('C00')
      adminGuard.assertHealthy('C00')
      responderGuard.assertHealthy('C00')
      logCheckpoint({
        testRunId: ledger.testRunId,
        checkpoint: 'C00',
        status: 'passed',
        target: ledger.target,
        expected: 'Citizen, admin, and responder apps load in the configured proof environments',
        observed: {
          citizenUrl: env.citizenBaseUrl,
          adminUrl: env.adminBaseUrl,
          responderUrl: env.responderBaseUrl,
          projectId: env.projectId,
        },
      })

      currentCheckpoint = 'C01'
      ledger.publicRef = await createCitizenReport(citizenPage, ledger.testRunId)
      const lookup = await waitForDoc(db.collection('report_lookup').doc(ledger.publicRef), 30_000)
      ledger.reportId = String(lookup.data()?.reportId ?? '')
      expect(ledger.reportId).not.toBe('')
      await waitForDoc(db.collection('reports').doc(ledger.reportId), 30_000)
      await waitForDoc(db.collection('report_ops').doc(ledger.reportId), 30_000)
      await waitForDoc(db.collection('report_private').doc(ledger.reportId), 30_000)
      logCheckpoint({
        testRunId: ledger.testRunId,
        checkpoint: 'C01',
        status: 'passed',
        target: ledger.target,
        expected: 'submitCitizenReport materializes reports/report_ops/report_lookup directly',
        observed: {
          reportId: ledger.reportId,
          publicRef: ledger.publicRef,
          reportLookupId: lookup.id,
          reportOpsStatus: (await db.collection('report_ops').doc(ledger.reportId).get()).data()
            ?.status,
        },
      })

      currentCheckpoint = 'C02'
      const firstSummary = await runManualInboxProcessor()
      expect(firstSummary.exitCode, JSON.stringify(firstSummary, null, 2)).toBe(0)
      expect(firstSummary.failedCount, JSON.stringify(firstSummary, null, 2)).toBe(0)
      logCheckpoint({
        testRunId: ledger.testRunId,
        checkpoint: 'C02',
        status: 'passed',
        target: ledger.target,
        expected: 'Manual inbox fallback can run after callable materialization without failures',
        observed: {
          reportId: ledger.reportId,
          publicRef: ledger.publicRef,
          candidateCount: firstSummary.candidateCount,
          processedCount: firstSummary.processedCount,
          failedCount: firstSummary.failedCount,
        },
      })

      currentCheckpoint = 'C03'
      await signInAdmin(adminPage, env.adminBaseUrl)
      await adminPage.goto(`${env.adminBaseUrl}/map`, { waitUntil: 'domcontentloaded' })
      await openExactReportOnMap(adminPage, ledger.reportId)
      const reportPanel = adminPage.getByRole('dialog', { name: /report detail/i })
      await expect(reportPanel).toContainText(new RegExp(`Report #${ledger.reportId.slice(0, 8)}`))
      citizenGuard.assertHealthy('C03')
      adminGuard.assertHealthy('C03')
      logCheckpoint({
        testRunId: ledger.testRunId,
        checkpoint: 'C03',
        status: 'passed',
        target: ledger.target,
        expected: 'Admin map listener surfaces the exact report row/card for the proof run',
        observed: {
          reportId: ledger.reportId,
          panelVisible: true,
        },
      })

      currentCheckpoint = 'C04'
      await declareAlert(adminPage, ledger.testRunId)
      const alertDoc = await waitForQueryExactlyOne(
        () =>
          db
            .collection('alerts')
            .where('message', '==', `[TEST:${ledger.testRunId}] Flood proof alert`)
            .get(),
        15_000,
        'declared alert',
      )
      ledger.alertId = alertDoc.id
      expect(alertDoc.data().publishedAt).toBeDefined()
      logCheckpoint({
        testRunId: ledger.testRunId,
        checkpoint: 'C04',
        status: 'passed',
        target: ledger.target,
        expected: 'alerts/{alertId} includes publishedAt and the testRunId prefix in message',
        observed: {
          alertId: ledger.alertId,
          hazardType: alertDoc.data().hazardType,
          affectedMunicipalityIds: alertDoc.data().affectedMunicipalityIds,
          publishedAt: alertDoc.data().publishedAt,
        },
      })

      currentCheckpoint = 'C05'
      await citizenPage.goto(`${env.citizenBaseUrl}/alerts`, { waitUntil: 'domcontentloaded' })
      await expect(
        citizenPage.getByText(`[TEST:${ledger.testRunId}] Flood proof alert`),
      ).toBeVisible({
        timeout: 15_000,
      })
      citizenGuard.assertHealthy('C05')
      logCheckpoint({
        testRunId: ledger.testRunId,
        checkpoint: 'C05',
        status: 'passed',
        target: ledger.target,
        expected: 'Citizen alerts surface the exact declared message from Firestore',
        observed: {
          alertId: ledger.alertId,
          alertMessage: `[TEST:${ledger.testRunId}] Flood proof alert`,
        },
      })

      currentCheckpoint = 'C06'
      await chooseResponderAndDispatch(adminPage, ledger.responderUid ?? '')
      const dispatchDoc = await waitForQueryExactlyOne(
        () =>
          db
            .collection('dispatches')
            .where('reportId', '==', ledger.reportId ?? '')
            .get(),
        15_000,
        'dispatch document',
      )
      ledger.dispatchId = dispatchDoc.id
      expect(dispatchDoc.data().status).toBe('pending')
      expect(dispatchDoc.data().assignedTo?.uid).toBe(ledger.responderUid)
      logCheckpoint({
        testRunId: ledger.testRunId,
        checkpoint: 'C06',
        status: 'passed',
        target: ledger.target,
        expected:
          'dispatches/{dispatchId} contains exact reportId, responder uid, and pending status',
        observed: {
          dispatchId: ledger.dispatchId,
          reportId: dispatchDoc.data().reportId,
          status: dispatchDoc.data().status,
          assignedTo: dispatchDoc.data().assignedTo,
        },
      })

      currentCheckpoint = 'C07'
      await signInResponder(responderPage, env.responderBaseUrl)
      await responderPage.goto(`${env.responderBaseUrl}/alerts`, { waitUntil: 'domcontentloaded' })
      await expect(
        responderPage.getByText(`[TEST:${ledger.testRunId}] Flood proof alert`),
      ).toBeVisible({ timeout: 15_000 })
      await responderPage.goto(`${env.responderBaseUrl}/dispatches/${ledger.dispatchId}`, {
        waitUntil: 'domcontentloaded',
      })
      await expect(responderPage).toHaveURL(new RegExp(`/dispatches/${ledger.dispatchId}$`))
      await expect(responderPage.getByRole('button', { name: /^✓ accept$/i })).toBeVisible({
        timeout: 15_000,
      })
      await responderContext.setOffline(true)
      try {
        await expect(
          responderPage.getByRole('progressbar', { name: /dispatch progress/i }),
        ).toBeVisible()
        await expect(responderPage.getByRole('button', { name: /^✓ accept$/i })).toBeVisible()
        const offlineLayoutMetrics = await assertNoHorizontalOverflow(responderPage)
        const pendingTimelineHintMetrics = await assertTimelineHintReadable(responderPage)
        responderGuard.assertHealthy('C07')
        logCheckpoint({
          testRunId: ledger.testRunId,
          checkpoint: 'C07',
          status: 'passed',
          meta: {
            status: 'acknowledged',
            dispatchId: ledger.dispatchId,
            reportId: ledger.reportId,
            responderUid: ledger.responderUid,
            responderViewport: '390x844',
            responderReducedMotion: 'reduce',
            offlineDetailStable: true,
            offlineLayoutMetrics,
            pendingTimelineHintMetrics,
          },
        })
      } finally {
        await responderContext.setOffline(false)
      }

      currentCheckpoint = 'C08'
      const dispatchId = ledger.dispatchId
      if (!dispatchId) throw new Error('Missing dispatchId before responder progression')
      await dismissResponderPrivacyNoticeIfPresent(responderPage)
      await responderPage.getByRole('button', { name: /^✓ accept$/i }).click()
      await expect
        .poll(async () => (await db.collection('dispatches').doc(dispatchId).get()).data()?.status)
        .toBe('acknowledged')
      const enRouteButton = responderPage.getByRole('button', { name: /en route/i })
      await expect(enRouteButton).toBeVisible({ timeout: 15_000 })
      const preArrivalToggle = responderPage.getByRole('button', { name: /pre-arrival info/i })
      await expect(preArrivalToggle).toBeVisible({ timeout: 15_000 })
      if ((await preArrivalToggle.getAttribute('aria-expanded')) !== 'true') {
        await preArrivalToggle.click()
      }
      await expect(responderPage.getByText(/navigate to scene still works/i)).toBeVisible()
      await expect(
        responderPage.getByText(/location not available - use navigate to scene/i),
      ).toBeVisible()
      const acknowledgedLayoutMetrics = await assertNoHorizontalOverflow(responderPage)
      await responderPage.screenshot({
        fullPage: true,
        path: testInfo.outputPath('responder-dispatch-mobile.png'),
      })
      await enRouteButton.click()
      await expect
        .poll(async () => (await db.collection('dispatches').doc(dispatchId).get()).data()?.status)
        .toBe('en_route')
      const onSceneButton = responderPage.getByRole('button', { name: /on scene/i })
      await expect(onSceneButton).toBeVisible({ timeout: 15_000 })
      await onSceneButton.click()
      await expect
        .poll(async () => (await db.collection('dispatches').doc(dispatchId).get()).data()?.status)
        .toBe('on_scene')
      await expect
        .poll(
          async () =>
            (
              await db
                .collection('reports')
                .doc(ledger.reportId ?? '')
                .get()
            ).data()?.status,
        )
        .toBe('on_scene')
      logCheckpoint({
        testRunId: ledger.testRunId,
        checkpoint: 'C08',
        status: 'passed',
        target: ledger.target,
        expected:
          'Responder progression advances dispatch and parent report through acknowledged, en_route, and on_scene',
        observed: {
          dispatchId: ledger.dispatchId,
          finalStatus: (await db.collection('dispatches').doc(ledger.dispatchId).get()).data()
            ?.status,
          reportStatus: (
            await db
              .collection('reports')
              .doc(ledger.reportId ?? '')
              .get()
          ).data()?.status,
          preArrivalFallbackVisible: true,
          acknowledgedLayoutMetrics,
        },
      })

      currentCheckpoint = 'C09'
      const alertId = ledger.alertId
      if (!alertId) throw new Error('Missing alertId before feed moderation')
      await adminPage.goto(`${env.adminBaseUrl}/feed`, { waitUntil: 'domcontentloaded' })
      const retireAlertButton = adminPage.getByRole('button', { name: `Retire alert ${alertId}` })
      await expect(retireAlertButton).toBeVisible({ timeout: 15_000 })
      await retireAlertButton.click()
      await expect
        .poll(async () => (await db.collection('alerts').doc(alertId).get()).data()?.visibility)
        .toBe('internal')
      const restoreAlertButton = adminPage.getByRole('button', {
        name: `Restore retired alert ${alertId}`,
      })
      await expect(restoreAlertButton).toBeVisible({ timeout: 15_000 })
      await restoreAlertButton.click()
      await expect
        .poll(async () => (await db.collection('alerts').doc(alertId).get()).data()?.visibility)
        .toBe('public')
      logCheckpoint({
        testRunId: ledger.testRunId,
        checkpoint: 'C09',
        status: 'passed',
        target: ledger.target,
        expected: 'Admin feed regulation hides and restores the exact official alert',
        observed: { alertId, finalVisibility: 'public' },
      })

      currentCheckpoint = 'C10'
      const replaySummary = await runManualInboxProcessor()
      expect(replaySummary.exitCode).toBe(0)
      expect(replaySummary.candidateCount).toBe(0)
      expect(replaySummary.processedCount).toBe(0)
      await expect
        .poll(
          async () =>
            (
              await db
                .collection('report_lookup')
                .doc(ledger.publicRef ?? '')
                .get()
            ).data()?.reportId,
        )
        .toBe(ledger.reportId)
      const reportAfterReplay = await db
        .collection('reports')
        .doc(ledger.reportId ?? '')
        .get()
      expect(reportAfterReplay.exists).toBe(true)
      logCheckpoint({
        testRunId: ledger.testRunId,
        checkpoint: 'C10',
        status: 'passed',
        target: ledger.target,
        expected: 'Replaying local materialization does not duplicate the report',
        observed: {
          publicRef: ledger.publicRef,
          reportId: ledger.reportId,
          candidateCount: replaySummary.candidateCount,
          processedCount: replaySummary.processedCount,
          reportStillExists: reportAfterReplay.exists,
        },
      })

      citizenGuard.assertHealthy('C10')
      adminGuard.assertHealthy('C10')
      responderGuard.assertHealthy('C10')
    } catch (error) {
      logCheckpoint({
        testRunId: ledger.testRunId,
        checkpoint: currentCheckpoint,
        status: 'failed',
        target: ledger.target,
        expected: `Checkpoint ${currentCheckpoint} completes without app-check/auth/region drift`,
        observed: {
          error: error instanceof Error ? error.message : String(error),
          ledger,
          testFile: testInfo.file,
        },
        nextHint: 'Inspect the first failing checkpoint and the exact Firestore ids on the ledger.',
      })
      throw error
    } finally {
      await Promise.allSettled([
        citizenContext.close(),
        adminContext.close(),
        responderContext.close(),
      ])
      await cleanupProofRun(cleanupContext, ledger).catch((cleanupError: unknown) => {
        console.error(
          JSON.stringify({
            event: 'reliability-spine-cleanup-required',
            testRunId: ledger.testRunId,
            ledger,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          }),
        )
      })
    }
  })
})
