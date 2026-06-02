import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MapKeyboardNav } from './MapKeyboardNav'
import type { Report } from '../types'

describe('MapKeyboardNav', () => {
  it('exposes a stable report id for exact keyboard selection', () => {
    const report: Report = {
      id: 'report-1',
      type: 'flood',
      severity: 'medium',
      status: 'new',
      municipality: 'daet',
      barangay: 'barangay-1',
      description: 'Flood report',
      reporterName: 'Citizen',
      reporterPhone: '+639123456789',
      latitude: 14.1122,
      longitude: 122.9553,
      createdAt: '2026-06-02T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
    }

    render(<MapKeyboardNav reports={[report]} selectedReportId={null} onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: /flood incident/i })).toHaveAttribute(
      'data-report-id',
      'report-1',
    )
  })
})
