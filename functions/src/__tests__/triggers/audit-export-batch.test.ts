import { describe, expect, it, vi } from 'vitest'

const mockInsert = vi.fn().mockResolvedValue(undefined)
const mockGetEntries = vi.fn().mockResolvedValue([[]])

import { auditExportBatchCore } from '../../triggers/audit-export-batch.js'

describe('auditExportBatchCore', () => {
  it('returns 0 when no log entries exist', async () => {
    mockGetEntries.mockResolvedValueOnce([[]])
    const result = await auditExportBatchCore({
      bqTable: { insert: mockInsert },
      loggingLog: { getEntries: mockGetEntries },
    })
    expect(result.exported).toBe(0)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('inserts mapped rows into BigQuery', async () => {
    mockGetEntries.mockResolvedValueOnce([
      [
        {
          metadata: {
            logName: 'test-log',
            resource: { type: 'global' },
            timestamp: '2024-01-01T00:00:00Z',
          },
          data: { action: 'login' },
        },
      ],
    ])
    const result = await auditExportBatchCore({
      bqTable: { insert: mockInsert },
      loggingLog: { getEntries: mockGetEntries },
    })
    expect(result.exported).toBe(1)
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        logName: 'test-log',
        resource: JSON.stringify({ type: 'global' }),
        payload: JSON.stringify({ action: 'login' }),
        timestamp: '2024-01-01T00:00:00Z',
      }),
    ])
  })
})
