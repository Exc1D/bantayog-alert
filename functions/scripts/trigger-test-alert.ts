#!/usr/bin/env tsx
/**
 * Synthetic alert trigger for staging monitoring validation.
 * Writes a structured log entry that activates the test_alert_trigger log-based metric,
 * which fires the synthetic alert policy notification to on-call channels.
 *
 * Usage: npx tsx functions/scripts/trigger-test-alert.ts [project-id]
 * Default project: bantayog-alert-staging
 * Requires: GOOGLE_APPLICATION_CREDENTIALS or ADC
 */
import { Logging } from '@google-cloud/logging'

const project = process.argv[2] ?? 'bantayog-alert-staging'
const logging = new Logging({ projectId: project })

async function main(): Promise<void> {
  const [metrics] = await logging.getMetrics()
  const metricExists = metrics.some((m) => m.name === 'bantayog/test_alert_trigger')
  if (!metricExists) {
    console.warn('WARNING: Log metric bantayog/test_alert_trigger not found. Alert may not fire.')
  }

  const log = logging.log('bantayog-synthetic-alert')

  const metadata = {
    resource: {
      type: 'cloud_function',
      labels: {
        function_name: 'syntheticAlertTest',
        project_id: project,
        region: 'asia-southeast1',
      },
    },
    severity: 'INFO',
  }

  const entry = log.entry(metadata, {
    event: 'SYNTHETIC_ALERT_TEST',
    message: 'Synthetic alert test — monitoring validation',
    projectId: project,
    triggeredAt: new Date().toISOString(),
  })

  await log.write(entry)

  console.log(`Log entry written to ${project}.`)
  console.log('Wait 2-3 minutes for the log-based metric to process the entry.')
  console.log('Check on-call email for the test notification from Cloud Monitoring.')
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
