import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { Step3Review } from './Step3Review.js'

const reportData = {
  reportType: 'flood',
  description: '',
  peopleInjured: false,
  peopleTrapped: false,
  locationConfidence: 'manual' as const,
  location: { lat: 14.1, lng: 122.9 },
  reporterName: 'Juan',
  reporterMsisdn: '+639171234567',
  locationMethod: 'manual' as const,
  photoAttached: false,
  municipalityLabel: 'Daet',
  barangayId: 'Barangay 1',
}

describe('Step3Review', () => {
  it('shows a factual report readiness card before the summary', () => {
    render(<Step3Review onBack={vi.fn()} onSubmit={vi.fn()} reportData={reportData} />)

    const readiness = screen.getByRole('region', { name: /report readiness/i })
    expect(readiness).toHaveTextContent(
      'Your incident type and location are included. Adding a short description may help responders verify faster.',
    )
    expect(readiness).toHaveTextContent('Add a photo only if it is safe to do so.')
  })
})
