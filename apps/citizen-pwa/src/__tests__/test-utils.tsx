import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'

export function TestWrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}
