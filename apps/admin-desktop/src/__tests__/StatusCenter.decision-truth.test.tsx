import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { StatusCenter } from '../components/StatusBar/StatusCenter'

it('labels operational metrics and preserves unavailable response time', () => {
  render(<StatusCenter activeIncidents={1} avgResponseTime={null} pendingTriage={2} />)

  expect(screen.getByLabelText('1 active incident')).toBeInTheDocument()
  expect(screen.getByLabelText('Average response unavailable')).toHaveTextContent('—')
  expect(screen.getByLabelText('2 pending triage reports')).toBeInTheDocument()
})
