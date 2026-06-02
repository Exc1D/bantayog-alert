import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  processInboxManualSummary,
  runManualInboxProcessor,
  runManualInboxProcessorAndTerminate,
} from './process-inbox-manual.js'

function createDb(candidates: Array<{ id: string; processedAt?: number | null }>) {
  return {
    collection: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({
        docs: candidates.map((candidate) => ({
          id: candidate.id,
          data: () => ({ processedAt: candidate.processedAt }),
        })),
      }),
    })),
  }
}

describe('processInboxManualSummary', () => {
  beforeEach(() => {
    process.exitCode = undefined
  })

  afterEach(() => {
    process.exitCode = undefined
  })

  it('returns a structured summary for processed inbox docs', async () => {
    const db = createDb([{ id: 'draft-1' }])
    const logger = { log: vi.fn() }
    const processInboxItem = vi.fn().mockResolvedValue({
      materialized: true,
      replayed: false,
      reportId: 'report-1',
      publicRef: 'public-1',
    })

    const summary = await processInboxManualSummary({
      db: db as never,
      writeLine: logger.log,
      processInboxItem,
    })

    expect(summary).toMatchObject({
      scanned: 1,
      candidates: 1,
      processed: 1,
      replayed: 0,
      failed: 0,
      exitCode: 0,
    })
    expect(summary.failures).toEqual([])
    expect(processInboxItem).toHaveBeenCalledWith({ db: db as never, inboxId: 'draft-1' })
    expect(logger.log).toHaveBeenCalledWith('Found 1 unprocessed inbox item(s).')
    expect(logger.log).toHaveBeenCalledWith(
      '  [OK] Materialized: true, Report ID: report-1, Public Ref: public-1',
    )
    expect(logger.log).toHaveBeenCalledWith(JSON.stringify(summary))
  })

  it('sets a failing exit code when processing throws', async () => {
    const db = createDb([{ id: 'draft-2' }])
    const logger = { log: vi.fn() }
    const processInboxItem = vi.fn().mockRejectedValue(new Error('boom'))

    const summary = await runManualInboxProcessor(db as never, logger.log, processInboxItem)

    expect(summary).toMatchObject({
      scanned: 1,
      candidates: 1,
      processed: 0,
      replayed: 0,
      failed: 1,
      exitCode: 1,
    })
    expect(summary.failures).toEqual([{ inboxId: 'draft-2', error: 'boom' }])
    expect(process.exitCode).toBe(1)
    expect(logger.log).toHaveBeenCalledWith(JSON.stringify(summary))
  })

  it('terminates Firestore after the CLI summary finishes', async () => {
    const db = { ...createDb([]), terminate: vi.fn().mockResolvedValue(undefined) }
    const logger = { log: vi.fn() }

    await runManualInboxProcessorAndTerminate(db as never, logger.log)

    expect(db.terminate).toHaveBeenCalledOnce()
  })

  it('terminates Firestore even when processing fails', async () => {
    const db = {
      ...createDb([{ id: 'draft-error' }]),
      terminate: vi.fn().mockResolvedValue(undefined),
    }
    const logger = { log: vi.fn() }
    const processInboxItem = vi.fn().mockRejectedValue(new Error('boom'))

    const summary = await runManualInboxProcessorAndTerminate(
      db as never,
      logger.log,
      processInboxItem,
    )

    expect(db.terminate).toHaveBeenCalledOnce()
    expect(summary.exitCode).toBe(1)
  })

  it('does not let Firestore termination failures mask the processing summary', async () => {
    const db = { ...createDb([]), terminate: vi.fn().mockRejectedValue(new Error('close failed')) }
    const logger = { log: vi.fn() }

    const summary = await runManualInboxProcessorAndTerminate(db as never, logger.log)

    expect(db.terminate).toHaveBeenCalledOnce()
    expect(summary.exitCode).toBe(0)
    expect(logger.log).toHaveBeenCalledWith('Failed to terminate Firestore: close failed')
  })
})
