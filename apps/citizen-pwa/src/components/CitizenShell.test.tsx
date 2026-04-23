import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { CitizenShell } from './CitizenShell.js'

function renderShell(pathname = '/') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <CitizenShell>
            <Outlet />
          </CitizenShell>
        ),
        children: [
          { index: true, element: <div>Map content</div> },
          { path: 'report', element: <div>Report content</div> },
          { path: 'feed', element: <div>Feed content</div> },
        ],
      },
    ],
    { initialEntries: [pathname] },
  )

  return render(<RouterProvider router={router} />)
}

describe('CitizenShell', () => {
  it('renders the fixed chrome and active tab', () => {
    renderShell('/')
    expect(screen.getByRole('banner')).toHaveTextContent('VIGILANT')
    expect(screen.getByRole('button', { name: /map/i })).toHaveAttribute('aria-current', 'page')
  })

  it('navigates to report and feed tabs', async () => {
    renderShell('/')
    fireEvent.click(screen.getByRole('button', { name: /report/i }))
    await waitFor(() => {
      expect(screen.getByText('Report content')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /report/i })).toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('button', { name: /feed/i }))
    await waitFor(() => {
      expect(screen.getByText('Feed content')).toBeInTheDocument()
    })
  })
})
