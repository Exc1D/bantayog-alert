import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReportTypeIcon } from '../components/ReportTypeIcon'

describe('ReportTypeIcon', () => {
  it('renders known type with correct label', () => {
    render(<ReportTypeIcon type="flood" />)
    expect(screen.getByText('Flood')).toBeInTheDocument()
  })

  it('renders unknown type without crashing', () => {
    // Firestore may contain legacy/unknown type values (e.g. public_disturbance).
    // The component must not throw React #130 when the type is not in TYPE_ICONS.
    const { container } = render(
      <ReportTypeIcon
        type={'public_disturbance' as unknown as Parameters<typeof ReportTypeIcon>[0]['type']}
      />,
    )
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    // Should still render an icon (the fallback AlertTriangle)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
