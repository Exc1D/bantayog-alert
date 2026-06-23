import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { StatusBar } from '../components/StatusBar'

it('preserves unavailable response time instead of displaying zero minutes', () => {
  render(
    <StatusBar
      activeIncidents={1}
      avgResponseTime={0}
      avgAcceptSeconds={null}
      fcmSuccessRate={null}
      pendingTriage={2}
      mode="active"
      affectedMunicipalities={[]}
      stalledDispatchCount={0}
      totalResponders={1}
      uncoveredMunicipalities={0}
      lastDataUpdateAt={Date.now()}
    />,
  )

  expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  expect(screen.queryByText('0m')).not.toBeInTheDocument()
})
