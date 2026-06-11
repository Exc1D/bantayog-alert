import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { PushPermissionBanner } from './PushPermissionBanner.js'

const originalNotification = globalThis.Notification

type TestPermission = Extract<NotificationPermission, 'default' | 'denied'>

function setNotificationPermission(permission: TestPermission): TestPermission {
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: {
      permission,
    },
  })
  return permission
}

afterEach(() => {
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: originalNotification,
  })
})

describe('PushPermissionBanner', () => {
  it('renders browser settings guidance when notifications are denied', () => {
    const permission = setNotificationPermission('denied')

    render(
      <PushPermissionBanner
        permission={permission}
        onDismiss={() => undefined}
        onRetry={() => undefined}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/browser is blocking/i)
    expect(screen.getByRole('alert')).toHaveTextContent(/browser settings/i)
    expect(screen.queryByRole('button', { name: /enable notifications/i })).not.toBeInTheDocument()
  })

  it('invokes the permission request when default permission still needs a token', async () => {
    const permission = setNotificationPermission('default')
    const user = userEvent.setup()
    const retry = vi.fn()

    render(
      <PushPermissionBanner permission={permission} onDismiss={() => undefined} onRetry={retry} />,
    )

    await user.click(screen.getByRole('button', { name: /enable notifications/i }))

    expect(retry).toHaveBeenCalledTimes(1)
  })
})
