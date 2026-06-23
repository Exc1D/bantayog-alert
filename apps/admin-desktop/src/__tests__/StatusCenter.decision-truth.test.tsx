import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { StatusCenter } from '../components/StatusBar/StatusCenter'

it('preserves unavailable response time instead of displaying zero minutes', () => {
  render(<StatusCenter activeIncidents={1} avgResponseTime={null} pendingTriage={2} />)

  expect(screen.getByText('—')).toBeInTheDocument()
  expect(screen.queryByText('0m')).not.toBeInTheDocument()
})
