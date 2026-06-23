import { expect, it } from 'vitest'
import { getActiveDispatchCount } from '../pages/DashboardPage'

it('excludes terminal dispatches from the active count', () => {
  expect(
    getActiveDispatchCount([
      { status: 'pending' },
      { status: 'resolved' },
      { status: 'declined' },
      { status: 'needs_admin' },
    ] as never),
  ).toBe(1)
})
