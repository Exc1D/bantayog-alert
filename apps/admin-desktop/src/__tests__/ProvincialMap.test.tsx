import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ProvincialMap } from '../components/ProvincialMap'

const mockReports = [
  {
    id: 'r1',
    type: 'flood' as const,
    severity: 'high' as const,
    latitude: 14.1,
    longitude: 122.9,
    municipality: 'Daet',
    barangay: 'Camambugan',
    createdAt: '14:02',
    status: 'new' as const,
    description: '',
    reporterName: '',
    reporterPhone: '',
    updatedAt: '',
  },
]

describe('ProvincialMap', () => {
  it('renders without crashing', () => {
    render(
      <ProvincialMap reports={mockReports} selectedReportId={null} onPinClick={() => void 0} />,
    )
    expect(document.querySelector('.leaflet-container')).toBeInTheDocument()
  })
})
